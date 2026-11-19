import { and, count, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { pages, posts, views } from "@/db/schema";
import { requireBlog, type Viewer } from "./access";

export function utcDay(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

/** Counts one reader's view. Callers skip the blog's own team. */
export async function recordView(view: {
  blogId: string;
  kind: "home" | "post" | "page";
  targetId: string | null;
  referrer: string | null;
}) {
  await db.insert(views).values({ ...view, day: utcDay(Date.now()) });
}

export async function getStats(user: Viewer, blogId: string, days: 7 | 30) {
  const access = await requireBlog(user, blogId);
  const now = Date.now();
  const since = utcDay(now - (days - 1) * 86_400_000);
  const inRange = and(eq(views.blogId, blogId), gte(views.day, since));

  const daily = await db
    .select({ day: views.day, views: count() })
    .from(views)
    .where(inRange)
    .groupBy(views.day);
  const byDay = new Map(daily.map((row) => [row.day, row.views]));
  const series = Array.from({ length: days }, (_, i) => {
    const day = utcDay(now - (days - 1 - i) * 86_400_000);
    return { day, views: byDay.get(day) ?? 0 };
  });

  const content = await db
    .select({
      kind: views.kind,
      targetId: views.targetId,
      views: count(),
      postTitle: posts.title,
      pageTitle: pages.title,
    })
    .from(views)
    .leftJoin(posts, and(eq(views.kind, "post"), eq(posts.id, views.targetId)))
    .leftJoin(pages, and(eq(views.kind, "page"), eq(pages.id, views.targetId)))
    .where(inRange)
    .groupBy(views.kind, views.targetId)
    .orderBy(desc(count()))
    .limit(10);

  const referrers = await db
    .select({ host: views.referrer, views: count() })
    .from(views)
    .where(and(inRange, isNotNull(views.referrer)))
    .groupBy(views.referrer)
    .orderBy(desc(count()), sql`${views.referrer}`)
    .limit(10);

  return {
    access,
    total: series.reduce((sum, row) => sum + row.views, 0),
    series,
    content: content.map((row) => ({
      key: `${row.kind}:${row.targetId ?? ""}`,
      kind: row.kind,
      title:
        row.kind === "home"
          ? "Home"
          : (row.postTitle ?? row.pageTitle ?? "Deleted"),
      views: row.views,
    })),
    referrers: referrers.map((row) => ({ host: row.host ?? "", views: row.views })),
  };
}
