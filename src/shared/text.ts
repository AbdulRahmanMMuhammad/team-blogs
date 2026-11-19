export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** "Day one: Maple Pass!" as "day-one-maple-pass". */
export function slugify(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Comma-separated labels, trimmed, without blanks or repeats (case-insensitive). */
export function parseLabels(input: string): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const raw of input.split(",")) {
    const label = raw.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    labels.push(label);
  }
  return labels.slice(0, 20);
}

export type PostState = "draft" | "scheduled" | "published";

export function postState(
  status: string,
  publishedAt: number | null,
  now = Date.now(),
): PostState {
  if (status !== "published") return "draft";
  return publishedAt !== null && publishedAt > now ? "scheduled" : "published";
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

/** The host of a Referer, or null for none, a malformed one, or the app's own host. */
export function referrerHost(
  referer: string | null,
  ownHost: string,
): string | null {
  if (!referer) return null;
  try {
    const url = new URL(referer);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    return host === ownHost.toLowerCase() ? null : host;
  } catch {
    return null;
  }
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
];
