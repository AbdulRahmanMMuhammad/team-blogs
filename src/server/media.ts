import { and, desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { db } from "@/db";
import { media, users } from "@/db/schema";
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/shared/text";
import { requireBlog, type Viewer } from "./access";
import { mediaKey } from "./blogs";

export function mediaUrl(slug: string, id: string) {
  return `/b/${slug}/media/${id}`;
}

export async function listMedia(user: Viewer, blogId: string) {
  const access = await requireBlog(user, blogId);
  const rows = await db
    .select({
      id: media.id,
      filename: media.filename,
      size: media.size,
      createdAt: media.createdAt,
      uploaderId: media.uploaderId,
      uploader: users.email,
    })
    .from(media)
    .leftJoin(users, eq(users.id, media.uploaderId))
    .where(eq(media.blogId, blogId))
    .orderBy(desc(media.createdAt));
  return {
    access,
    media: rows.map(({ uploaderId, ...row }) => ({
      ...row,
      uploader: row.uploader ?? "",
      url: mediaUrl(access.blog.slug, row.id),
      canDelete: access.isAdmin || uploaderId === user.id,
    })),
  };
}

export type UploadResult =
  | { status: 201; id: string; url: string; filename: string }
  | { status: 404 | 413 | 415 | 400; error: string };

export async function uploadMedia(
  user: Viewer,
  blogId: string,
  file: File,
): Promise<UploadResult> {
  const access = await requireBlog(user, blogId).catch(() => null);
  if (!access) return { status: 404, error: "Blog not found." };
  if (!IMAGE_TYPES.includes(file.type))
    return { status: 415, error: "Upload a PNG, JPEG, GIF, WebP or AVIF image." };
  if (file.size > MAX_IMAGE_BYTES)
    return { status: 413, error: "Images can be up to 10 MB." };
  if (file.size === 0) return { status: 400, error: "That file is empty." };
  const id = crypto.randomUUID();
  const filename = (file.name || "image").slice(0, 200);
  await env.media.put(mediaKey(blogId, id), file.stream(), {
    httpMetadata: { contentType: file.type },
  });
  await db.insert(media).values({
    id,
    blogId,
    uploaderId: user.id,
    filename,
    contentType: file.type,
    size: file.size,
    createdAt: Date.now(),
  });
  return { status: 201, id, url: mediaUrl(access.blog.slug, id), filename };
}

/** 204 when deleted; 404 when the person can't see it; 403 when they may see but not delete it. */
export async function deleteMedia(
  user: Viewer,
  blogId: string,
  mediaId: string,
): Promise<204 | 403 | 404> {
  const access = await requireBlog(user, blogId).catch(() => null);
  if (!access) return 404;
  const [row] = await db
    .select({ uploaderId: media.uploaderId })
    .from(media)
    .where(and(eq(media.id, mediaId), eq(media.blogId, blogId)));
  if (!row) return 404;
  if (!access.isAdmin && row.uploaderId !== user.id) return 403;
  await db.delete(media).where(eq(media.id, mediaId));
  await env.media.delete(mediaKey(blogId, mediaId));
  return 204;
}
