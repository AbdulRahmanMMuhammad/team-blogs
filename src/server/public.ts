import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { blogs, comments, media, pages, postLabels, posts } from "@/db/schema";
import { canRead, type Blog, type Viewer } from "./access";
import { navigationPages } from "./blogs";

export const PAGE_SIZE = 10;

/** The blog when this reader may open it, with whether they're on its team; null otherwise. */
export async function readableBlog(slug: string, user: Viewer | null) {
  const [blog] = await db.select().from(blogs).where(eq(blogs.slug, slug));
  if (!blog) return null;
  const { allowed, team } = await canRead(blog, user);
  return allowed ? { blog, team } : null;
}

const live = (now: number) =>
  and(eq(posts.status, "published"), lte(posts.publishedAt, now));

async function withLabels<T extends { id: string }>(rows: T[]) {
  if (!rows.length) return rows.map((row) => ({ ...row, labels: [] as string[] }));
  const labels = await db
    .select({ postId: postLabels.postId, label: postLabels.label })
    .from(postLabels)
    .where(inArray(postLabels.postId, rows.map((row) => row.id)))
    .orderBy(asc(postLabels.label));
  return rows.map((row) => ({
    ...row,
    labels: labels.filter((l) => l.postId === row.id).map((l) => l.label),
  }));
}

/** Live posts newest first, one page at a time, optionally with one label. */
export async function livePosts(blog: Blog, page: number, label?: string) {
  const now = Date.now();
  const where = and(
    eq(posts.blogId, blog.id),
    live(now),
    label
      ? inArray(
          posts.id,
          db
            .select({ id: postLabels.postId })
            .from(postLabels)
            .where(and(eq(postLabels.blogId, blog.id), eq(postLabels.label, label))),
        )
      : undefined,
  );
  const rows = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      body: posts.body,
      publishedAt: posts.publishedAt,
    })
    .from(posts)
    .where(where)
    .orderBy(desc(posts.publishedAt), desc(posts.id))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);
  return {
    posts: await withLabels(rows.slice(0, PAGE_SIZE)),
    hasMore: rows.length > PAGE_SIZE,
  };
}

/** Labels used by the blog's live posts, with counts. */
export async function liveLabels(blog: Blog) {
  return db
    .select({ label: postLabels.label, posts: sql<number>`count(*)` })
    .from(postLabels)
    .innerJoin(posts, eq(posts.id, postLabels.postId))
    .where(and(eq(postLabels.blogId, blog.id), live(Date.now())))
    .groupBy(postLabels.label)
    .orderBy(asc(postLabels.label));
}

export async function livePost(blog: Blog, slug: string) {
  const [post] = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      body: posts.body,
      publishedAt: posts.publishedAt,
    })
    .from(posts)
    .where(and(eq(posts.blogId, blog.id), eq(posts.slug, slug), live(Date.now())));
  if (!post) return null;
  const [withLabel] = await withLabels([post]);
  return withLabel!;
}

export function approvedComments(postId: string) {
  return db
    .select({
      id: comments.id,
      authorName: comments.authorName,
      body: comments.body,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .where(and(eq(comments.postId, postId), eq(comments.status, "published")))
    .orderBy(asc(comments.createdAt), asc(comments.id));
}

export async function addComment(comment: {
  blog: Blog;
  postId: string;
  authorName: string;
  userId: string | null;
  body: string;
}) {
  const status = comment.blog.moderation === "publish" ? "published" : "pending";
  await db.insert(comments).values({
    id: crypto.randomUUID(),
    blogId: comment.blog.id,
    postId: comment.postId,
    authorName: comment.authorName,
    userId: comment.userId,
    body: comment.body,
    status,
    createdAt: Date.now(),
  });
  return status;
}

export async function livePage(blog: Blog, slug: string) {
  const [page] = await db
    .select({ id: pages.id, title: pages.title, body: pages.body })
    .from(pages)
    .where(
      and(eq(pages.blogId, blog.id), eq(pages.slug, slug), eq(pages.status, "published")),
    );
  return page ?? null;
}

export async function mediaFile(mediaId: string) {
  const [file] = await db
    .select({ blogId: media.blogId, contentType: media.contentType })
    .from(media)
    .where(eq(media.id, mediaId));
  return file ?? null;
}

export { navigationPages };
