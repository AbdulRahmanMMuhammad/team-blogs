// Behavior: every frozen feature's main path (F001-F007), one browser journey and a phone smoke.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { createBlog, writePost, writePage, choose, saveSettings, postComment, PNG } from "./lib.mjs";

const runtime = await startRuntime();
try {
  const page = await (await runtime.context("owner")).newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Blogs" })).toBeVisible();
  await expect(page.getByText("No blogs yet.")).toBeVisible();
  await runtime.assertBackLink(page);

  // F001: create a blog; the slug must be valid and unique.
  const blogId = await createBlog(page, {
    title: "Ridge Line Journal",
    slug: "ridge-line",
    description: "Trail reports and gear notes from weekend hikes in the Cascades.",
  });
  await page.goto("/");
  await expect(page.getByTestId("blog-row")).toHaveCount(1);
  await expect(page.getByTestId("blog-row")).toContainText("Ridge Line Journal");
  await page.getByTestId("new-blog").click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Copy");
  await dialog.getByLabel("Address").fill("ridge-line");
  await dialog.getByRole("button", { name: "Create blog" }).click();
  await expect(dialog.getByRole("alert")).toContainText("taken");
  await dialog.getByLabel("Address").fill("Bad Slug!");
  await dialog.getByRole("button", { name: "Create blog" }).click();
  await expect(dialog.getByRole("alert")).toContainText("lowercase");
  await page.keyboard.press("Escape");

  let home = await runtime.fetch("/b/ridge-line");
  expect(home.status).toBe(200);
  let html = await home.text();
  expect(html).toContain("Ridge Line Journal");
  expect(html).toContain("Trail reports and gear notes");

  // F002: draft, preview, publish, labels.
  const firstId = await writePost(page, blogId, {
    title: "Day one on Maple Pass",
    labels: "trail reports, washington",
    body: "## Leaving the trailhead\n\nWe started at **six** with frost on the ground.",
    action: "Save draft",
  });
  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page.getByTestId("preview").getByRole("heading", { name: "Leaving the trailhead" })).toBeVisible();
  expect((await runtime.fetch("/b/ridge-line/p/day-one-on-maple-pass")).status).toBe(404);
  await page.getByRole("tab", { name: "Write" }).click();

  // F004: upload an image into the post body.
  const [upload] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/media") && r.request().method() === "POST"),
    page.getByTestId("image-upload").setInputFiles({ name: "larches.png", mimeType: "image/png", buffer: PNG }),
  ]);
  expect(upload.status()).toBe(201);
  await expect(page.getByLabel("Body")).toHaveValue(/!\[larches\]\(\/b\/ridge-line\/media\/[^)]+\)/);
  const imagePath = (await page.getByLabel("Body").inputValue()).match(/\((\/b\/ridge-line\/media\/[^)]+)\)/)[1];
  await page.getByRole("button", { name: "Publish now", exact: true }).click();
  await expect(page.getByTestId("post-status")).toHaveText("Published");

  let post = await runtime.fetch("/b/ridge-line/p/day-one-on-maple-pass");
  expect(post.status).toBe(200);
  html = await post.text();
  expect(html).toContain("Leaving the trailhead");
  expect(html).toMatch(/<strong[^>]*>six<\/strong>/);
  expect(html).toContain(imagePath);
  const image = await runtime.fetch(imagePath);
  expect(image.status).toBe(200);
  expect(image.headers.get("content-type")).toContain("image/png");

  // Upload limits: 10 MB and images only.
  const big = new FormData();
  big.append("file", new Blob([new Uint8Array(10 * 1024 * 1024 + 10)], { type: "image/png" }), "big.png");
  expect((await runtime.fetch(`/api/blogs/${blogId}/media`, { role: "owner", method: "POST", body: big })).status).toBe(413);
  const notImage = new FormData();
  notImage.append("file", new Blob(["hello"], { type: "text/plain" }), "notes.txt");
  expect((await runtime.fetch(`/api/blogs/${blogId}/media`, { role: "owner", method: "POST", body: notImage })).status).toBe(415);

  await page.goto(`/blogs/${blogId}/media`);
  await expect(page.getByTestId("media-row")).toHaveCount(1);
  await expect(page.getByTestId("media-row")).toContainText("larches.png");
  await expect(page.getByTestId("media-row")).toContainText("owner@example.test");
  await expect(page.getByTestId("media-row")).toContainText(/\d+ B/);

  // Labels on the public side.
  html = await (await runtime.fetch("/b/ridge-line")).text();
  expect(html).toContain("Day one on Maple Pass");
  expect(html).toContain("/b/ridge-line/label/trail%20reports");
  let label = await runtime.fetch("/b/ridge-line/label/trail%20reports");
  expect(label.status).toBe(200);
  expect(await label.text()).toContain("Day one on Maple Pass");

  // A second post: scheduled for the future is not public until its date passes.
  const scheduledId = await writePost(page, blogId, {
    title: "Packing list for larch season",
    labels: "gear",
    body: "Layers, a headlamp and more snacks than you think.",
    date: "2031-09-20T08:00",
    action: "Schedule",
  });
  expect((await runtime.fetch("/b/ridge-line/p/packing-list-for-larch-season")).status).toBe(404);
  const db = await runtime.database();
  await db.prepare("UPDATE posts SET published_at = ? WHERE id = ?").bind(Date.now() - 60_000, scheduledId).run();
  expect((await runtime.fetch("/b/ridge-line/p/packing-list-for-larch-season")).status).toBe(200);

  // Update a published post, then revert one to draft.
  await page.goto(`/blogs/${blogId}/posts/${firstId}`);
  await page.getByLabel("Title").fill("Day one on Maple Pass loop");
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await expect(page.getByText("Post updated")).toBeVisible();
  expect(await (await runtime.fetch("/b/ridge-line/p/day-one-on-maple-pass")).text()).toContain("Day one on Maple Pass loop");

  const draftId = await writePost(page, blogId, {
    title: "Notes on water filters",
    labels: "gear, washington",
    body: "Squeeze filters freeze; keep them in your sleeping bag.",
    action: "Publish now",
  });
  await page.getByRole("button", { name: "Revert to draft" }).click();
  await expect(page.getByTestId("post-status")).toHaveText("Draft");
  expect((await runtime.fetch("/b/ridge-line/p/notes-on-water-filters")).status).toBe(404);

  // The post list filters by status and labels and searches titles.
  await page.goto(`/blogs/${blogId}`);
  await expect(page.getByTestId("post-row")).toHaveCount(3);
  await page.getByTestId("status-draft").click();
  await expect(page.getByTestId("post-row")).toHaveCount(1);
  await expect(page.getByTestId("post-row")).toContainText("Notes on water filters");
  await page.getByTestId("status-all").click();
  await page.getByTestId("label-filter-gear").click();
  await expect(page.getByTestId("post-row")).toHaveCount(2);
  await page.getByTestId("label-filter-washington").click();
  await expect(page.getByTestId("post-row")).toHaveCount(1);
  await expect(page.getByTestId("post-row")).toContainText("Notes on water filters");
  await page.getByTestId("label-filter-gear").click();
  await page.getByTestId("label-filter-washington").click();
  await page.getByLabel("Search titles").fill("packing");
  await expect(page.getByTestId("post-row")).toHaveCount(1);
  await expect(page.getByTestId("post-row")).toContainText("Packing list for larch season");
  await page.getByLabel("Search titles").fill("");

  // Delete a post.
  await page.goto(`/blogs/${blogId}/posts/${draftId}`);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete post" }).click();
  await page.waitForURL(new RegExp(`/blogs/${blogId}$`));
  await expect(page.getByTestId("post-row")).toHaveCount(2);

  // Pagination on the blog home: ten posts per page, newest first.
  for (let i = 1; i <= 10; i++) {
    await db
      .prepare("INSERT INTO posts (id, blog_id, author_id, title, slug, body, status, published_at, created_at, updated_at) VALUES (?, ?, 'owner', ?, ?, 'Older entry.', 'published', ?, ?, ?)")
      .bind(`seed-${i}`, blogId, `Archive entry ${i}`, `archive-entry-${i}`, Date.UTC(2020, 0, i), Date.UTC(2020, 0, i), Date.UTC(2020, 0, i))
      .run();
  }
  html = await (await runtime.fetch("/b/ridge-line")).text();
  expect(html).toContain("Day one on Maple Pass loop");
  expect(html).not.toContain("Archive entry 1<");
  expect(html.indexOf("Packing list for larch season")).toBeLessThan(html.indexOf("Archive entry 10"));
  expect(html).toContain("/b/ridge-line?page=2");
  html = await (await runtime.fetch("/b/ridge-line?page=2")).text();
  expect(html).toContain("Archive entry 1<");
  expect(html).not.toContain("Day one on Maple Pass loop");

  // F003: standalone pages and the navigation.
  await writePage(page, blogId, { title: "About", slug: "about", body: "Two friends, one dog, many switchbacks.", action: "Publish" });
  await writePage(page, blogId, { title: "Contact", slug: "contact", body: "Write to us at the trailhead register.", action: "Publish" });
  await writePage(page, blogId, { title: "Gear wishlist", slug: "wishlist", body: "A lighter tent.", action: "Save draft" });
  expect((await runtime.fetch("/b/ridge-line/page/wishlist")).status).toBe(404);
  const about = await runtime.fetch("/b/ridge-line/page/about");
  expect(about.status).toBe(200);
  expect(await about.text()).toContain("many switchbacks");
  await page.goto(`/blogs/${blogId}/settings`);
  await page.getByRole("checkbox", { name: "Show Contact in navigation" }).click();
  await page.getByRole("checkbox", { name: "Show About in navigation" }).click();
  await page.getByRole("button", { name: "Save navigation" }).click();
  await expect(page.getByText("Navigation saved")).toBeVisible();
  html = await (await runtime.fetch("/b/ridge-line")).text();
  expect(html.indexOf('href="/b/ridge-line/page/contact"')).toBeGreaterThan(-1);
  expect(html.indexOf('href="/b/ridge-line/page/contact"')).toBeLessThan(html.indexOf('href="/b/ridge-line/page/about"'));
  await page.goto(`/blogs/${blogId}/settings`);
  await page.getByRole("button", { name: "Move About up" }).click();
  await page.getByRole("button", { name: "Save navigation" }).click();
  await expect(page.getByText("Navigation saved")).toBeVisible();
  html = await (await runtime.fetch("/b/ridge-line")).text();
  expect(html.indexOf('href="/b/ridge-line/page/about"')).toBeLessThan(html.indexOf('href="/b/ridge-line/page/contact"'));

  // F005: comments, held for approval by default.
  const postPath = "/b/ridge-line/p/day-one-on-maple-pass";
  let sent = await postComment(runtime, postPath, { name: "Priya", body: "Was the trail icy near the top?" });
  expect(sent.status).toBe(303);
  sent = await postComment(runtime, postPath, { name: "Deals4U", body: "Cheap boots here" });
  expect(sent.status).toBe(303);
  expect((await postComment(runtime, postPath, { name: "", body: "No name" })).status).toBe(400);
  html = await (await runtime.fetch(postPath)).text();
  expect(html).not.toContain("Was the trail icy");
  await page.goto(`/blogs/${blogId}/comments`);
  await expect(page.getByTestId("comment-row")).toHaveCount(2);
  await page.getByTestId("comment-row").filter({ hasText: "Was the trail icy" }).getByRole("button", { name: "Approve" }).click();
  await expect(page.getByTestId("comment-row")).toHaveCount(1);
  await page.getByTestId("comment-row").filter({ hasText: "Cheap boots" }).getByRole("button", { name: "Spam" }).click();
  await expect(page.getByTestId("comment-row")).toHaveCount(0);
  await page.getByRole("tab", { name: "Spam" }).click();
  await expect(page.getByTestId("comment-row")).toContainText("Cheap boots");
  await page.getByTestId("comment-row").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("comment-row")).toHaveCount(0);
  await page.getByRole("tab", { name: "Published" }).click();
  await expect(page.getByTestId("comment-row")).toContainText("Was the trail icy");
  html = await (await runtime.fetch(postPath)).text();
  expect(html).toContain("Was the trail icy near the top?");
  expect(html).toContain("Priya");
  expect(html).not.toContain("Cheap boots");

  await saveSettings(page, blogId, { moderation: "Publish immediately" });
  await postComment(runtime, postPath, { name: "Sam", body: "Thanks, heading up Saturday." });
  html = await (await runtime.fetch(postPath)).text();
  expect(html.indexOf("Was the trail icy")).toBeLessThan(html.indexOf("Thanks, heading up Saturday."));
  await saveSettings(page, blogId, { comments: "Members only" });
  expect((await postComment(runtime, postPath, { name: "Anon", body: "hi" })).status).toBe(403);
  expect((await postComment(runtime, postPath, { body: "Great photos from the pass." }, "member")).status).toBe(303);
  html = await (await runtime.fetch(postPath)).text();
  expect(html).toContain("Great photos from the pass.");
  await saveSettings(page, blogId, { comments: "Nobody" });
  expect((await postComment(runtime, postPath, { body: "late" }, "member")).status).toBe(403);
  html = await (await runtime.fetch(postPath)).text();
  expect(html).not.toContain('name="body"');
  await saveSettings(page, blogId, { comments: "Anyone" });

  // F006: team roles and reader access.
  const memberPage = await (await runtime.context("member")).newPage();
  await memberPage.goto("/");
  await expect(memberPage.getByText("No blogs yet.")).toBeVisible();
  await page.goto(`/blogs/${blogId}/team`);
  await expect(page.getByTestId("team-row")).toHaveCount(1);
  await choose(page, "Person", "member@example.test");
  await choose(page, "Role", "Author");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByTestId("team-row")).toHaveCount(2);
  await expect(page.getByTestId("team-row").filter({ hasText: "member@example.test" })).toContainText("Author");
  await memberPage.goto("/");
  await expect(memberPage.getByTestId("blog-row")).toContainText("Ridge Line Journal");
  await choose(page, "Role for owner@example.test", "Author");
  await expect(page.getByRole("alert")).toContainText("at least one admin");
  await choose(page, "Role for member@example.test", "Admin");
  await expect(page.getByTestId("team-row").filter({ hasText: "member@example.test" })).toContainText("Admin");
  await choose(page, "Role for member@example.test", "Author");
  await expect(page.getByTestId("team-row").filter({ hasText: "member@example.test" })).toContainText("Author");

  await saveSettings(page, blogId, { access: "Team only" });
  expect((await runtime.fetch("/b/ridge-line")).status).toBe(404);
  expect((await runtime.fetch(postPath)).status).toBe(404);
  expect((await runtime.fetch(imagePath)).status).toBe(404);
  expect((await runtime.fetch("/b/ridge-line", { role: "member" })).status).toBe(200);
  await page.goto(`/blogs/${blogId}/team`);
  await page.getByTestId("team-row").filter({ hasText: "member@example.test" }).getByRole("button", { name: "Remove" }).click();
  await expect(page.getByTestId("team-row")).toHaveCount(1);
  expect((await runtime.fetch("/b/ridge-line", { role: "member" })).status).toBe(404);
  await saveSettings(page, blogId, { access: "Public" });
  expect((await runtime.fetch("/b/ridge-line")).status).toBe(200);

  // F007: views from readers with their referring site; the team's own views don't count.
  for (const path of ["/b/ridge-line", postPath, postPath, "/b/ridge-line/page/about"]) {
    expect((await runtime.fetch(path, { headers: { referer: "https://trailforum.example.org/threads/42" } })).status).toBe(200);
  }
  await page.goto(`/blogs/${blogId}/stats`);
  const total = Number(await page.getByTestId("total-views").innerText());
  expect(total).toBeGreaterThanOrEqual(4);
  await expect(page.getByTestId("top-referrers")).toContainText("trailforum.example.org");
  await expect(page.getByTestId("top-content")).toContainText("Day one on Maple Pass loop");
  await expect(page.getByTestId("top-content")).toContainText("About");
  await page.goto(postPath);
  await expect(page.getByRole("heading", { level: 1, name: "Day one on Maple Pass loop" })).toBeVisible();
  await page.goto(`/blogs/${blogId}/stats`);
  await expect(page.getByTestId("total-views")).toHaveText(String(total));
  await page.getByRole("button", { name: "30 days" }).click();
  await expect(page.getByTestId("total-views")).toHaveText(String(total));

  // F001: edit and delete a blog.
  const spareId = await createBlog(page, { title: "Scratch pad", slug: "scratch-pad" });
  await page.goto(`/blogs/${spareId}/settings`);
  await page.getByLabel("Title").fill("Scratch notebook");
  await page.getByLabel("Address").fill("scratch-notebook");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();
  expect((await runtime.fetch("/b/scratch-pad")).status).toBe(404);
  expect(await (await runtime.fetch("/b/scratch-notebook")).text()).toContain("Scratch notebook");
  await page.getByRole("button", { name: "Delete blog" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete blog" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByTestId("blog-row")).toHaveCount(1);
  expect((await runtime.fetch("/b/scratch-notebook")).status).toBe(404);

  // Phone-sized smoke.
  const phone = await (await runtime.context("owner", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await phone.goto(`/blogs/${blogId}`);
  await expect(phone.getByRole("heading", { level: 1, name: "Ridge Line Journal" })).toBeVisible();
  await expect(phone.getByTestId("post-row").first()).toBeVisible();
  await runtime.assertBackLink(phone);

  // The journey ends on the post list with real posts on screen.
  await db.prepare("DELETE FROM posts WHERE id LIKE 'seed-%'").run();
  await writePost(page, blogId, {
    title: "Snow on Cutthroat Pass",
    labels: "trail reports",
    body: "Six inches of fresh snow above 6,000 feet. Microspikes were enough.",
    action: "Publish now",
  });
  await page.goto(`/blogs/${blogId}`);
  await expect(page.getByTestId("post-row")).toHaveCount(3);
  await runtime.assertBackLink(page);
  await runtime.screenshot(page);
} finally {
  await runtime.close();
}
