import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import { rememberUser } from "@/server/access";
import * as blogs from "@/server/blogs";
import * as posts from "@/server/posts";
import * as pages from "@/server/pages";
import * as comments from "@/server/comments";
import * as media from "@/server/media";
import * as team from "@/server/team";
import * as stats from "@/server/stats";
import { validate } from "./validate";

const blogRef = validate(z.object({ blogId: z.string().min(1) }));

/** The blog parts every blog page shows in its header. */
function header(access: { blog: { id: string; title: string; slug: string }; role: string; isAdmin: boolean }) {
  const { id, title, slug } = access.blog;
  return { id, title, slug, role: access.role, isAdmin: access.isAdmin };
}

/** Null when the person can't see the blog: the page shows not found. */
async function orNull<T>(work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof Error && error.message === "Blog not found.") return null;
    throw error;
  }
}

export const getMyBlogs = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context: { user } }) => {
    await rememberUser(user);
    return blogs.listMyBlogs(user);
  });

export const createBlog = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(validate(blogs.createBlogInput))
  .handler(async ({ data, context: { user } }) => {
    await rememberUser(user);
    return blogs.createBlog(user, data);
  });

export const updateBlog = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(validate(blogs.updateBlogInput))
  .handler(({ data, context: { user } }) => blogs.updateBlog(user, data));

export const deleteBlog = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(blogRef)
  .handler(({ data, context: { user } }) => blogs.deleteBlog(user, data.blogId));

export const getSettings = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator(blogRef)
  .handler(({ data, context: { user } }) =>
    orNull(async () => {
      const { access, pages } = await blogs.getSettings(user, data.blogId);
      const { blog } = access;
      return {
        blog: header(access),
        settings: {
          title: blog.title,
          slug: blog.slug,
          description: blog.description,
          access: blog.access as "public" | "team",
          commentPolicy: blog.commentPolicy as "anyone" | "members" | "nobody",
          moderation: blog.moderation as "hold" | "publish",
        },
        pages,
      };
    }),
  );

export const saveNavigation = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(validate(blogs.navigationInput))
  .handler(({ data, context: { user } }) => blogs.saveNavigation(user, data));

export const getPosts = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator(blogRef)
  .handler(({ data, context: { user } }) =>
    orNull(async () => {
      const { access, posts: list } = await posts.listPosts(user, data.blogId);
      return { blog: header(access), posts: list };
    }),
  );

export const getPost = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator(validate(z.object({ blogId: z.string().min(1), postId: z.string().optional() })))
  .handler(({ data, context: { user } }) =>
    orNull(async () => {
      if (!data.postId) {
        const { access } = await posts.listPosts(user, data.blogId);
        return { blog: header(access), post: null, canEdit: true };
      }
      const found = await posts.getPost(user, data.blogId, data.postId);
      if (!found) return null;
      return { blog: header(found.access), post: found.post, canEdit: found.canEdit };
    }),
  );

export const savePost = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(validate(posts.savePostInput))
  .handler(({ data, context: { user } }) => posts.savePost(user, data));

export const deletePost = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(validate(posts.postRef))
  .handler(({ data, context: { user } }) => posts.deletePost(user, data));

export const getPages = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator(blogRef)
  .handler(({ data, context: { user } }) =>
    orNull(async () => {
      const { access, pages: list } = await pages.listPages(user, data.blogId);
      return { blog: header(access), pages: list };
    }),
  );

export const getPage = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator(validate(z.object({ blogId: z.string().min(1), pageId: z.string().optional() })))
  .handler(({ data, context: { user } }) =>
    orNull(async () => {
      if (!data.pageId) {
        const { access } = await pages.listPages(user, data.blogId);
        return { blog: header(access), page: null, canEdit: true };
      }
      const found = await pages.getPage(user, data.blogId, data.pageId);
      if (!found) return null;
      return { blog: header(found.access), page: found.page, canEdit: found.canEdit };
    }),
  );

export const savePage = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(validate(pages.savePageInput))
  .handler(({ data, context: { user } }) => pages.savePage(user, data));

export const deletePage = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(validate(pages.pageRef))
  .handler(({ data, context: { user } }) => pages.deletePage(user, data));

export const getComments = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator(blogRef)
  .handler(({ data, context: { user } }) =>
    orNull(async () => {
      const found = await comments.listComments(user, data.blogId);
      return { blog: header(found.access), comments: found.comments };
    }),
  );

export const moderateComment = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(validate(comments.moderateInput))
  .handler(({ data, context: { user } }) => comments.moderateComment(user, data));

export const getMedia = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator(blogRef)
  .handler(({ data, context: { user } }) =>
    orNull(async () => {
      const found = await media.listMedia(user, data.blogId);
      return { blog: header(found.access), media: found.media };
    }),
  );

export const getTeam = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator(blogRef)
  .handler(({ data, context: { user } }) =>
    orNull(async () => {
      const found = await team.listTeam(user, data.blogId);
      return {
        blog: header(found.access),
        team: found.team,
        candidates: found.candidates,
        me: user.id,
      };
    }),
  );

export const addMember = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(validate(team.memberInput))
  .handler(({ data, context: { user } }) => team.addMember(user, data));

export const setRole = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(validate(team.memberInput))
  .handler(({ data, context: { user } }) => team.setRole(user, data));

export const removeMember = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator(validate(team.removeInput))
  .handler(({ data, context: { user } }) => team.removeMember(user, data));

export const getStats = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator(validate(z.object({ blogId: z.string().min(1), days: z.union([z.literal(7), z.literal(30)]) })))
  .handler(({ data, context: { user } }) =>
    orNull(async () => {
      const found = await stats.getStats(user, data.blogId, data.days);
      const { access, ...rest } = found;
      return { blog: header(access), ...rest };
    }),
  );
