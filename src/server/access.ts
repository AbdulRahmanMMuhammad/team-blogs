import { and, eq } from "drizzle-orm";
import { isAdmin, type EveryAppUser } from "@every-app/sdk/server";
import { db } from "@/db";
import { blogMembers, blogs, users } from "@/db/schema";

export type Viewer = Pick<EveryAppUser, "id" | "email" | "orgId" | "orgRole">;
export type Blog = typeof blogs.$inferSelect;
export type BlogRole = "admin" | "author";

export interface BlogAccess {
  blog: Blog;
  /** The person's role on the team; organization admins act as blog admins. */
  role: BlogRole;
  isAdmin: boolean;
}

/** Records the person on first sight (and keeps their email current). */
export async function rememberUser(user: Viewer): Promise<void> {
  await db
    .insert(users)
    .values({ id: user.id, orgId: user.orgId, email: user.email })
    .onConflictDoUpdate({
      target: users.id,
      set: { email: user.email, orgId: user.orgId },
    });
}

/** The blog and the person's role, or null when they aren't on its team (and aren't an org admin). */
export async function blogAccess(
  user: Viewer,
  blogId: string,
): Promise<BlogAccess | null> {
  const [row] = await db
    .select({ blog: blogs, role: blogMembers.role })
    .from(blogs)
    .leftJoin(
      blogMembers,
      and(eq(blogMembers.blogId, blogs.id), eq(blogMembers.userId, user.id)),
    )
    .where(and(eq(blogs.id, blogId), eq(blogs.orgId, user.orgId)));
  if (!row) return null;
  const orgAdmin = isAdmin(user);
  if (!row.role && !orgAdmin) return null;
  const role: BlogRole =
    row.role === "author" && !orgAdmin ? "author" : "admin";
  return { blog: row.blog, role, isAdmin: role === "admin" };
}

/** A refusal whose message the page may show. */
export class AppError extends Error {}

export async function requireBlog(
  user: Viewer,
  blogId: string,
): Promise<BlogAccess> {
  const access = await blogAccess(user, blogId);
  if (!access) throw new AppError("Blog not found.");
  return access;
}

export async function requireBlogAdmin(
  user: Viewer,
  blogId: string,
): Promise<BlogAccess> {
  const access = await requireBlog(user, blogId);
  if (!access.isAdmin) throw new AppError("Only blog admins can do that.");
  return access;
}

/** Anyone may read a public blog; a team-only blog is for its team (and org admins). */
export async function canRead(
  blog: Blog,
  user: Viewer | null,
): Promise<{ allowed: boolean; team: boolean }> {
  const team = user ? (await blogAccess(user, blog.id)) !== null : false;
  return { allowed: blog.access === "public" || team, team };
}
