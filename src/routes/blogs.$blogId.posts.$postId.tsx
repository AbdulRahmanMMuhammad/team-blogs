import { createFileRoute, notFound } from "@tanstack/react-router";
import { PostEditor } from "@/client/features/PostEditor";
import { getPost } from "@/serverFunctions/blogs";

export const Route = createFileRoute("/blogs/$blogId/posts/$postId")({
  loader: async ({ params }) => {
    const data = await getPost({ data: { blogId: params.blogId, postId: params.postId } });
    if (!data?.post) throw notFound();
    return { ...data, post: data.post };
  },
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: loaderData.post.title }] : [] }),
  component: () => {
    const { blog, post, canEdit } = Route.useLoaderData();
    // Keyed so the form starts from the saved post after each save.
    return <PostEditor key={`${post.id}:${post.state}:${post.slug}`} blog={blog} post={post} canEdit={canEdit} />;
  },
});
