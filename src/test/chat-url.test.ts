import { describe, expect, it } from "vitest";

import { chatPath, chatSlugFromHost, chatUrlFor, isChatSlug } from "@/lib/chat-url";

describe("chat addresses", () => {
  it("accepts short random ids and rejects reserved or malformed ones", () => {
    expect(isChatSlug("a1b2c3d4")).toBe(true);
    expect(isChatSlug("abcdef")).toBe(true);
    expect(isChatSlug("api-app")).toBe(false);
    expect(isChatSlug("admin")).toBe(false);
    expect(isChatSlug("UPPER")).toBe(false);
    expect(isChatSlug("ab")).toBe(false);
  });

  it("reads the chat id from a subdomain but not from an apex host", () => {
    expect(chatSlugFromHost("a1b2c3d4.example.com")).toBe("a1b2c3d4");
    expect(chatSlugFromHost("a1b2c3d4.localhost")).toBe("a1b2c3d4");
    expect(chatSlugFromHost("example.com")).toBeNull();
    expect(chatSlugFromHost("www.example.com")).toBeNull();
    expect(chatSlugFromHost("api.example.com")).toBeNull();
    expect(chatSlugFromHost("127.0.0.1")).toBeNull();
    expect(chatSlugFromHost("localhost")).toBeNull();
  });

  it("builds shareable path links when no base domain is configured", () => {
    expect(chatPath("a1b2c3d4")).toBe("/c/a1b2c3d4");
    expect(chatUrlFor("a1b2c3d4")).toBe(`${window.location.origin}/c/a1b2c3d4`);
    expect(chatUrlFor(null)).toBe(`${window.location.origin}/`);
  });
});
