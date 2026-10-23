import { describe, expect, it } from "vitest";

import { describeWebTool, isCitationLabel, isWebTool, sourceDomain, webTools } from "@/lib/web";

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
