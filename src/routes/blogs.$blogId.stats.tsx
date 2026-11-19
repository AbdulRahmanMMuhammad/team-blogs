import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { BlogShell } from "@/client/components/BlogShell";
import { EmptyState } from "@/client/components/EmptyState";
import { SegmentedToggle } from "@/client/components/SegmentedToggle";
import { getStats } from "@/serverFunctions/blogs";

export const Route = createFileRoute("/blogs/$blogId/stats")({
  validateSearch: z.object({ days: z.union([z.literal(7), z.literal(30)]).catch(7) }),
  loaderDeps: ({ search }) => ({ days: search.days }),
  loader: async ({ params, deps }) => {
    const data = await getStats({ data: { blogId: params.blogId, days: deps.days } });
    if (!data) throw notFound();
    return data;
  },
  head: () => ({ meta: [{ title: "Stats" }] }),
  component: Stats,
});

const dayFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });

function Stats() {
  const { blog, total, series, content, referrers } = Route.useLoaderData();
  const { days } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const peak = Math.max(1, ...series.map((point) => point.views));

  return (
    <BlogShell blog={blog}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Views, last {days} days</p>
          <p data-testid="total-views" className="text-3xl font-semibold tabular-nums">{total}</p>
        </div>
        <SegmentedToggle
          showLabels
          value={String(days) as "7" | "30"}
          onChange={(value) => void navigate({ search: { days: value === "30" ? 30 : 7 } })}
          items={[
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
          ]}
        />
      </div>

      <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="flex h-40 items-end gap-1" role="img" aria-label="Views per day">
          {series.map((point) => (
            <div
              key={point.day}
              title={`${dayFormat.format(new Date(point.day))}: ${point.views}`}
              className="flex-1 rounded-t-sm bg-primary/80"
              style={{ height: `${Math.max(2, (point.views / peak) * 100)}%`, opacity: point.views ? 1 : 0.25 }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{dayFormat.format(new Date(series[0]!.day))}</span>
          <span>{dayFormat.format(new Date(series[series.length - 1]!.day))}</span>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Ranked
          testId="top-content"
          title="Most viewed"
          rows={content.map((row) => ({ key: row.key, name: row.title, views: row.views }))}
        />
        <Ranked
          testId="top-referrers"
          title="Referring sites"
          rows={referrers.map((row) => ({ key: row.host, name: row.host, views: row.views }))}
        />
      </div>
    </BlogShell>
  );
}

function Ranked({
  testId,
  title,
  rows,
}: {
  testId: string;
  title: string;
  rows: { key: string; name: string; views: number }[];
}) {
  return (
    <section data-testid={testId} className="space-y-3">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {rows.length === 0 ? (
        <EmptyState size="sm" icon={null} title="No views in this period." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card text-sm shadow-xs">
          {rows.map((row) => (
            <li key={row.key} className="flex justify-between gap-4 px-4 py-2.5">
              <span className="min-w-0 truncate">{row.name}</span>
              <span className="tabular-nums text-muted-foreground">{row.views}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
