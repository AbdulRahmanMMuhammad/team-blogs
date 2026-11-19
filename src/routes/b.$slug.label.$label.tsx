import { createFileRoute } from "@tanstack/react-router";
import { openBlog, pageNumber, param } from "@/server/publicRoute";
import { livePosts, navigationPages } from "@/server/public";
import { BlogFrame, PostList, html, labelPath, notFound } from "@/server/render";

// The live posts with one label.
export const Route = createFileRoute("/b/$slug/label/$label")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const found = await openBlog(request, params.slug);
        if (!found) return notFound();
        const { blog } = found;
        const label = param(params.label);
        const page = pageNumber(request);
        const [{ posts, hasMore }, nav] = await Promise.all([
          livePosts(blog, page, label),
          navigationPages(blog.id),
        ]);
        if (!posts.length) return notFound();
        return html(
          200,
          `${label} · ${blog.title}`,
          <BlogFrame blog={blog} nav={nav}>
            <h1 className="mb-8 text-sm text-muted-foreground">
              Posts labelled <span className="font-medium text-foreground">{label}</span>
            </h1>
            <PostList
              blog={blog}
              posts={posts}
              page={page}
              hasMore={hasMore}
              basePath={labelPath(blog, label)}
              empty=""
            />
          </BlogFrame>,
        );
      },
    },
  },
});
