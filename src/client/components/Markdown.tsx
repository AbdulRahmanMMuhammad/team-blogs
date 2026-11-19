import type { ComponentPropsWithoutRef, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders a post or page body. Raw HTML in the source is shown as text, links
 * keep to http(s) and the app's own paths, and images load only from the
 * app's own paths (uploaded images); any other image becomes a link.
 */
export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

function safeHref(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (value.startsWith("#")) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return value;
  } catch {
    return null;
  }
}

function SafeAnchor({ href, children }: ComponentPropsWithoutRef<"a">) {
  const safe = safeHref(href);
  if (!safe) return <span className="underline decoration-dotted">{children}</span>;
  const external = !safe.startsWith("/") && !safe.startsWith("#");
  return (
    <a
      href={safe}
      {...(external ? { target: "_blank", rel: "noreferrer nofollow" } : {})}
      className="text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {children}
    </a>
  );
}

const COMPONENTS = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="mt-8 mb-3 text-2xl font-semibold tracking-tight first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mt-8 mb-3 text-xl font-semibold tracking-tight first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mt-6 mb-2 text-lg font-semibold first:mt-0">{children}</h3>
  ),
  h4: ({ children }: { children?: ReactNode }) => (
    <h4 className="mt-4 mb-2 font-semibold first:mt-0">{children}</h4>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="my-4 leading-relaxed first:mt-0 last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="my-4 ml-6 list-disc space-y-1">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="my-4 ml-6 list-decimal space-y-1">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  a: SafeAnchor,
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }: { children?: ReactNode }) => <em className="italic">{children}</em>,
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="my-4 border-l-2 border-border pl-4 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-border" />,
  code: ({ children, className }: ComponentPropsWithoutRef<"code">) => {
    if (typeof className === "string" && className.startsWith("language-"))
      return <code className={className}>{children}</code>;
    return (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">{children}</code>
    );
  },
  pre: ({ children }: { children?: ReactNode }) => (
    <pre className="my-4 overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm">
      {children}
    </pre>
  ),
  table: ({ children }: { children?: ReactNode }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border border-border text-sm">{children}</table>
    </div>
  ),
  tr: ({ children }: { children?: ReactNode }) => (
    <tr className="border-b border-border last:border-0">{children}</tr>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th className="px-3 py-2 text-left font-semibold">{children}</th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="px-3 py-2 align-top">{children}</td>
  ),
  img: ({ src, alt }: ComponentPropsWithoutRef<"img">) => {
    const safe = safeHref(src);
    if (safe && safe.startsWith("/"))
      return (
        <img
          src={safe}
          alt={alt ?? ""}
          loading="lazy"
          className="my-4 h-auto max-w-full rounded-lg border border-border"
        />
      );
    return <SafeAnchor href={safe ?? undefined}>{alt || "image"}</SafeAnchor>;
  },
};
