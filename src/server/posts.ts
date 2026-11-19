import { and, asc, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { postLabels, posts, users, views } from "@/db/schema";
import { parseLabels, postState, slugify, SLUG_PATTERN } from "@/shared/text";
import { AppError, requireBlog, type BlogAccess, type Viewer } from "./access";

export const savePostInput = z.object({
  blogId: z.string().min(1),
  postId: z.string().optional(),
  title: z.string().trim().min(1, "Give the post a title.").max(200),
  slug: z
    .string()
    .trim()
    .max(80)
    .refine(
      (value) => value === "" || SLUG_PATTERN.test(value),
      "Use lowercase letters, digits and hyphens in the address.",
    ),
  body: z.string().max(200_000),
  labels: z.string().max(1000),
  /** ISO date for scheduling; ignored by other actions. */
  publishAt: z.string().optional(),
  action: z.enum(["draft", "publish", "schedule", "update", "revert"]),
});

export const postRef = z.object({
  blogId: z.string().min(1),
  postId: z.string().min(1),
});

function canEdit(access: BlogAccess, user: Viewer, authorId: string) {
  return access.isAdmin || authorId === user.id;
}

export async function listPosts(user: Viewer, blogId: string) {
  const access = await requireBlog(user, blogId);
  const rows = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      status: posts.status,
      publishedAt: posts.publishedAt,
      updatedAt: posts.updatedAt,
      authorId: posts.authorId,
      author: users.email,
    })
    .from(posts)
    .leftJoin(users, eq(users.id, posts.authorId))
    .where(eq(posts.blogId, blogId))
    .orderBy(desc(posts.updatedAt));
  const labels = await db
    .select({ postId: postLabels.postId, label: postLabels.label })
    .from(postLabels)
    .where(eq(postLabels.blogId, blogId))
    .orderBy(asc(postLabels.label));
  const now = Date.now();
  return {
    access,
    posts: rows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      state: postState(row.status, row.publishedAt, now),
      publishedAt: row.publishedAt,
      updatedAt: row.updatedAt,
      author: row.author ?? "",
      canEdit: canEdit(access, user, row.authorId),
      labels: labels.filter((l) => l.postId === row.id).map((l) => l.label),
    })),
  };
}

export async function getPost(user: Viewer, blogId: string, postId: string) {
  const access = await requireBlog(user, blogId);
  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.blogId, blogId)));
  if (!post) return null;
  const labels = await db
    .select({ label: postLabels.label })
    .from(postLabels)
    .where(eq(postLabels.postId, postId));
  return {
    access,
    post: {
      id: post.id,
      title: post.title,
      slug: post.slug,
      body: post.body,
      publishedAt: post.publishedAt,
      state: postState(post.status, post.publishedAt),
      labels: labels.map((l) => l.label),
    },
    canEdit: canEdit(access, user, post.authorId),
  };
}

async function usedSlugs(blogId: string, postId?: string) {
  const taken = await db
    .select({ slug: posts.slug })
    .from(posts)
    .where(
      and(eq(posts.blogId, blogId), postId ? ne(posts.id, postId) : undefined),
    );
  return new Set(taken.map((row) => row.slug));
}

export async function savePost(
  user: Viewer,
  input: z.infer<typeof savePostInput>,
) {
  const access = await requireBlog(user, input.blogId);
  const now = Date.now();
  let existing: typeof posts.$inferSelect | undefined;
  if (input.postId) {
    [existing] = await db
      .select()
      .from(posts)
      .where(and(eq(posts.id, input.postId), eq(posts.blogId, input.blogId)));
    if (!existing) throw new AppError("Post not found.");
    if (!canEdit(access, user, existing.authorId))
      throw new AppError("Only the post's author or a blog admin can change it.");
  }

  const used = await usedSlugs(input.blogId, input.postId);
  let slug = input.slug;
  if (slug) {
    if (used.has(slug))
      throw new AppError("Another post in this blog already uses that address.");
  } else {
    const base = slugify(input.title) || "post";
    slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
  }

  let status = existing?.status ?? "draft";
  let publishedAt = existing?.publishedAt ?? null;
  switch (input.action) {
    case "draft":
      status = "draft";
      break;
    case "revert":
      status = "draft";
      publishedAt = null;
      break;
    case "publish":
      status = "published";
      publishedAt = now;
      break;
    case "schedule":
    case "update": {
      if (input.action === "update" && status !== "published") break;
      const when = input.publishAt ? Date.parse(input.publishAt) : NaN;
      if (input.action === "schedule") {
        if (Number.isNaN(when) || when <= now)
          throw new AppError("Pick a publish date in the future.");
        status = "published";
        publishedAt = when;
      } else if (!Number.isNaN(when)) {
        publishedAt = when;
      }
      break;
    }
  }

  const id = existing?.id ?? crypto.randomUUID();
  const labels = parseLabels(input.labels);
  const values = {
    title: input.title,
    slug,
    body: input.body,
    status,
    publishedAt,
    updatedAt: now,
  };
  await db.batch([
    existing
      ? db.update(posts).set(values).where(eq(posts.id, id))
      : db.insert(posts).values({
          ...values,
          id,
          blogId: input.blogId,
          authorId: user.id,
          createdAt: now,
        }),
    db.delete(postLabels).where(eq(postLabels.postId, id)),
    ...labels.map((label) =>
      db.insert(postLabels).values({ postId: id, blogId: input.blogId, label }),
    ),
  ]);
  return { id, state: postState(status, publishedAt, now) };
}

export async function deletePost(
  user: Viewer,
  { blogId, postId }: z.infer<typeof postRef>,
) {
  const found = await getPost(user, blogId, postId);
  if (!found) throw new AppError("Post not found.");
  if (!found.canEdit)
    throw new AppError("Only the post's author or a blog admin can delete it.");
  await db.batch([
    db.delete(posts).where(eq(posts.id, postId)),
    db
      .delete(views)
      .where(and(eq(views.kind, "post"), eq(views.targetId, postId))),
  ]);
  return { ok: true };
}

