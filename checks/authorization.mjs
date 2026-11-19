// Authorization: private paths, what public routes expose, ownership between members,
// blog-admin-only actions, and no sign-in of the app's own (X001).
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { createBlog, writePost, writePage, choose, saveSettings, postComment, PNG } from "./lib.mjs";

const runtime = await startRuntime();
try {
  await runtime.assertPrivateAccess(["/"]);
  for (const role of [undefined, "outsider"]) {
    for (const path of ["/blogs/anything", "/blogs/anything/posts/new", "/health"]) {
      const response = await runtime.fetch(path, { role });
      expect([401, 403, 404]).toContain(response.status);
    }
  }

  // The app serves no sign-in of its own.
  for (const path of ["/login", "/signin", "/signup", "/logout", "/register"]) {
    for (const role of [undefined, "owner"]) {
      const response = await runtime.fetch(path, { role });
      expect(response.status).not.toBe(200);
      expect(await response.text()).not.toMatch(/type="password"/i);
    }
  }

  const owner = await (await runtime.context("owner")).newPage();
  const member = await (await runtime.context("member")).newPage();
  await member.goto("/");
  await expect(member.getByText("No blogs yet.")).toBeVisible();

  const blogId = await createBlog(owner, { title: "Kitchen Ledger", slug: "kitchen-ledger", description: "Recipes we keep coming back to." });
  const publishedId = await writePost(owner, blogId, { title: "Sourdough schedule", labels: "bread", body: "Feed the starter at night.", action: "Publish now" });
  await writePost(owner, blogId, { title: "Secret menu ideas", body: "Unreleased cardamom buns.", action: "Save draft" });
  await writePost(owner, blogId, { title: "Holiday menu", body: "Roast squash.", date: "2032-12-01T09:00", action: "Schedule" });
  await writePage(owner, blogId, { title: "Private notes", slug: "private-notes", body: "Supplier prices.", action: "Save draft" });

  // Public routes expose only published work and approved comments.
  let html = await (await runtime.fetch("/b/kitchen-ledger")).text();
  expect(html).toContain("Sourdough schedule");
  expect(html).not.toContain("Secret menu ideas");
  expect(html).not.toContain("Holiday menu");
  expect((await runtime.fetch("/b/kitchen-ledger/p/secret-menu-ideas")).status).toBe(404);
  expect((await runtime.fetch("/b/kitchen-ledger/p/holiday-menu")).status).toBe(404);
  expect((await runtime.fetch("/b/kitchen-ledger/page/private-notes")).status).toBe(404);
  expect((await runtime.fetch("/b/no-such-blog")).status).toBe(404);
  expect((await postComment(runtime, "/b/kitchen-ledger/p/secret-menu-ideas", { name: "A", body: "x" })).status).toBe(404);
  await postComment(runtime, "/b/kitchen-ledger/p/sourdough-schedule", { name: "Lee", body: "Pending remark about rye" });
  expect(await (await runtime.fetch("/b/kitchen-ledger/p/sourdough-schedule")).text()).not.toContain("Pending remark about rye");
  // Only GET pages and comment POSTs are public.
  expect([401, 403, 404, 405]).toContain((await runtime.fetch("/b/kitchen-ledger", { method: "POST" })).status);
  expect([401, 403]).toContain((await runtime.fetch(`/api/blogs/${blogId}/media`, { method: "POST", body: new FormData() })).status);

  // Images: uploaded by the owner, then hidden with the blog.
  const form = new FormData();
  form.append("file", new Blob([PNG], { type: "image/png" }), "crumb.png");
  const uploaded = await runtime.fetch(`/api/blogs/${blogId}/media`, { role: "owner", method: "POST", body: form });
  expect(uploaded.status).toBe(201);
  const { id: mediaId, url: mediaUrl } = await uploaded.json();
  expect(new URL(mediaUrl, `http://${runtime.hostname}`).hostname).toBe(runtime.hostname);
  const mediaPath = new URL(mediaUrl, `http://${runtime.hostname}`).pathname;
  expect((await runtime.fetch(mediaPath)).status).toBe(200);

  // A member outside the blog's team can neither read nor change it.
  for (const path of [`/blogs/${blogId}`, `/blogs/${blogId}/posts/${publishedId}`, `/blogs/${blogId}/settings`, `/blogs/${blogId}/comments`, `/blogs/${blogId}/stats`, `/blogs/${blogId}/media`, `/blogs/${blogId}/team`]) {
    await member.goto(path);
    await expect(member.getByTestId("not-found")).toBeVisible();
    await expect(member.getByText("Sourdough schedule")).toHaveCount(0);
  }
  await member.goto("/");
  await expect(member.getByTestId("blog-row")).toHaveCount(0);
  const memberUpload = new FormData();
  memberUpload.append("file", new Blob([PNG], { type: "image/png" }), "x.png");
  expect((await runtime.fetch(`/api/blogs/${blogId}/media`, { role: "member", method: "POST", body: memberUpload })).status).toBe(404);
  expect((await runtime.fetch(`/api/blogs/${blogId}/media/${mediaId}`, { role: "member", method: "DELETE" })).status).toBe(404);
  expect((await runtime.fetch(mediaPath)).status).toBe(200);

  // Members-only comments need a signed-in member; the outsider is not one.
  await saveSettings(owner, blogId, { comments: "Members only" });
  expect((await postComment(runtime, "/b/kitchen-ledger/p/sourdough-schedule", { name: "Out", body: "outsider" }, "outsider")).status).not.toBe(303);
  expect((await postComment(runtime, "/b/kitchen-ledger/p/sourdough-schedule", { name: "Anon", body: "anon" })).status).toBe(403);
  await saveSettings(owner, blogId, { comments: "Anyone" });

  // Team only: nobody outside the team sees the public pages or images.
  await saveSettings(owner, blogId, { access: "Team only" });
  for (const role of [undefined, "member", "outsider"]) {
    for (const path of ["/b/kitchen-ledger", "/b/kitchen-ledger/p/sourdough-schedule", "/b/kitchen-ledger/label/bread", mediaPath]) {
      const response = await runtime.fetch(path, { role });
      expect(response.status).not.toBe(200);
      expect(await response.text()).not.toContain("Sourdough schedule");
    }
    expect((await postComment(runtime, "/b/kitchen-ledger/p/sourdough-schedule", { name: "X", body: "y" }, role)).status).not.toBe(303);
  }
  expect((await runtime.fetch("/b/kitchen-ledger", { role: "owner" })).status).toBe(200);
  await saveSettings(owner, blogId, { access: "Public" });

  // As an author, the member writes their own posts but can't change the owner's or run admin actions.
  await owner.goto(`/blogs/${blogId}/team`);
  await choose(owner, "Person", "member@example.test");
  await choose(owner, "Role", "Author");
  await owner.getByRole("button", { name: "Add", exact: true }).click();
  await expect(owner.getByTestId("team-row")).toHaveCount(2);

  await member.goto(`/blogs/${blogId}`);
  await expect(member.getByTestId("post-row").filter({ hasText: "Sourdough schedule" })).toBeVisible();
  await member.goto(`/blogs/${blogId}/posts/${publishedId}`);
  await expect(member.getByTestId("no-access")).toBeVisible();
  await expect(member.getByRole("button", { name: "Update" })).toHaveCount(0);
  await expect(member.getByRole("button", { name: "Delete" })).toHaveCount(0);
  const ownPost = await writePost(member, blogId, { title: "Rye crackers", body: "Thin and salty.", action: "Publish now" });
  expect((await runtime.fetch("/b/kitchen-ledger/p/rye-crackers")).status).toBe(200);
  await member.goto(`/blogs/${blogId}/settings`);
  await expect(member.getByTestId("no-access")).toBeVisible();
  await expect(member.getByRole("button", { name: "Save settings" })).toHaveCount(0);
  await expect(member.getByRole("button", { name: "Delete blog" })).toHaveCount(0);
  await member.goto(`/blogs/${blogId}/team`);
  await expect(member.getByTestId("team-row")).toHaveCount(2);
  await expect(member.getByRole("button", { name: "Add", exact: true })).toHaveCount(0);
  await expect(member.getByRole("button", { name: "Remove" })).toHaveCount(0);
  // The comment queue shows an author only comments on their own posts.
  await postComment(runtime, "/b/kitchen-ledger/p/rye-crackers", { name: "Kim", body: "Recipe for the crackers please" });
  await member.goto(`/blogs/${blogId}/comments`);
  await expect(member.getByTestId("comment-row")).toHaveCount(1);
  await expect(member.getByTestId("comment-row")).toContainText("Recipe for the crackers please");
  // An author can't delete someone else's image; the uploader or a blog admin can.
  expect((await runtime.fetch(`/api/blogs/${blogId}/media/${mediaId}`, { role: "member", method: "DELETE" })).status).toBe(403);
  await member.goto(`/blogs/${blogId}/media`);
  await expect(member.getByTestId("media-row").filter({ hasText: "crumb.png" }).getByRole("button", { name: "Delete" })).toHaveCount(0);
  expect((await runtime.fetch(`/api/blogs/${blogId}/media/${mediaId}`, { role: "owner", method: "DELETE" })).status).toBe(204);
  expect((await runtime.fetch(mediaPath)).status).toBe(404);
  // The owner, a blog admin, can still change the author's post.
  await owner.goto(`/blogs/${blogId}/posts/${ownPost}`);
  await expect(owner.getByRole("button", { name: "Update", exact: true })).toBeVisible();

  // The last admin can't be removed or demoted.
  await owner.goto(`/blogs/${blogId}/team`);
  await owner.getByTestId("team-row").filter({ hasText: "owner@example.test" }).getByRole("button", { name: "Remove" }).click();
  await expect(owner.getByRole("alert")).toContainText("at least one admin");
  await expect(owner.getByTestId("team-row")).toHaveCount(2);

  // The member's own blog stays theirs: the owner sees it only as an organization admin, and the outsider never.
  const memberBlog = await createBlog(member, { title: "Garden Diary", slug: "garden-diary" });
  await writePost(member, memberBlog, { title: "Tomato starts", body: "Draft notes.", action: "Save draft" });
  expect((await runtime.fetch(`/blogs/${memberBlog}`, { role: "outsider" })).status).not.toBe(200);
  expect((await runtime.fetch("/b/garden-diary/p/tomato-starts", { role: "outsider" })).status).toBe(404);
} finally {
  await runtime.close();
}
