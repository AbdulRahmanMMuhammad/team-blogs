import { Link, useRouterState } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";

export interface BlogHeader {
  id: string;
  title: string;
  slug: string;
  role: string;
  isAdmin: boolean;
}

const SECTIONS = [
  { to: "/blogs/$blogId", label: "Posts", match: (p: string, base: string) => p === base || p.startsWith(`${base}/posts`) },
  { to: "/blogs/$blogId/pages", label: "Pages" },
  { to: "/blogs/$blogId/comments", label: "Comments" },
  { to: "/blogs/$blogId/media", label: "Images" },
  { to: "/blogs/$blogId/stats", label: "Stats" },
  { to: "/blogs/$blogId/team", label: "Team" },
  { to: "/blogs/$blogId/settings", label: "Settings" },
] as const;

/** Every page of one blog: the shell, the blog's name and its sections. */
export function BlogShell({
  blog,
  actions,
  children,
}: {
  blog: BlogHeader;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = `/blogs/${blog.id}`;
  return (
    <AppShell
      nav={
        <Link to="/" className="truncate text-sm text-muted-foreground hover:text-foreground">
          Blogs
        </Link>
      }
    >
      <div className="space-y-4">
        <PageHeader
          title={blog.title}
          description={
            <a
              href={`/b/${blog.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              /b/{blog.slug}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          }
          actions={actions}
        />
        <nav data-testid="blog-nav" className="-mx-2 flex gap-1 overflow-x-auto border-b border-border pb-2">
          {SECTIONS.map((section) => {
            const href = section.to.replace("/blogs/$blogId", base);
            const active =
              "match" in section ? section.match(pathname, base) : pathname.startsWith(href);
            return (
              <Button
                key={section.label}
                size="sm"
                variant={active ? "secondary" : "ghost"}
                render={<Link to={section.to} params={{ blogId: blog.id }} />}
              >
                {section.label}
              </Button>
            );
          })}
        </nav>
      </div>
      {children}
    </AppShell>
  );
}

export function NotFoundPage() {
  return (
    <AppShell>
      <div data-testid="not-found">
        <EmptyState
          title="Not found"
          description="This doesn't exist, or you're not on its team."
          action={
            <Button variant="outline" render={<Link to="/" />}>
              Your blogs
            </Button>
          }
        />
      </div>
    </AppShell>
  );
}

export function NoAccess({ children }: { children: ReactNode }) {
  return (
    <Alert data-testid="no-access">
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

/** A server function's error as a sentence. */
export function messageOf(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Something went wrong. Try again.";
}
