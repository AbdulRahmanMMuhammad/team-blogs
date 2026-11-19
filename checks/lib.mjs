// Shared steps for the packaged-release suites. Selectors follow the app's markup.
import { expect } from "/home/user/oss-new/control/runtime/index.mjs";

/** Creates a blog through the home page's dialog and returns its id (from the URL). */
export async function createBlog(page, { title, slug, description = "" }) {
  await page.goto("/");
  await page.getByTestId("new-blog").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel("Address").fill(slug);
  if (description) await dialog.getByLabel("Description").fill(description);
  await dialog.getByRole("button", { name: "Create blog" }).click();
  await page.waitForURL(/\/blogs\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  return new URL(page.url()).pathname.split("/")[2];
}

/** Writes a post in the editor. `action` is "Save draft", "Publish now" or "Schedule". Returns the post id. */
export async function writePost(page, blogId, { title, body, labels = "", slug = "", date = "", action }) {
  await page.goto(`/blogs/${blogId}/posts/new`);
  await page.getByLabel("Title").fill(title);
  if (slug) await page.getByLabel("Address").fill(slug);
  if (labels) await page.getByLabel("Labels").fill(labels);
  await page.getByLabel("Body").fill(body);
  if (date) await page.getByLabel("Publish date").fill(date);
  await page.getByRole("button", { name: action, exact: true }).click();
  await page.waitForURL(/\/posts\/(?!new)[^/]+$/);
  const expected = { "Save draft": "Draft", "Publish now": "Published", Schedule: "Scheduled" }[action];
  await expect(page.getByTestId("post-status")).toHaveText(expected);
  return new URL(page.url()).pathname.split("/").pop();
}

/** Writes a standalone page. `action` is "Save draft" or "Publish". */
export async function writePage(page, blogId, { title, slug, body, action }) {
  await page.goto(`/blogs/${blogId}/pages/new`);
  await page.getByLabel("Title").fill(title);
  if (slug) await page.getByLabel("Address").fill(slug);
  await page.getByLabel("Body").fill(body);
  await page.getByRole("button", { name: action, exact: true }).click();
  await page.waitForURL(/\/pages\/(?!new)[^/]+$/);
  await expect(page.getByTestId("page-status")).toHaveText(action === "Publish" ? "Published" : "Draft");
  return new URL(page.url()).pathname.split("/").pop();
}

/** Picks an option in one of the app's select menus. */
export async function choose(page, triggerLabel, option) {
  await page.getByLabel(triggerLabel, { exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

/** Changes blog settings on the settings page and saves. */
export async function saveSettings(page, blogId, { access, comments, moderation } = {}) {
  await page.goto(`/blogs/${blogId}/settings`);
  if (access) await page.getByRole("radio", { name: access, exact: true }).click();
  if (comments) await page.getByRole("radio", { name: comments, exact: true }).click();
  if (moderation) await page.getByRole("radio", { name: moderation, exact: true }).click();
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();
}

export async function postComment(runtime, path, fields, role) {
  return runtime.fetch(`${path}/comments`, {
    role,
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

export async function text(response) {
  return await response.text();
}

/** A tiny valid PNG. */
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
