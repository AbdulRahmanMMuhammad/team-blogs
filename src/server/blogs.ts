import { and, asc, eq, isNotNull } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { isAdmin } from "@every-app/sdk/server";
import { z } from "zod";
import { db } from "@/db";
import { blogMembers, blogs, media, pages } from "@/db/schema";
import { SLUG_PATTERN } from "@/shared/text";
import {
  AppError,
  requireBlog,
  requireBlogAdmin,
  type Viewer,
} from "./access";

const slug = z
  .string()
  .trim()
  .min(1, "Give the blog an address.")
  .max(60, "Keep the address under 60 characters.")
  .regex(SLUG_PATTERN, "Use lowercase letters, digits and hyphens only.");

export const createBlogInput = z.object({
  title: z.string().trim().min(1, "Give the blog a title.").max(120),
  slug,
  description: z.string().trim().max(500).default(""),
});

export const updateBlogInput = createBlogInput.extend({
  blogId: z.string().min(1),
  access: z.enum(["public", "team"]),
  commentPolicy: z.enum(["anyone", "members", "nobody"]),
  moderation: z.enum(["hold", "publish"]),
});

export const navigationInput = z.object({
  blogId: z.string().min(1),
  pageIds: z.array(z.string()).max(50),
});

export async function listMyBlogs(user: Viewer) {
  const orgAdmin = isAdmin(user);
  const rows = await db
    .select({
      id: blogs.id,
      title: blogs.title,
      slug: blogs.slug,
      description: blogs.description,
      access: blogs.access,
      role: blogMembers.role,
    })
    .from(blogs)
    .leftJoin(
      blogMembers,
      and(eq(blogMembers.blogId, blogs.id), eq(blogMembers.userId, user.id)),
    )
    .where(eq(blogs.orgId, user.orgId))
    .orderBy(asc(blogs.title));
  return rows
    .filter((row) => row.role !== null || orgAdmin)
    .map((row) => ({ ...row, role: row.role ?? "admin" }));
}

async function slugTaken(value: string, exceptId?: string) {
  const [row] = await db
    .select({ id: blogs.id })
    .from(blogs)
    .where(eq(blogs.slug, value));
  return row !== undefined && row.id !== exceptId;
}

export async function createBlog(
  user: Viewer,
  input: z.infer<typeof createBlogInput>,
) {
  if (await slugTaken(input.slug))
    throw new AppError("That address is taken. Try another.");
  const id = crypto.randomUUID();
  try {
    await db.batch([
      db.insert(blogs).values({
        id,
        orgId: user.orgId,
        slug: input.slug,
        title: input.title,
        description: input.description,
        createdBy: user.id,
        createdAt: Date.now(),
      }),
      db
        .insert(blogMembers)
        .values({ blogId: id, userId: user.id, role: "admin" }),
    ]);
  } catch (error) {
    if (await slugTaken(input.slug))
      throw new AppError("That address is taken. Try another.");
    throw error;
  }
  return { id };
}

export async function updateBlog(
  user: Viewer,
  { blogId, ...change }: z.infer<typeof updateBlogInput>,
) {
  await requireBlogAdmin(user, blogId);
  if (await slugTaken(change.slug, blogId))
    throw new AppError("That address is taken. Try another.");
  await db.update(blogs).set(change).where(eq(blogs.id, blogId));
  return { ok: true };
}

/** Deletes the blog, everything in it (by cascade) and its images. */
export async function deleteBlog(user: Viewer, blogId: string) {
  await requireBlogAdmin(user, blogId);
  const files = await db
    .select({ id: media.id })
    .from(media)
    .where(eq(media.blogId, blogId));
  await db.delete(blogs).where(eq(blogs.id, blogId));
  if (files.length)
    await env.media.delete(files.map((file) => mediaKey(blogId, file.id)));
  return { ok: true };
}

export function mediaKey(blogId: string, mediaId: string) {
  return `${blogId}/${mediaId}`;
}

export async function getSettings(user: Viewer, blogId: string) {
  const access = await requireBlog(user, blogId);
  const published = await db
    .select({ id: pages.id, title: pages.title, navPosition: pages.navPosition })
    .from(pages)
    .where(and(eq(pages.blogId, blogId), eq(pages.status, "published")))
    .orderBy(asc(pages.createdAt));
  return { access, pages: published };
}

/** Shows exactly the given published pages in the navigation, in that order. */
export async function saveNavigation(
  user: Viewer,
  { blogId, pageIds }: z.infer<typeof navigationInput>,
) {
  await requireBlogAdmin(user, blogId);
  await db.batch([
    db
      .update(pages)
      .set({ navPosition: null })
      .where(and(eq(pages.blogId, blogId), isNotNull(pages.navPosition))),
    ...pageIds.map((id, position) =>
      db
        .update(pages)
        .set({ navPosition: position })
        .where(
          and(
            eq(pages.id, id),
            eq(pages.blogId, blogId),
            eq(pages.status, "published"),
          ),
        ),
    ),
  ]);
  return { ok: true };
}

/** The published pages in a blog's navigation, in order. */
export function navigationPages(blogId: string) {
  return db
    .select({ title: pages.title, slug: pages.slug })
    .from(pages)
    .where(
      and(
        eq(pages.blogId, blogId),
        eq(pages.status, "published"),
        isNotNull(pages.navPosition),
      ),
    )
    .orderBy(asc(pages.navPosition));
}

