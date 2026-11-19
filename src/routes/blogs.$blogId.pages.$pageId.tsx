import { createFileRoute, notFound } from "@tanstack/react-router";
import { PageEditor } from "@/client/features/PageEditor";
import { getPage } from "@/serverFunctions/blogs";

export const Route = createFileRoute("/blogs/$blogId/pages/$pageId")({
  loader: async ({ params }) => {
    const data = await getPage({ data: { blogId: params.blogId, pageId: params.pageId } });
    if (!data?.page) throw notFound();
    return { ...data, page: data.page };
  },
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: loaderData.page.title }] : [] }),
  component: () => {
    const { blog, page, canEdit } = Route.useLoaderData();
    return <PageEditor key={`${page.id}:${page.status}:${page.slug}`} blog={blog} page={page} canEdit={canEdit} />;
  },
});
