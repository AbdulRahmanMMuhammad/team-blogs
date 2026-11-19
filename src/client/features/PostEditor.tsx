import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { BlogShell, NoAccess, messageOf, type BlogHeader } from "@/client/components/BlogShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Markdown } from "@/client/components/Markdown";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/client/components/ui/tabs";
import { Textarea } from "@/client/components/ui/textarea";
import { ImageUpload, insertAt } from "@/client/features/ImageUpload";
import { deletePost, savePost } from "@/serverFunctions/blogs";
import type { PostState } from "@/shared/text";

const STATE_LABEL: Record<PostState, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
};

const TOAST: Record<string, string> = {
  draft: "Draft saved",
  publish: "Post published",
  schedule: "Post scheduled",
  update: "Post updated",
  revert: "Moved to drafts",
};

interface Post {
  id: string;
  title: string;
  slug: string;
  body: string;
  publishedAt: number | null;
  state: PostState;
  labels: string[];
}

function toLocalInput(time: number | null) {
  if (!time) return "";
  const date = new Date(time);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function PostEditor({
  blog,
  post,
  canEdit,
}: {
  blog: BlogHeader;
  post: Post | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const navigate = useNavigate();
  const body = useRef<HTMLTextAreaElement>(null);
  const [form, setForm] = useState({
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    labels: post?.labels.join(", ") ?? "",
    body: post?.body ?? "",
    date: post?.state === "scheduled" ? toLocalInput(post.publishedAt) : "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const state = post?.state ?? "draft";
  const live = state !== "draft";

  async function run(action: "draft" | "publish" | "schedule" | "update" | "revert") {
    setError(null);
    setPending(action);
    try {
      const result = await savePost({
        data: {
          blogId: blog.id,
          postId: post?.id,
          title: form.title,
          slug: form.slug,
          body: form.body,
          labels: form.labels,
          publishAt: form.date ? new Date(form.date).toISOString() : undefined,
          action,
        },
      });
      toast.success(TOAST[action]);
      if (!post)
        await navigate({
          to: "/blogs/$blogId/posts/$postId",
          params: { blogId: blog.id, postId: result.id },
          replace: true,
        });
      else await router.invalidate();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPending(null);
    }
  }

  async function remove() {
    if (!post) return;
    setPending("delete");
    try {
      await deletePost({ data: { blogId: blog.id, postId: post.id } });
      toast.success("Post deleted");
      await navigate({ to: "/blogs/$blogId", params: { blogId: blog.id } });
    } catch (cause) {
      setError(messageOf(cause));
      setPending(null);
      setConfirming(false);
    }
  }

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  if (!canEdit && post)
    return (
      <BlogShell blog={blog}>
        <NoAccess>Only the post's author or a blog admin can change this post.</NoAccess>
        <article className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">{post.title}</h2>
          <Markdown>{post.body}</Markdown>
        </article>
      </BlogShell>
    );

  return (
    <BlogShell blog={blog}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              to="/blogs/$blogId"
              params={{ blogId: blog.id }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Posts
            </Link>
            <span className="text-muted-foreground">/</span>
            <Badge data-testid="post-status" variant={state === "published" ? "default" : "secondary"}>
              {STATE_LABEL[state]}
            </Badge>
          </div>
          {live && post ? (
            <a
              href={`/b/${blog.slug}/p/${post.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary hover:underline"
            >
              /b/{blog.slug}/p/{post.slug}
            </a>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="post-title">Title</Label>
          <Input id="post-title" value={form.title} onChange={set("title")} maxLength={200} className="bg-card" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="post-slug">Address</Label>
            <Input id="post-slug" value={form.slug} onChange={set("slug")} placeholder="From the title" maxLength={80} className="bg-card" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="post-labels">Labels</Label>
            <Input id="post-labels" value={form.labels} onChange={set("labels")} placeholder="Comma separated" className="bg-card" />
          </div>
        </div>

        <Tabs defaultValue="write">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="write">Write</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <ImageUpload
              blogId={blog.id}
              onInsert={(markdown) =>
                setForm((current) => ({ ...current, body: insertAt(body.current, current.body, markdown) }))
              }
            />
          </div>
          <TabsContent value="write" className="pt-2">
            <Label htmlFor="post-body" className="sr-only">Body</Label>
            <Textarea
              id="post-body"
              ref={body}
              value={form.body}
              onChange={set("body")}
              rows={16}
              placeholder="Write in Markdown"
              className="bg-card font-mono text-sm"
            />
          </TabsContent>
          <TabsContent value="preview" className="pt-2">
            <div data-testid="preview" className="min-h-64 rounded-lg border border-border bg-card p-6">
              {form.title ? <h1 className="mb-4 text-3xl font-semibold tracking-tight">{form.title}</h1> : null}
              <Markdown>{form.body}</Markdown>
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-2 sm:max-w-xs">
          <Label htmlFor="post-date">Publish date</Label>
          <Input id="post-date" type="datetime-local" value={form.date} onChange={set("date")} className="bg-card" />
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {live ? (
            <>
              <Button pending={pending === "update"} onClick={() => run("update")}>Update</Button>
              <Button variant="outline" pending={pending === "revert"} onClick={() => run("revert")}>
                Revert to draft
              </Button>
            </>
          ) : (
            <>
              <Button pending={pending === "publish"} onClick={() => run("publish")}>Publish now</Button>
              <Button variant="outline" pending={pending === "schedule"} disabled={!form.date} onClick={() => run("schedule")}>
                Schedule
              </Button>
              <Button variant="outline" pending={pending === "draft"} onClick={() => run("draft")}>
                Save draft
              </Button>
            </>
          )}
          {post ? (
            <Button variant="destructive" className="ml-auto" onClick={() => setConfirming(true)}>
              Delete
            </Button>
          ) : null}
        </div>
      </div>
      {confirming ? (
        <ConfirmDialog
          title="Delete this post?"
          confirmLabel="Delete post"
          destructive
          pending={pending === "delete"}
          onConfirm={() => void remove()}
          onClose={() => setConfirming(false)}
        >
          Its comments go with it.
        </ConfirmDialog>
      ) : null}
    </BlogShell>
  );
}
