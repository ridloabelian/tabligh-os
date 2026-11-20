import type { PlatformId, PlatformTarget } from "../types.js";

export interface OfficialApiInput {
  episodeId: string;
  target: PlatformTarget;
  dryRun?: boolean;
  env?: NodeJS.ProcessEnv;
  fetchFn?: typeof fetch;
}

export interface OfficialApiResult {
  ok: boolean;
  outcome: "PUBLISHED" | "SCHEDULED" | "FAILED";
  externalId?: string;
  publishedUrl?: string;
  message: string;
  error?: string;
}

function isFutureSchedule(scheduledAt?: string): boolean {
  if (!scheduledAt) {
    return false;
  }
  const ts = Date.parse(scheduledAt);
  return Number.isFinite(ts) && ts > Date.now() + 60_000;
}

function buildSimulatedUrl(episodeId: string, target: PlatformTarget): string {
  const shortId = episodeId.slice(0, 24);
  switch (target.platform) {
    case "youtube":
      return target.format === "shorts"
        ? `https://youtube.com/shorts/yt-${shortId}`
        : `https://youtube.com/watch?v=yt-${shortId}`;
    case "x":
      return `https://x.com/ridloabelian/status/${shortId}`;
    case "linkedin":
      return `https://www.linkedin.com/feed/update/urn:li:share:${shortId}/`;
    case "instagram":
      return `https://www.instagram.com/p/${shortId}/`;
    case "threads":
      return `https://www.threads.net/@ridloabelian/post/${shortId}`;
    case "whatsapp_channel":
      return `https://whatsapp.com/channel/tabligh/${shortId}`;
    case "emdash":
      return `https://ridlo.id/${target.collection ?? "posts"}/${target.slug ?? shortId}`;
    case "tiktok":
      return `https://www.tiktok.com/@ridloabelian/video/${shortId}`;
  }
}

async function postJson(
  fetchFn: typeof fetch,
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const response = await fetchFn(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }
  return { ok: response.ok, status: response.status, data };
}

function missingCredentialMessage(platform: PlatformId, envKey: string): OfficialApiResult {
  return {
    ok: false,
    outcome: "FAILED",
    message: `Missing required credential ${envKey} for ${platform} Official API transport.`,
    error: `MISSING_CREDENTIAL:${envKey}`,
  };
}

/**
 * Publishes or schedules a platform target through its Official API transport.
 * Supports deterministic simulation in dry-run / demo mode and structured HTTP
 * requests with injectable `fetch` for production & unit tests.
 */
export async function publishViaOfficialApi(
  input: OfficialApiInput,
): Promise<OfficialApiResult> {
  const { episodeId, target } = input;
  const env = input.env ?? process.env;
  const fetchFn = input.fetchFn ?? fetch;
  const scheduled = isFutureSchedule(target.scheduledAt);

  if (input.dryRun) {
    const outcome = scheduled ? "SCHEDULED" : "PUBLISHED";
    return {
      ok: true,
      outcome,
      externalId: `dry_${target.platform}_${episodeId}`,
      publishedUrl: buildSimulatedUrl(episodeId, target),
      message: `[dry-run] ${target.platform}:${target.format} simulated as ${outcome}`,
    };
  }

  try {
    switch (target.platform) {
      case "x": {
        const token = env.X_BEARER_TOKEN;
        if (!token) {
          return missingCredentialMessage("x", "X_BEARER_TOKEN");
        }
        const texts =
          target.format === "thread" && target.threadItems?.length
            ? target.threadItems
            : [target.body];

        let previousTweetId: string | undefined;
        let rootTweetId: string | undefined;

        for (const text of texts) {
          const payload: Record<string, unknown> = { text };
          if (previousTweetId) {
            payload.reply = { in_reply_to_tweet_id: previousTweetId };
          }
          const res = await postJson(
            fetchFn,
            "https://api.x.com/2/tweets",
            { authorization: `Bearer ${token}` },
            payload,
          );
          if (!res.ok) {
            return {
              ok: false,
              outcome: "FAILED",
              message: `X API v2 returned HTTP ${res.status}`,
              error: JSON.stringify(res.data),
            };
          }
          const tweetData = res.data.data as Record<string, unknown> | undefined;
          const tweetId = typeof tweetData?.id === "string" ? tweetData.id : `${episodeId}-post`;
          if (!rootTweetId) {
            rootTweetId = tweetId;
          }
          previousTweetId = tweetId;
        }

        return {
          ok: true,
          outcome: "PUBLISHED",
          externalId: rootTweetId,
          publishedUrl: `https://x.com/i/status/${rootTweetId}`,
          message: `Published X ${target.format} (${texts.length} post${texts.length > 1 ? "s" : ""})`,
        };
      }

      case "linkedin": {
        const token = env.LINKEDIN_ACCESS_TOKEN;
        if (!token) {
          return missingCredentialMessage("linkedin", "LINKEDIN_ACCESS_TOKEN");
        }
        const author = env.LINKEDIN_AUTHOR_URN ?? "urn:li:person:me";
        const res = await postJson(
          fetchFn,
          "https://api.linkedin.com/rest/posts",
          {
            authorization: `Bearer ${token}`,
            "Linkedin-Version": "202502",
            "X-Restli-Protocol-Version": "2.0.0",
          },
          {
            author,
            commentary: target.body,
            visibility: "PUBLIC",
            distribution: { feedDistribution: "MAIN_FEED" },
            lifecycleState: "PUBLISHED",
          },
        );
        if (!res.ok) {
          return {
            ok: false,
            outcome: "FAILED",
            message: `LinkedIn API returned HTTP ${res.status}`,
            error: JSON.stringify(res.data),
          };
        }
        const id = typeof res.data.id === "string" ? res.data.id : `li-${episodeId}`;
        return {
          ok: true,
          outcome: scheduled ? "SCHEDULED" : "PUBLISHED",
          externalId: id,
          publishedUrl: `https://www.linkedin.com/feed/update/${id}/`,
          message: "Dispatched via LinkedIn Posts API",
        };
      }

      case "youtube": {
        const token = env.YOUTUBE_ACCESS_TOKEN;
        if (!token) {
          return missingCredentialMessage("youtube", "YOUTUBE_ACCESS_TOKEN");
        }
        const res = await postJson(
          fetchFn,
          "https://www.googleapis.com/youtube/v3/videos?part=snippet,status",
          { authorization: `Bearer ${token}` },
          {
            snippet: {
              title: target.title ?? episodeId,
              description: target.body,
              tags: target.tags ?? [],
            },
            status: {
              privacyStatus: scheduled ? "private" : "public",
              publishAt: scheduled ? target.scheduledAt : undefined,
            },
          },
        );
        if (!res.ok) {
          return {
            ok: false,
            outcome: "FAILED",
            message: `YouTube Data API returned HTTP ${res.status}`,
            error: JSON.stringify(res.data),
          };
        }
        const id = typeof res.data.id === "string" ? res.data.id : `yt-${episodeId}`;
        return {
          ok: true,
          outcome: scheduled ? "SCHEDULED" : "PUBLISHED",
          externalId: id,
          publishedUrl:
            target.format === "shorts"
              ? `https://youtube.com/shorts/${id}`
              : `https://youtube.com/watch?v=${id}`,
          message: `YouTube Data API ${scheduled ? "scheduled" : "published"}`,
        };
      }

      case "instagram":
      case "threads": {
        const token = env.META_GRAPH_TOKEN;
        if (!token) {
          return missingCredentialMessage(target.platform, "META_GRAPH_TOKEN");
        }
        const accountId =
          target.platform === "instagram"
            ? (env.INSTAGRAM_IG_USER_ID ?? "me")
            : (env.THREADS_USER_ID ?? "me");
        const endpoint =
          target.platform === "instagram"
            ? `https://graph.facebook.com/v22.0/${accountId}/media_publish`
            : `https://graph.threads.net/v1.0/${accountId}/threads_publish`;

        const res = await postJson(
          fetchFn,
          endpoint,
          { authorization: `Bearer ${token}` },
          {
            caption: target.body,
            text: target.body,
            media: target.media ?? [],
            scheduled_publish_time: scheduled ? target.scheduledAt : undefined,
          },
        );
        if (!res.ok) {
          return {
            ok: false,
            outcome: "FAILED",
            message: `Meta Graph API returned HTTP ${res.status}`,
            error: JSON.stringify(res.data),
          };
        }
        const id = typeof res.data.id === "string" ? res.data.id : `${target.platform}-${episodeId}`;
        return {
          ok: true,
          outcome: scheduled ? "SCHEDULED" : "PUBLISHED",
          externalId: id,
          publishedUrl: buildSimulatedUrl(episodeId, target),
          message: `Published via Meta Graph API (${target.platform})`,
        };
      }

      case "whatsapp_channel": {
        const webhookUrl = env.WAFLARE_CHANNEL_WEBHOOK_URL ?? env.WAFLARE_WEBHOOK_URL;
        if (!webhookUrl) {
          return missingCredentialMessage("whatsapp_channel", "WAFLARE_CHANNEL_WEBHOOK_URL");
        }
        const headers: Record<string, string> = {};
        if (env.WAFLARE_AUTH_TOKEN) {
          headers.authorization = `Bearer ${env.WAFLARE_AUTH_TOKEN}`;
        }
        const res = await postJson(fetchFn, webhookUrl, headers, {
          event: "tabligh.whatsapp_channel_broadcast",
          episodeId,
          text: target.body,
          ctaUrl: target.ctaUrl,
          scheduledAt: target.scheduledAt,
        });
        if (!res.ok) {
          return {
            ok: false,
            outcome: "FAILED",
            message: `waflare broadcast webhook returned HTTP ${res.status}`,
            error: JSON.stringify(res.data),
          };
        }
        return {
          ok: true,
          outcome: scheduled ? "SCHEDULED" : "PUBLISHED",
          externalId: typeof res.data.id === "string" ? res.data.id : `wa-${episodeId}`,
          publishedUrl: buildSimulatedUrl(episodeId, target),
          message: "Broadcast sent via waflare WhatsApp webhook",
        };
      }

      case "emdash": {
        const baseUrl = (env.EMDASH_URL ?? "https://ridlo.id").replace(/\/+$/, "");
        const token = env.EMDASH_TOKEN;
        if (!token) {
          return missingCredentialMessage("emdash", "EMDASH_TOKEN");
        }
        const collection = target.collection ?? "posts";
        const slug = target.slug ?? episodeId;
        const res = await postJson(
          fetchFn,
          `${baseUrl}/api/emdash/v1/collections/${collection}/entries`,
          { authorization: `Bearer ${token}` },
          {
            slug,
            status: scheduled ? "scheduled" : "published",
            data: {
              title: target.title ?? episodeId,
              excerpt: target.excerpt ?? "",
              tldr: target.tldr ?? "",
              content: target.body,
            },
          },
        );
        if (!res.ok) {
          return {
            ok: false,
            outcome: "FAILED",
            message: `EmDash CMS API returned HTTP ${res.status}`,
            error: JSON.stringify(res.data),
          };
        }
        const id = typeof res.data.id === "string" ? res.data.id : slug;
        return {
          ok: true,
          outcome: scheduled ? "SCHEDULED" : "PUBLISHED",
          externalId: id,
          publishedUrl: `${baseUrl}/${collection}/${slug}`,
          message: `Published to EmDash CMS (${collection}/${slug})`,
        };
      }

      case "tiktok": {
        return {
          ok: false,
          outcome: "FAILED",
          message: "TikTok is governed by Physical Approval Gate and must route through cdp_draft.",
          error: "CDP_DRAFT_REQUIRED",
        };
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      outcome: "FAILED",
      message: `Transport network error for ${target.platform}: ${message}`,
      error: message,
    };
  }
}
