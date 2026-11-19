import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BlogShell, messageOf } from "@/client/components/BlogShell";
import { EmptyState } from "@/client/components/EmptyState";
import { Button } from "@/client/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/client/components/ui/tabs";
import { getComments, moderateComment } from "@/serverFunctions/blogs";

export const Route = createFileRoute("/blogs/$blogId/comments")({
  loader: async ({ params }) => {
    const data = await getComments({ data: { blogId: params.blogId } });
    if (!data) throw notFound();
    return data;
  },
  head: () => ({ meta: [{ title: "Comments" }] }),
  component: Comments,
});

type Tab = "pending" | "published" | "spam";
const EMPTY: Record<Tab, string> = {
  pending: "Nothing waiting for approval.",
  published: "No published comments.",
  spam: "No spam.",
};
const timeFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

function Comments() {
  const { blog, comments } = Route.useLoaderData();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const shown = comments.filter((comment) => comment.status === tab);
  const count = (status: Tab) => comments.filter((c) => c.status === status).length;

  async function act(commentId: string, action: "approve" | "spam" | "delete") {
    setBusy(commentId);
    try {
      await moderateComment({ data: { blogId: blog.id, commentId, action } });
      await router.invalidate();
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <BlogShell blog={blog}>
      <div className="space-y-4">
        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <TabsList>
            <TabsTrigger value="pending">Pending ({count("pending")})</TabsTrigger>
            <TabsTrigger value="published">Published</TabsTrigger>
            <TabsTrigger value="spam">Spam</TabsTrigger>
          </TabsList>
        </Tabs>
        {shown.length === 0 ? (
          <EmptyState title={EMPTY[tab]} />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            {shown.map((comment) => (
              <li key={comment.id} data-testid="comment-row" className="space-y-2 px-5 py-4">
                <p className="text-sm">
                  <span className="font-medium">{comment.authorName}</span>
                  <span className="text-muted-foreground">
                    {" "}on{" "}
                    <a href={`/b/${blog.slug}/p/${comment.postSlug}`} target="_blank" rel="noreferrer" className="hover:text-foreground">
                      {comment.postTitle}
                    </a>
                    {" · "}
                    {timeFormat.format(comment.createdAt)}
                  </span>
                </p>
                <p className="whitespace-pre-wrap">{comment.body}</p>
                <div className="flex gap-2">
                  {comment.status !== "published" ? (
                    <Button size="sm" disabled={busy === comment.id} onClick={() => act(comment.id, "approve")}>
                      Approve
                    </Button>
                  ) : null}
                  {comment.status !== "spam" ? (
                    <Button size="sm" variant="outline" disabled={busy === comment.id} onClick={() => act(comment.id, "spam")}>
                      Spam
                    </Button>
                  ) : null}
                  <Button size="sm" variant="destructive" disabled={busy === comment.id} onClick={() => act(comment.id, "delete")}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </BlogShell>
  );
}
