import { describe, expect, it } from "vitest";

import { parseFollowups } from "@/lib/puter";

describe("parseFollowups", () => {
  it("reads a JSON array", () => {
    expect(
      parseFollowups(
        '["How does that compare with last month?", "What should I change tomorrow?"]',
      ),
    ).toEqual(["How does that compare with last month?", "What should I change tomorrow?"]);
  });

  it("reads bullets and caps at two", () => {
    expect(
      parseFollowups("- Which run was hardest?\n- How is my sleep trending?\n- Third one"),
    ).toEqual(["Which run was hardest?", "How is my sleep trending?"]);
  });

  it("ignores empty replies", () => {
    expect(parseFollowups("")).toEqual([]);
  });
});
