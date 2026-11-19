import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/client/components/AppShell";
import { messageOf } from "@/client/components/BlogShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { createBlog, getMyBlogs } from "@/serverFunctions/blogs";
import { slugify } from "@/shared/text";

export const Route = createFileRoute("/")({
  loader: () => getMyBlogs(),
  head: () => ({ meta: [{ title: "Blogs" }] }),
  component: Home,
});

function Home() {
  const blogs = Route.useLoaderData();
  const [creating, setCreating] = useState(false);
  const newBlog = (
    <Button data-testid="new-blog" onClick={() => setCreating(true)}>
      <Plus aria-hidden />
      New blog
    </Button>
  );
  return (
    <AppShell>
      <PageHeader title="Blogs" actions={blogs.length ? newBlog : undefined} />
      {blogs.length === 0 ? (
        <EmptyState
          title="No blogs yet."
          description="Create one to start writing."
          action={newBlog}
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {blogs.map((blog) => (
            <li key={blog.id}>
              <Link
                to="/blogs/$blogId"
                params={{ blogId: blog.id }}
                data-testid="blog-row"
                className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/50"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium">{blog.title}</p>
                  <p className="text-sm text-muted-foreground">/b/{blog.slug}</p>
                  {blog.description ? (
                    <p className="truncate text-sm text-muted-foreground">{blog.description}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {blog.access === "team" ? <Badge variant="outline">Team only</Badge> : null}
                  <Badge variant="secondary">{blog.role === "admin" ? "Admin" : "Author"}</Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {creating ? <NewBlogDialog onClose={() => setCreating(false)} /> : null}
    </AppShell>
  );
}

function NewBlogDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setError(null);
    setPending(true);
    try {
      const { id } = await createBlog({ data: { title, slug, description } });
      await navigate({ to: "/blogs/$blogId", params: { blogId: id } });
    } catch (cause) {
      setError(messageOf(cause));
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>New blog</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="blog-title">Title</Label>
            <Input
              id="blog-title"
              value={title}
              required
              maxLength={120}
              onChange={(event) => {
                setTitle(event.target.value);
                if (!slugEdited) setSlug(slugify(event.target.value));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="blog-slug">Address</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">/b/</span>
              <Input
                id="blog-slug"
                value={slug}
                required
                maxLength={60}
                onChange={(event) => {
                  setSlug(event.target.value);
                  setSlugEdited(true);
                }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="blog-description">Description</Label>
            <Textarea
              id="blog-description"
              value={description}
              maxLength={500}
              rows={3}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" pending={pending}>
              Create blog
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
