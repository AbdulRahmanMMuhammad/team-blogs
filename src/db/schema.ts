import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/** People who have opened the app, keyed by the Gateway's user id. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  email: text("email").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const blogs = sqliteTable(
  "blogs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    /** "public" or "team" */
    access: text("access").notNull().default("public"),
    /** "anyone", "members" or "nobody" */
    commentPolicy: text("comment_policy").notNull().default("anyone"),
    /** "hold" or "publish" */
    moderation: text("moderation").notNull().default("hold"),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("blogs_slug").on(t.slug)],
);

export const blogMembers = sqliteTable(
  "blog_members",
  {
    blogId: text("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    /** "admin" or "author" */
    role: text("role").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.blogId, t.userId] }),
    index("blog_members_user").on(t.userId),
  ],
);

export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    blogId: text("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    body: text("body").notNull().default(""),
    /** "draft" or "published"; published with a future date is scheduled. */
    status: text("status").notNull().default("draft"),
    publishedAt: integer("published_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("posts_blog_slug").on(t.blogId, t.slug),
    index("posts_blog_published").on(t.blogId, t.status, t.publishedAt),
  ],
);

export const postLabels = sqliteTable(
  "post_labels",
  {
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    blogId: text("blog_id").notNull(),
    label: text("label").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.label] }),
    index("post_labels_blog").on(t.blogId, t.label),
  ],
);

export const pages = sqliteTable(
  "pages",
  {
    id: text("id").primaryKey(),
    blogId: text("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    body: text("body").notNull().default(""),
    /** "draft" or "published" */
    status: text("status").notNull().default("draft"),
    /** Position in the blog's navigation; null when not shown there. */
    navPosition: integer("nav_position"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [uniqueIndex("pages_blog_slug").on(t.blogId, t.slug)],
);

export const media = sqliteTable(
  "media",
  {
    id: text("id").primaryKey(),
    blogId: text("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    uploaderId: text("uploader_id").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("media_blog").on(t.blogId)],
);

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    blogId: text("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorName: text("author_name").notNull(),
    /** Set when a signed-in member wrote it. */
    userId: text("user_id"),
    body: text("body").notNull(),
    /** "pending", "published" or "spam" */
    status: text("status").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("comments_post").on(t.postId, t.status, t.createdAt)],
);

export const views = sqliteTable(
  "views",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    blogId: text("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    /** "home", "post" or "page" */
    kind: text("kind").notNull(),
    targetId: text("target_id"),
    /** UTC day, YYYY-MM-DD */
    day: text("day").notNull(),
    referrer: text("referrer"),
  },
  (t) => [index("views_blog_day").on(t.blogId, t.day)],
);
