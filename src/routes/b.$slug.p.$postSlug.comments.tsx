import { createFileRoute } from "@tanstack/react-router";
import { openBlog } from "@/server/publicRoute";
import { addComment, livePost, navigationPages } from "@/server/public";
import { BlogFrame, html, notFound, postPath } from "@/server/render";

// A reader's comment, posted by the form on a post page. The blog's comment
// setting decides who may post: anyone (with a name), signed-in members, or nobody.
export const Route = createFileRoute("/b/$slug/p/$postSlug/comments")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const found = await openBlog(request, params.slug);
        if (!found) return notFound();
        const { blog, user } = found;
        const post = await livePost(blog, params.postSlug);
        if (!post) return notFound();
        const back = postPath(blog, post.slug);

        const refuse = async (status: number, message: string) =>
          html(
            status,
            blog.title,
            <BlogFrame blog={blog} nav={await navigationPages(blog.id)}>
              <div className="space-y-3">
                <p>{message}</p>
                <a href={`${back}#comments`} className="text-primary hover:underline">
                  Back to the post
                </a>
              </div>
            </BlogFrame>,
          );

        if (blog.commentPolicy === "nobody")
          return refuse(403, "Comments are closed on this blog.");
        if (blog.commentPolicy === "members" && !user)
          return refuse(403, "Only members of this blog's organization can comment.");

        const form = await request.formData().catch(() => null);
        const body = String(form?.get("body") ?? "").trim();
        const name = user ? user.email : String(form?.get("name") ?? "").trim();
        if (!name || name.length > 80) return refuse(400, "Add your name to comment.");
        if (!body || body.length > 4000)
          return refuse(400, "Write a comment of up to 4,000 characters.");

        const status = await addComment({
          blog,
          postId: post.id,
          authorName: name,
          userId: user?.id ?? null,
          body,
        });
        const location = new URL(`${back}?comment=${status}#comments`, request.url);
        return new Response(null, { status: 303, headers: { location: location.href } });
      },
    },
  },
});
