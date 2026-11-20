import { describe, expect, it } from "vitest";
import {
  enrichBundleWithUtm,
  injectEdgeFunnelParams,
  injectUtmIntoText,
} from "../src/core/utm.js";
import type { PublishBundle } from "../src/types.js";

describe("edge-funnel UTM & ef_ep attribution", () => {
  it("injects required attribution params on bare and complex URLs", () => {
    const bare = injectEdgeFunnelParams(
      "https://ridlo.id/posts/wakaf-produktif",
      "x",
      "ep-2026-wakaf",
    );
    const parsedBare = new URL(bare);
    expect(parsedBare.searchParams.get("utm_source")).toBe("x");
    expect(parsedBare.searchParams.get("utm_medium")).toBe("social");
    expect(parsedBare.searchParams.get("utm_campaign")).toBe("ep-2026-wakaf");
    expect(parsedBare.searchParams.get("ef_ep")).toBe("ep-2026-wakaf");

    const complex = injectEdgeFunnelParams(
      "https://ridlo.id/posts/wakaf?ref=bio&utm_source=old#section-2",
      "linkedin",
      "ep-2026-wakaf",
    );
    const parsedComplex = new URL(complex);
    expect(parsedComplex.searchParams.get("ref")).toBe("bio");
    expect(parsedComplex.searchParams.get("utm_source")).toBe("linkedin");
    expect(parsedComplex.searchParams.get("ef_ep")).toBe("ep-2026-wakaf");
    expect(parsedComplex.hash).toBe("#section-2");
  });

  it("rewrites inline URLs inside prose while keeping trailing punctuation intact", () => {
    const input =
      "Baca lengkapnya di https://ridlo.id/posts/wakaf-produktif. Atau kunjungi (https://ridlo.id/notes/zk-041)!";
    const out = injectUtmIntoText(input, "threads", "ep-01");
    expect(out).toContain(
      "https://ridlo.id/posts/wakaf-produktif?utm_source=threads&utm_medium=social&utm_campaign=ep-01&ef_ep=ep-01.",
    );
    expect(out).toContain(
      "(https://ridlo.id/notes/zk-041?utm_source=threads&utm_medium=social&utm_campaign=ep-01&ef_ep=ep-01)!",
    );
  });

  it("is strictly idempotent across repeated enrichBundleWithUtm calls", () => {
    const bundle: PublishBundle = {
      schemaVersion: "1.0",
      episodeId: "ep-idemp",
      title: "Test Bundle",
      pillar: "Tabligh",
      sourceType: "manual",
      targets: [
        {
          platform: "x",
          format: "thread",
          body: "Check https://ridlo.id/posts/a",
          threadItems: ["Item 1 https://ridlo.id/posts/a", "Item 2"],
          ctaUrl: "https://ridlo.id/posts/a",
        },
      ],
    };

    const once = enrichBundleWithUtm(bundle);
    const twice = enrichBundleWithUtm(once);
    expect(twice).toEqual(once);
    expect(twice.targets[0]?.ctaUrl?.match(/ef_ep=/g)?.length).toBe(1);
  });
});
