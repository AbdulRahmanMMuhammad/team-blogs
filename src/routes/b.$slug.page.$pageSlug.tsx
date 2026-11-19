import { createFileRoute } from "@tanstack/react-router";
import { countView, openBlog } from "@/server/publicRoute";
import { livePage, navigationPages } from "@/server/public";
import { BlogFrame, PageView, html, notFound } from "@/server/render";

// A published standalone page.
export const Route = createFileRoute("/b/$slug/page/$pageSlug")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const found = await openBlog(request, params.slug);
        if (!found) return notFound();
        const { blog } = found;
        const page = await livePage(blog, params.pageSlug);
        if (!page) return notFound();
        const nav = await navigationPages(blog.id);
        await countView(request, found, "page", page.id);
        return html(
          200,
          `${page.title} · ${blog.title}`,
          <BlogFrame blog={blog} nav={nav}>
            <PageView page={page} />
          </BlogFrame>,
        );
      },
    },
  },
});
