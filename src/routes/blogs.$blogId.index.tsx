import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { BlogShell } from "@/client/components/BlogShell";
import { EmptyState } from "@/client/components/EmptyState";
import { SegmentedToggle } from "@/client/components/SegmentedToggle";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { getPosts } from "@/serverFunctions/blogs";
import type { PostState } from "@/shared/text";

export const Route = createFileRoute("/blogs/$blogId/")({
  loader: async ({ params }) => {
    const data = await getPosts({ data: { blogId: params.blogId } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: loaderData.blog.title }] : [] }),
  component: Posts,
});

type Filter = "all" | PostState;

export const STATE_LABEL: Record<PostState, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
};

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

function Posts() {
  const { blog, posts } = Route.useLoaderData();
  const [filter, setFilter] = useState<Filter>("all");
  const [labels, setLabels] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  const allLabels = useMemo(
    () => [...new Set(posts.flatMap((post) => post.labels))].sort((a, b) => a.localeCompare(b)),
    [posts],
  );
  const shown = posts.filter(
    (post) =>
      (filter === "all" || post.state === filter) &&
      labels.every((label) => post.labels.includes(label)) &&
      post.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <BlogShell
      blog={blog}
      actions={
        <Button render={<Link to="/blogs/$blogId/posts/new" params={{ blogId: blog.id }} />}>
          <Plus aria-hidden />
          New post
        </Button>
      }
    >
      {posts.length === 0 ? (
        <EmptyState title="No posts yet." description="Write one and it will appear here." />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedToggle
              value={filter}
              onChange={setFilter}
              showLabels
              items={(
                [
                  ["all", "All"],
                  ["draft", "Drafts"],
                  ["scheduled", "Scheduled"],
                  ["published", "Published"],
                ] as const
              ).map(([value, label]) => ({ value, label, testId: `status-${value}` }))}
            />
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                aria-label="Search titles"
                placeholder="Search titles"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="bg-card pl-9"
              />
            </div>
          </div>
          {allLabels.length ? (
            <div className="flex flex-wrap gap-1.5">
              {allLabels.map((label) => {
                const on = labels.includes(label);
                return (
                  <Button
                    key={label}
                    size="xs"
                    variant={on ? "default" : "outline"}
                    aria-pressed={on}
                    data-testid={`label-filter-${label}`}
                    onClick={() =>
                      setLabels(on ? labels.filter((l) => l !== label) : [...labels, label])
                    }
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          ) : null}
          {shown.length === 0 ? (
            <EmptyState kind="filtered" title="No posts match." />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              {shown.map((post) => (
                <li key={post.id} data-testid="post-row">
                  <Link
                    to="/blogs/$blogId/posts/$postId"
                    params={{ blogId: blog.id, postId: post.id }}
                    className="flex flex-col gap-1.5 px-5 py-4 hover:bg-muted/50 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium">{post.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {post.author}
                        {post.state !== "draft" && post.publishedAt
                          ? ` · ${dateFormat.format(post.publishedAt)}`
                          : ""}
                      </p>
                      {post.labels.length ? (
                        <div className="flex flex-wrap gap-1">
                          {post.labels.map((label) => (
                            <Badge key={label} variant="outline">{label}</Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <Badge variant={post.state === "published" ? "default" : "secondary"} className="shrink-0">
                      {STATE_LABEL[post.state]}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </BlogShell>
  );
}
