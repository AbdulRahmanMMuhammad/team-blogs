import { createFileRoute, notFound } from "@tanstack/react-router";
import { PageEditor } from "@/client/features/PageEditor";
import { getPage } from "@/serverFunctions/blogs";

export const Route = createFileRoute("/blogs/$blogId/pages/new")({
  loader: async ({ params }) => {
    const data = await getPage({ data: { blogId: params.blogId } });
    if (!data) throw notFound();
    return data;
  },
  head: () => ({ meta: [{ title: "New page" }] }),
  component: () => {
    const { blog } = Route.useLoaderData();
    return <PageEditor blog={blog} page={null} canEdit />;
  },
});
