import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { Markdown } from "@/client/components/Markdown";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { themePreferenceInitScript } from "@/client/lib/theme";
import appCss from "@/client/styles/app.css?url";
import type { Blog } from "./access";

/** The blog's public pages: plain HTML, no scripts but the theme pick. */
export function html(status: number, title: string, body: ReactNode) {
  const page = renderToString(
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <link rel="stylesheet" href={appCss} />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <script dangerouslySetInnerHTML={{ __html: themePreferenceInitScript }} />
      </head>
      <body>
        <div className="h-dvh overflow-y-auto">{body}</div>
      </body>
    </html>,
  );
  return new Response(`<!doctype html>${page}`, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function notFound() {
  return html(
    404,
    "Not found",
    <main className="mx-auto max-w-2xl space-y-2 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
      <p className="text-muted-foreground">There's nothing at this address.</p>
    </main>,
  );
}

export const blogPath = (blog: Pick<Blog, "slug">) => `/b/${blog.slug}`;
export const postPath = (blog: Pick<Blog, "slug">, slug: string) =>
  `/b/${blog.slug}/p/${slug}`;
export const labelPath = (blog: Pick<Blog, "slug">, label: string) =>
  `/b/${blog.slug}/label/${encodeURIComponent(label)}`;

const dateFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "long",
  timeZone: "UTC",
});
const timeFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
export const formatDate = (time: number | null) =>
  time ? dateFormat.format(time) : "";

export function BlogFrame({
  blog,
  nav,
  children,
}: {
  blog: Blog;
  nav: { title: string; slug: string }[];
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-10 pb-24 md:px-6">
      <header className="space-y-2 border-b border-border pb-6">
        <a href={blogPath(blog)} className="text-3xl font-semibold tracking-tight hover:text-primary">
          {blog.title}
        </a>
        {blog.description ? (
          <p className="text-muted-foreground">{blog.description}</p>
        ) : null}
        {nav.length ? (
          <nav className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-sm">
            <a href={blogPath(blog)} className="text-muted-foreground hover:text-foreground">
              Home
            </a>
            {nav.map((page) => (
              <a
                key={page.slug}
                href={`/b/${blog.slug}/page/${page.slug}`}
                className="text-muted-foreground hover:text-foreground"
              >
                {page.title}
              </a>
            ))}
          </nav>
        ) : null}
      </header>
      <main className="pt-8">{children}</main>
    </div>
  );
}

export function Labels({ blog, labels }: { blog: Blog; labels: string[] }) {
  if (!labels.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {labels.map((label) => (
        <Badge
          key={label}
          variant="secondary"
          render={<a href={labelPath(blog, label)} />}
        >
          {label}
        </Badge>
      ))}
    </div>
  );
}

interface ListedPost {
  title: string;
  slug: string;
  body: string;
  publishedAt: number | null;
  labels: string[];
}

export function PostList({
  blog,
  posts,
  page,
  hasMore,
  basePath,
  empty,
}: {
  blog: Blog;
  posts: ListedPost[];
  page: number;
  hasMore: boolean;
  basePath: string;
  empty: string;
}) {
  if (!posts.length)
    return <p className="py-12 text-center text-muted-foreground">{empty}</p>;
  return (
    <div className="space-y-12">
      {posts.map((post) => (
        <article key={post.slug} data-testid="public-post" className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">
              <a href={postPath(blog, post.slug)} className="hover:text-primary">
                {post.title}
              </a>
            </h2>
            <p className="text-sm text-muted-foreground">{formatDate(post.publishedAt)}</p>
          </div>
          <Markdown>{post.body}</Markdown>
          <Labels blog={blog} labels={post.labels} />
        </article>
      ))}
      {page > 1 || hasMore ? (
        <nav className="flex justify-between border-t border-border pt-6 text-sm">
          {page > 1 ? (
            <a
              href={page === 2 ? basePath : `${basePath}?page=${page - 1}`}
              className="text-primary hover:underline"
            >
              Newer posts
            </a>
          ) : (
            <span />
          )}
          {hasMore ? (
            <a href={`${basePath}?page=${page + 1}`} className="text-primary hover:underline">
              Older posts
            </a>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

export function PostView({
  blog,
  post,
  comments,
  signedInAs,
  notice,
}: {
  blog: Blog;
  post: ListedPost;
  comments: { id: string; authorName: string; body: string; createdAt: number }[];
  signedInAs: string | null;
  notice: string | null;
}) {
  const action = `${postPath(blog, post.slug)}/comments`;
  return (
    <div className="space-y-12">
      <article className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">{post.title}</h1>
          <p className="text-sm text-muted-foreground">{formatDate(post.publishedAt)}</p>
        </div>
        <Markdown>{post.body}</Markdown>
        <Labels blog={blog} labels={post.labels} />
      </article>
      <section id="comments" className="space-y-6 border-t border-border pt-8">
        <h2 className="text-lg font-semibold tracking-tight">
          {comments.length === 1 ? "1 comment" : `${comments.length} comments`}
        </h2>
        {notice ? (
          <p role="status" className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">
            {notice}
          </p>
        ) : null}
        {comments.length ? (
          <ol className="space-y-6">
            {comments.map((comment) => (
              <li key={comment.id} data-testid="comment" className="space-y-1">
                <p className="text-sm">
                  <span className="font-medium">{comment.authorName}</span>{" "}
                  <span className="text-muted-foreground">
                    {timeFormat.format(comment.createdAt)} UTC
                  </span>
                </p>
                <p className="leading-relaxed whitespace-pre-wrap">{comment.body}</p>
              </li>
            ))}
          </ol>
        ) : null}
        {blog.commentPolicy === "nobody" ? (
          <p className="text-sm text-muted-foreground">Comments are closed.</p>
        ) : blog.commentPolicy === "members" && !signedInAs ? (
          <p className="text-sm text-muted-foreground">
            Only members of this blog's organization can comment.
          </p>
        ) : (
          <form method="post" action={action} className="space-y-4">
            {signedInAs ? (
              <p className="text-sm text-muted-foreground">Commenting as {signedInAs}</p>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="comment-name">Name</Label>
                <Input id="comment-name" name="name" required maxLength={80} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="comment-body">Comment</Label>
              <Textarea id="comment-body" name="body" required maxLength={4000} rows={4} />
            </div>
            <Button type="submit">Post comment</Button>
          </form>
        )}
      </section>
    </div>
  );
}

export function PageView({ page }: { page: { title: string; body: string } }) {
  return (
    <article className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">{page.title}</h1>
      <Markdown>{page.body}</Markdown>
    </article>
  );
}

export function LabelCloud({
  blog,
  labels,
}: {
  blog: Blog;
  labels: { label: string; posts: number }[];
}) {
  if (!labels.length) return null;
  return (
    <aside data-testid="labels" className="mt-16 space-y-3 border-t border-border pt-6">
      <h2 className="text-sm font-semibold">Labels</h2>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {labels.map(({ label, posts }) => (
          <li key={label}>
            <a href={labelPath(blog, label)} className="text-primary hover:underline">
              {label}
            </a>{" "}
            <span className="text-muted-foreground">({posts})</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
