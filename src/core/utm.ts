import type { PlatformId, PublishBundle } from "../types.js";

const URL_REGEX = /https?:\/\/[^\s<>"'`]+/g;
const TRAILING_PUNCTUATION = new Set([".", ",", ";", ":", "!", "?", "]", "}"]);

/**
 * Injects standardized edge-funnel attribution parameters onto an HTTP/HTTPS URL
 * idempotently, preserving existing unrelated query parameters and hash fragments.
 */
export function injectEdgeFunnelParams(
  rawUrl: string,
  platform: PlatformId,
  episodeId: string,
): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return rawUrl;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return rawUrl;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return rawUrl;
  }

  parsed.searchParams.set("utm_source", platform);
  parsed.searchParams.set("utm_medium", "social");
  parsed.searchParams.set("utm_campaign", episodeId);
  parsed.searchParams.set("ef_ep", episodeId);

  return parsed.toString();
}

function splitUrlAndTrailingPunctuation(token: string): { url: string; suffix: string } {
  let end = token.length;

  while (end > 0) {
    const ch = token.charAt(end - 1);
    if (TRAILING_PUNCTUATION.has(ch)) {
      end -= 1;
      continue;
    }

    if (ch === ")") {
      const candidate = token.slice(0, end);
      const openCount = (candidate.match(/\(/g) ?? []).length;
      const closeCount = (candidate.match(/\)/g) ?? []).length;
      if (closeCount > openCount) {
        end -= 1;
        continue;
      }
    }

    break;
  }

  return {
    url: token.slice(0, end),
    suffix: token.slice(end),
  };
}

/**
 * Rewrites all inline HTTP/HTTPS URLs within prose text to include edge-funnel
 * UTM and `ef_ep` parameters while keeping surrounding prose punctuation intact.
 */
export function injectUtmIntoText(
  text: string,
  platform: PlatformId,
  episodeId: string,
): string {
  return text.replace(URL_REGEX, (match) => {
    const { url, suffix } = splitUrlAndTrailingPunctuation(match);
    const enriched = injectEdgeFunnelParams(url, platform, episodeId);
    return `${enriched}${suffix}`;
  });
}

/**
 * Deep-clones a PublishBundle and enriches every target's `ctaUrl`, `body`, and
 * `threadItems` with standardized edge-funnel attribution parameters.
 */
export function enrichBundleWithUtm(bundle: PublishBundle): PublishBundle {
  const cloned = structuredClone(bundle);

  cloned.targets = cloned.targets.map((target) => {
    const next = { ...target };
    if (next.ctaUrl) {
      next.ctaUrl = injectEdgeFunnelParams(next.ctaUrl, next.platform, cloned.episodeId);
    }
    if (next.body) {
      next.body = injectUtmIntoText(next.body, next.platform, cloned.episodeId);
    }
    if (next.threadItems && next.threadItems.length > 0) {
      next.threadItems = next.threadItems.map((item) =>
        injectUtmIntoText(item, next.platform, cloned.episodeId),
      );
    }
    return next;
  });

  return cloned;
}
