import { env } from "cloudflare:workers";
import { getEveryAppUser } from "@every-app/sdk/server";
import { referrerHost } from "@/shared/text";
import type { Viewer } from "./access";
import { readableBlog } from "./public";
import { recordView } from "./stats";

/** Who is reading (null for anyone not signed in) and the blog, when they may open it. */
export async function openBlog(request: Request, slug: string) {
  const user: Viewer | null = await getEveryAppUser(request, env);
  const found = await readableBlog(slug, user);
  return found ? { ...found, user } : null;
}

/** Counts a reader's view; the blog's own team isn't counted. */
export async function countView(
  request: Request,
  found: { blog: { id: string }; team: boolean },
  kind: "home" | "post" | "page",
  targetId: string | null,
) {
  if (found.team) return;
  const referrer = referrerHost(
    request.headers.get("referer"),
    new URL(request.url).hostname,
  );
  await recordView({ blogId: found.blog.id, kind, targetId, referrer });
}

export function pageNumber(request: Request) {
  const value = Number(new URL(request.url).searchParams.get("page") ?? "1");
  return Number.isInteger(value) && value >= 1 && value <= 10_000 ? value : 1;
}

export function param(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
