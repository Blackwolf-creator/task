import { describe, expect, it } from "vitest";

import { detectPlatformFromUrl, isValidPostUrlForPlatform } from "./post-url";

describe("detectPlatformFromUrl", () => {
  it.each([
    ["https://www.tiktok.com/@alice/video/7123456789012345678", "tiktok"],
    ["https://tiktok.com/@bob.creator/video/12345678901234", "tiktok"],
    ["https://vm.tiktok.com/ZMabcdefg/", "tiktok"],
    ["https://www.instagram.com/reel/CxAbCdEfGhI/", "instagram"],
    ["https://instagram.com/p/CxAbCdEfGhI/", "instagram"],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube"],
    ["https://youtube.com/shorts/dQw4w9WgXcQ", "youtube"],
    ["https://youtu.be/dQw4w9WgXcQ", "youtube"],
  ])("detects %s as %s", (url, expected) => {
    expect(detectPlatformFromUrl(url)).toBe(expected);
  });

  it.each([
    "https://www.tiktok.com/@alice",
    "https://www.instagram.com/alice/",
    "https://www.youtube.com/@channel",
    "https://example.com/not-a-post",
    "not a url at all",
    "",
  ])("rejects %s", (url) => {
    expect(detectPlatformFromUrl(url)).toBeNull();
  });
});

describe("isValidPostUrlForPlatform", () => {
  it("rejects a URL that matches a different platform", () => {
    expect(
      isValidPostUrlForPlatform(
        "https://youtu.be/dQw4w9WgXcQ",
        "tiktok",
      ),
    ).toBe(false);
  });

  it("accepts a matching platform", () => {
    expect(
      isValidPostUrlForPlatform(
        "https://youtu.be/dQw4w9WgXcQ",
        "youtube",
      ),
    ).toBe(true);
  });
});
