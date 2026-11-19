import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { comments, posts } from "@/db/schema";
import { AppError, requireBlog, type Viewer } from "./access";

export const moderateInput = z.object({
  blogId: z.string().min(1),
  commentId: z.string().min(1),
  action: z.enum(["approve", "spam", "delete"]),
});

/** Admins see every comment in the blog; authors see those on their own posts. */
export async function listComments(user: Viewer, blogId: string) {
  const access = await requireBlog(user, blogId);
  const rows = await db
    .select({
      id: comments.id,
      authorName: comments.authorName,
      body: comments.body,
      status: comments.status,
      createdAt: comments.createdAt,
      postTitle: posts.title,
      postSlug: posts.slug,
    })
    .from(comments)
    .innerJoin(posts, eq(posts.id, comments.postId))
    .where(
      and(
        eq(comments.blogId, blogId),
        access.isAdmin ? undefined : eq(posts.authorId, user.id),
      ),
    )
    .orderBy(asc(comments.createdAt));
  return { access, comments: rows };
}

export async function moderateComment(
  user: Viewer,
  { blogId, commentId, action }: z.infer<typeof moderateInput>,
) {
  const access = await requireBlog(user, blogId);
  const [row] = await db
    .select({ id: comments.id, postAuthor: posts.authorId })
    .from(comments)
    .innerJoin(posts, eq(posts.id, comments.postId))
    .where(and(eq(comments.id, commentId), eq(comments.blogId, blogId)));
  if (!row || (!access.isAdmin && row.postAuthor !== user.id))
    throw new AppError("Comment not found.");
  if (action === "delete")
    await db.delete(comments).where(eq(comments.id, commentId));
  else
    await db
      .update(comments)
      .set({ status: action === "approve" ? "published" : "spam" })
      .where(eq(comments.id, commentId));
  return { ok: true };
}
