// Persistence: blogs, posts, pages, comments, images and views survive a restart.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { createBlog, writePost, writePage, postComment, PNG } from "./lib.mjs";

const runtime = await startRuntime();
try {
  let page = await (await runtime.context("owner")).newPage();
  const blogId = await createBlog(page, { title: "Harbor Log", slug: "harbor-log", description: "Sailing notes." });
  await writePost(page, blogId, { title: "First sail of spring", labels: "sailing", body: "Light winds out of the west.", action: "Publish now" });
  await writePage(page, blogId, { title: "Our boat", slug: "boat", body: "A 26-foot sloop.", action: "Publish" });
  const form = new FormData();
  form.append("file", new Blob([PNG], { type: "image/png" }), "mooring.png");
  const uploaded = await runtime.fetch(`/api/blogs/${blogId}/media`, { role: "owner", method: "POST", body: form });
  expect(uploaded.status).toBe(201);
  const mediaPath = new URL((await uploaded.json()).url, `http://${runtime.hostname}`).pathname;
  await postComment(runtime, "/b/harbor-log/p/first-sail-of-spring", { name: "Ana", body: "Fair winds!" });
  expect((await runtime.fetch("/b/harbor-log", { headers: { referer: "https://sailing.example.net/" } })).status).toBe(200);

  await runtime.restart();

  const post = await runtime.fetch("/b/harbor-log/p/first-sail-of-spring");
  expect(post.status).toBe(200);
  expect(await post.text()).toContain("Light winds out of the west.");
  expect(await (await runtime.fetch("/b/harbor-log/page/boat")).text()).toContain("26-foot sloop");
  expect((await runtime.fetch(mediaPath)).status).toBe(200);
  page = await (await runtime.context("owner")).newPage();
  await page.goto(`/blogs/${blogId}`);
  await expect(page.getByTestId("post-row")).toContainText("First sail of spring");
  await page.goto(`/blogs/${blogId}/comments`);
  await expect(page.getByTestId("comment-row")).toContainText("Fair winds!");
  await page.goto(`/blogs/${blogId}/stats`);
  await expect(page.getByTestId("top-referrers")).toContainText("sailing.example.net");
} finally {
  await runtime.close();
}
