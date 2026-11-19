import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { BlogShell } from "@/client/components/BlogShell";
import { EmptyState } from "@/client/components/EmptyState";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { getPages } from "@/serverFunctions/blogs";

export const Route = createFileRoute("/blogs/$blogId/pages/")({
  loader: async ({ params }) => {
    const data = await getPages({ data: { blogId: params.blogId } });
    if (!data) throw notFound();
    return data;
  },
  head: () => ({ meta: [{ title: "Pages" }] }),
  component: Pages,
});

function Pages() {
  const { blog, pages } = Route.useLoaderData();
  return (
    <BlogShell
      blog={blog}
      actions={
        <Button render={<Link to="/blogs/$blogId/pages/new" params={{ blogId: blog.id }} />}>
          <Plus aria-hidden />
          New page
        </Button>
      }
    >
      {pages.length === 0 ? (
        <EmptyState title="No pages yet." description="Create one for things like About or Contact." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {pages.map((page) => (
            <li key={page.id} data-testid="page-row">
              <Link
                to="/blogs/$blogId/pages/$pageId"
                params={{ blogId: blog.id, pageId: page.id }}
                className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/50"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium">{page.title}</p>
                  <p className="text-sm text-muted-foreground">
                    /page/{page.slug} · {page.author}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {page.navPosition !== null ? <Badge variant="outline">In navigation</Badge> : null}
                  <Badge variant={page.status === "published" ? "default" : "secondary"}>
                    {page.status === "published" ? "Published" : "Draft"}
                  </Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </BlogShell>
  );
}
