import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BlogShell } from "@/client/components/BlogShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { CopyButton } from "@/client/components/CopyButton";
import { EmptyState } from "@/client/components/EmptyState";
import { Button } from "@/client/components/ui/button";
import { getMedia } from "@/serverFunctions/blogs";
import { formatBytes } from "@/shared/text";

export const Route = createFileRoute("/blogs/$blogId/media")({
  loader: async ({ params }) => {
    const data = await getMedia({ data: { blogId: params.blogId } });
    if (!data) throw notFound();
    return data;
  },
  head: () => ({ meta: [{ title: "Images" }] }),
  component: Media,
});

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

function Media() {
  const { blog, media } = Route.useLoaderData();
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function remove(id: string) {
    setPending(true);
    const response = await fetch(`/api/blogs/${blog.id}/media/${id}`, { method: "DELETE" });
    if (!response.ok) toast.error("Couldn't delete the image.");
    await router.invalidate();
    setPending(false);
    setConfirming(null);
  }

  return (
    <BlogShell blog={blog}>
      {media.length === 0 ? (
        <EmptyState title="No images yet." description="Images you insert while writing a post or page appear here." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {media.map((file) => (
            <li key={file.id} data-testid="media-row" className="flex items-center gap-4 px-5 py-3">
              <img src={file.url} alt="" loading="lazy" className="size-14 shrink-0 rounded-md border border-border object-cover" />
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate font-medium">{file.filename}</p>
                <p className="text-sm text-muted-foreground">
                  {file.uploader} · {formatBytes(file.size)} · {dateFormat.format(file.createdAt)}
                </p>
              </div>
              <CopyButton value={`![${file.filename}](${file.url})`} successMessage="Copied the Markdown." />
              {file.canDelete ? (
                <Button size="sm" variant="destructive" onClick={() => setConfirming(file.id)}>
                  Delete
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {confirming ? (
        <ConfirmDialog
          title="Delete this image?"
          confirmLabel="Delete image"
          destructive
          pending={pending}
          onConfirm={() => void remove(confirming)}
          onClose={() => setConfirming(null)}
        >
          Posts and pages that show it will show a broken image.
        </ConfirmDialog>
      ) : null}
    </BlogShell>
  );
}
