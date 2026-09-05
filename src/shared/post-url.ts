export const PLATFORMS = ["tiktok", "instagram", "youtube"] as const;

export type Platform = (typeof PLATFORMS)[number];

const TIKTOK_PATTERNS = [
  /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d{5,}(\?.*)?$/i,
  /^https?:\/\/vm\.tiktok\.com\/[\w-]{5,}\/?$/i,
  /^https?:\/\/(www\.)?tiktok\.com\/t\/[\w-]{5,}\/?$/i,
];

const INSTAGRAM_PATTERNS = [
  /^https?:\/\/(www\.)?instagram\.com\/(reel|p|tv)\/[\w-]{5,}\/?(\?.*)?$/i,
];

const YOUTUBE_PATTERNS = [
  /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]{6,}(&.*)?$/i,
  /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]{6,}(\?.*)?$/i,
  /^https?:\/\/youtu\.be\/[\w-]{6,}(\?.*)?$/i,
];

const PATTERNS_BY_PLATFORM: Record<Platform, RegExp[]> = {
  tiktok: TIKTOK_PATTERNS,
  instagram: INSTAGRAM_PATTERNS,
  youtube: YOUTUBE_PATTERNS,
};

function matchesAny(url: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(url));
}

/**
 * Detects which supported platform a post URL belongs to, based on
 * platform-specific URL shape (not just the hostname). Returns null when
 * the URL doesn't look like a real post on any supported platform.
 */
export function detectPlatformFromUrl(url: string): Platform | null {
  const trimmed = url.trim();

  for (const platform of PLATFORMS) {
    if (matchesAny(trimmed, PATTERNS_BY_PLATFORM[platform])) {
      return platform;
    }
  }

  return null;
}

export function isValidPostUrlForPlatform(
  url: string,
  platform: Platform,
): boolean {
  return matchesAny(url.trim(), PATTERNS_BY_PLATFORM[platform]);
}
