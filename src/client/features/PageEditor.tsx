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
import { deletePage, savePage } from "@/serverFunctions/blogs";

const TOAST: Record<string, string> = {
  draft: "Draft saved",
  publish: "Page published",
  update: "Page updated",
  revert: "Moved to drafts",
};

interface Page {
  id: string;
  title: string;
  slug: string;
  body: string;
  status: string;
}

export function PageEditor({
  blog,
  page,
  canEdit,
}: {
  blog: BlogHeader;
  page: Page | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const navigate = useNavigate();
  const body = useRef<HTMLTextAreaElement>(null);
  const [form, setForm] = useState({
    title: page?.title ?? "",
    slug: page?.slug ?? "",
    body: page?.body ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const live = page?.status === "published";

  async function run(action: "draft" | "publish" | "update" | "revert") {
    setError(null);
    setPending(action);
    try {
      const result = await savePage({
        data: { blogId: blog.id, pageId: page?.id, ...form, action },
      });
      toast.success(TOAST[action]);
      if (!page)
        await navigate({
          to: "/blogs/$blogId/pages/$pageId",
          params: { blogId: blog.id, pageId: result.id },
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
    if (!page) return;
    setPending("delete");
    try {
      await deletePage({ data: { blogId: blog.id, pageId: page.id } });
      toast.success("Page deleted");
      await navigate({ to: "/blogs/$blogId/pages", params: { blogId: blog.id } });
    } catch (cause) {
      setError(messageOf(cause));
      setPending(null);
      setConfirming(false);
    }
  }

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  if (!canEdit && page)
    return (
      <BlogShell blog={blog}>
        <NoAccess>Only the page's author or a blog admin can change this page.</NoAccess>
        <article className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">{page.title}</h2>
          <Markdown>{page.body}</Markdown>
        </article>
      </BlogShell>
    );

  return (
    <BlogShell blog={blog}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              to="/blogs/$blogId/pages"
              params={{ blogId: blog.id }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Pages
            </Link>
            <span className="text-muted-foreground">/</span>
            <Badge data-testid="page-status" variant={live ? "default" : "secondary"}>
              {live ? "Published" : "Draft"}
            </Badge>
          </div>
          {live && page ? (
            <a
              href={`/b/${blog.slug}/page/${page.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary hover:underline"
            >
              /b/{blog.slug}/page/{page.slug}
            </a>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="page-title">Title</Label>
            <Input id="page-title" value={form.title} onChange={set("title")} maxLength={200} className="bg-card" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="page-slug">Address</Label>
            <Input id="page-slug" value={form.slug} onChange={set("slug")} placeholder="From the title" maxLength={80} className="bg-card" />
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
            <Label htmlFor="page-body" className="sr-only">Body</Label>
            <Textarea
              id="page-body"
              ref={body}
              value={form.body}
              onChange={set("body")}
              rows={14}
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
              <Button pending={pending === "publish"} onClick={() => run("publish")}>Publish</Button>
              <Button variant="outline" pending={pending === "draft"} onClick={() => run("draft")}>
                Save draft
              </Button>
            </>
          )}
          {page ? (
            <Button variant="destructive" className="ml-auto" onClick={() => setConfirming(true)}>
              Delete
            </Button>
          ) : null}
        </div>
      </div>
      {confirming ? (
        <ConfirmDialog
          title="Delete this page?"
          confirmLabel="Delete page"
          destructive
          pending={pending === "delete"}
          onConfirm={() => void remove()}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </BlogShell>
  );
}
