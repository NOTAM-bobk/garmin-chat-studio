import { describe, expect, it } from "vitest";

import { CURATED_MODELS, isVisionModel, pickVisionModel } from "@/lib/models";

describe("vision model picker", () => {
  it("treats multimodal families as vision capable", () => {
    expect(isVisionModel("gpt-5.6")).toBe(true);
    expect(isVisionModel("claude-sonnet-5")).toBe(true);
    expect(isVisionModel("gemini-4-argon")).toBe(true);
  });

  it("excludes tiny tiers and non-chat models", () => {
    expect(isVisionModel("gpt-5.4-nano")).toBe(false);
    expect(isVisionModel("gemini-3.1-flash-lite")).toBe(false);
    expect(isVisionModel("dall-e-3")).toBe(false);
  });

  it("keeps a current vision model and otherwise switches", () => {
    expect(pickVisionModel("claude-sonnet-5", CURATED_MODELS)).toBe("claude-sonnet-5");
    expect(pickVisionModel("gpt-5.4-nano", CURATED_MODELS)).toBe("gpt-5.6");
  });
});
