import { createFileRoute } from "@tanstack/react-router";
import { countView, openBlog, pageNumber } from "@/server/publicRoute";
import { liveLabels, livePosts, navigationPages } from "@/server/public";
import { BlogFrame, LabelCloud, PostList, blogPath, html, notFound } from "@/server/render";

// A blog's public home. Public in everyapp.config.ts; a team-only blog answers 404 to anyone off its team.
export const Route = createFileRoute("/b/$slug/")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const found = await openBlog(request, params.slug);
        if (!found) return notFound();
        const { blog } = found;
        const page = pageNumber(request);
        const [{ posts, hasMore }, labels, nav] = await Promise.all([
          livePosts(blog, page),
          liveLabels(blog),
          navigationPages(blog.id),
        ]);
        if (page > 1 && !posts.length) return notFound();
        await countView(request, found, "home", null);
        return html(
          200,
          blog.title,
          <BlogFrame blog={blog} nav={nav}>
            <PostList
              blog={blog}
              posts={posts}
              page={page}
              hasMore={hasMore}
              basePath={blogPath(blog)}
              empty="Nothing published yet."
            />
            <LabelCloud blog={blog} labels={labels} />
          </BlogFrame>,
        );
      },
    },
  },
});
