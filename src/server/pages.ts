import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { pages, users, views } from "@/db/schema";
import { slugify, SLUG_PATTERN } from "@/shared/text";
import { AppError, requireBlog, type BlogAccess, type Viewer } from "./access";

export const savePageInput = z.object({
  blogId: z.string().min(1),
  pageId: z.string().optional(),
  title: z.string().trim().min(1, "Give the page a title.").max(200),
  slug: z
    .string()
    .trim()
    .max(80)
    .refine(
      (value) => value === "" || SLUG_PATTERN.test(value),
      "Use lowercase letters, digits and hyphens in the address.",
    ),
  body: z.string().max(200_000),
  action: z.enum(["draft", "publish", "update", "revert"]),
});

export const pageRef = z.object({
  blogId: z.string().min(1),
  pageId: z.string().min(1),
});

function canEdit(access: BlogAccess, user: Viewer, authorId: string) {
  return access.isAdmin || authorId === user.id;
}

export async function listPages(user: Viewer, blogId: string) {
  const access = await requireBlog(user, blogId);
  const rows = await db
    .select({
      id: pages.id,
      title: pages.title,
      slug: pages.slug,
      status: pages.status,
      updatedAt: pages.updatedAt,
      authorId: pages.authorId,
      author: users.email,
      navPosition: pages.navPosition,
    })
    .from(pages)
    .leftJoin(users, eq(users.id, pages.authorId))
    .where(eq(pages.blogId, blogId))
    .orderBy(desc(pages.updatedAt));
  return {
    access,
    pages: rows.map(({ authorId, ...row }) => ({
      ...row,
      author: row.author ?? "",
      canEdit: canEdit(access, user, authorId),
    })),
  };
}

export async function getPage(user: Viewer, blogId: string, pageId: string) {
  const access = await requireBlog(user, blogId);
  const [page] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.blogId, blogId)));
  if (!page) return null;
  return {
    access,
    page: {
      id: page.id,
      title: page.title,
      slug: page.slug,
      body: page.body,
      status: page.status,
    },
    canEdit: canEdit(access, user, page.authorId),
  };
}

export async function savePage(
  user: Viewer,
  input: z.infer<typeof savePageInput>,
) {
  const access = await requireBlog(user, input.blogId);
  const now = Date.now();
  let existing: typeof pages.$inferSelect | undefined;
  if (input.pageId) {
    [existing] = await db
      .select()
      .from(pages)
      .where(and(eq(pages.id, input.pageId), eq(pages.blogId, input.blogId)));
    if (!existing) throw new AppError("Page not found.");
    if (!canEdit(access, user, existing.authorId))
      throw new AppError("Only the page's author or a blog admin can change it.");
  }
  const taken = await db
    .select({ slug: pages.slug })
    .from(pages)
    .where(
      and(
        eq(pages.blogId, input.blogId),
        input.pageId ? ne(pages.id, input.pageId) : undefined,
      ),
    );
  const used = new Set(taken.map((row) => row.slug));
  let slug = input.slug;
  if (slug) {
    if (used.has(slug))
      throw new AppError("Another page in this blog already uses that address.");
  } else {
    const base = slugify(input.title) || "page";
    slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
  }
  let status = existing?.status ?? "draft";
  let navPosition = existing?.navPosition ?? null;
  if (input.action === "draft" || input.action === "revert") {
    status = "draft";
    navPosition = null;
  } else if (input.action === "publish") status = "published";

  const id = existing?.id ?? crypto.randomUUID();
  const values = {
    title: input.title,
    slug,
    body: input.body,
    status,
    navPosition,
    updatedAt: now,
  };
  if (existing) await db.update(pages).set(values).where(eq(pages.id, id));
  else
    await db.insert(pages).values({
      ...values,
      id,
      blogId: input.blogId,
      authorId: user.id,
      createdAt: now,
    });
  return { id, status };
}

export async function deletePage(
  user: Viewer,
  { blogId, pageId }: z.infer<typeof pageRef>,
) {
  const found = await getPage(user, blogId, pageId);
  if (!found) throw new AppError("Page not found.");
  if (!found.canEdit)
    throw new AppError("Only the page's author or a blog admin can delete it.");
  await db.batch([
    db.delete(pages).where(eq(pages.id, pageId)),
    db
      .delete(views)
      .where(and(eq(views.kind, "page"), eq(views.targetId, pageId))),
  ]);
  return { ok: true };
}
