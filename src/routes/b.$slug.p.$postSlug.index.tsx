import { createFileRoute } from "@tanstack/react-router";
import { countView, openBlog } from "@/server/publicRoute";
import { approvedComments, livePost, navigationPages } from "@/server/public";
import { BlogFrame, PostView, html, notFound } from "@/server/render";

const NOTICES: Record<string, string> = {
  pending: "Thanks. Your comment will appear once it's approved.",
  published: "Your comment is posted.",
};

// One live post with its approved comments, oldest first.
export const Route = createFileRoute("/b/$slug/p/$postSlug/")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const found = await openBlog(request, params.slug);
        if (!found) return notFound();
        const { blog, user } = found;
        const post = await livePost(blog, params.postSlug);
        if (!post) return notFound();
        const [comments, nav] = await Promise.all([
          approvedComments(post.id),
          navigationPages(blog.id),
        ]);
        await countView(request, found, "post", post.id);
        const notice = NOTICES[new URL(request.url).searchParams.get("comment") ?? ""];
        return html(
          200,
          `${post.title} · ${blog.title}`,
          <BlogFrame blog={blog} nav={nav}>
            <PostView
              blog={blog}
              post={post}
              comments={comments}
              signedInAs={user?.email ?? null}
              notice={notice ?? null}
            />
          </BlogFrame>,
        );
      },
    },
  },
});
