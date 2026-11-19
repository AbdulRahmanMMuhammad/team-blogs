import { createFileRoute, notFound } from "@tanstack/react-router";
import { PostEditor } from "@/client/features/PostEditor";
import { getPost } from "@/serverFunctions/blogs";

export const Route = createFileRoute("/blogs/$blogId/posts/new")({
  loader: async ({ params }) => {
    const data = await getPost({ data: { blogId: params.blogId } });
    if (!data) throw notFound();
    return data;
  },
  head: () => ({ meta: [{ title: "New post" }] }),
  component: () => {
    const { blog } = Route.useLoaderData();
    return <PostEditor blog={blog} post={null} canEdit />;
  },
});
