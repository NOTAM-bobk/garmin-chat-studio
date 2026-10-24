import { describe, expect, it } from "vitest";

import {
  WEB_TURN_LIMIT,
  WEB_WINDOW_LIMIT,
  WEB_WINDOW_MS,
  describeWebTool,
  isCitationLabel,
  isWebTool,
  pruneWebCalls,
  sourceDomain,
  webLimitReason,
  webTools,
} from "@/lib/web";

describe("web research helpers", () => {
  it("exposes a search and a read tool", () => {
    expect(webTools.map((tool) => tool.function.name)).toEqual(["web_search", "web_read"]);
    expect(isWebTool("web_search")).toBe(true);
    expect(isWebTool("web_read")).toBe(true);
    expect(isWebTool("get_sleep_summary")).toBe(false);
  });

  it("labels the trace rows", () => {
    expect(describeWebTool("web_search", { query: "80/20 running" })).toEqual({
      label: "Searching the web",
      detail: "80/20 running",
    });
    expect(describeWebTool("web_read", { url: "https://www.react.dev/learn" }).label).toBe(
      "Reading react.dev",
    );
  });

  it("only renders bare domains as citation chips", () => {
    expect(isCitationLabel("react.dev")).toBe(true);
    expect(isCitationLabel("developer.mozilla.org")).toBe(true);
    expect(isCitationLabel("The docs")).toBe(false);
    expect(isCitationLabel("react.dev/learn")).toBe(false);
    expect(sourceDomain("https://www.react.dev/learn")).toBe("react.dev");
  });
});

describe("web lookup rate limit", () => {
  const now = 1_000_000_000;

  it("allows a lookup before either budget is spent", () => {
    expect(webLimitReason(0, [], now)).toBeNull();
    expect(webLimitReason(WEB_TURN_LIMIT - 1, [now - 1000], now)).toBeNull();
  });

  it("stops an answer that has used its lookups", () => {
    const reason = webLimitReason(WEB_TURN_LIMIT, [], now);
    expect(reason).toContain("paused for this answer");
    expect(reason).toContain(String(WEB_TURN_LIMIT));
  });

  it("stops a burst once the rolling window is full", () => {
    const calls = Array.from({ length: WEB_WINDOW_LIMIT }, (_, index) => now - index * 1000);
    const reason = webLimitReason(0, calls, now);
    expect(reason).toContain("rate limited");
    expect(reason).toContain(String(WEB_WINDOW_LIMIT));
    expect(reason).toMatch(/minute/);
  });

  it("forgets lookups older than the window", () => {
    const stale = Array.from({ length: WEB_WINDOW_LIMIT }, () => now - WEB_WINDOW_MS - 1);
    expect(pruneWebCalls(stale, now)).toEqual([]);
    expect(webLimitReason(0, stale, now)).toBeNull();
    expect(pruneWebCalls([now - 500, now - WEB_WINDOW_MS], now)).toEqual([now - 500]);
  });
});
