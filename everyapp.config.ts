import { defineEveryApp } from "@every-app/sdk";

// defineEveryApp types the manifest. The Gateway keeps it; the Worker gets
// the bindings it lists (env.DB, env.media), never the file.
export default defineEveryApp({
  id: "team-blogs",
  name: "Team Blogs",
  description:
    "Write and publish blogs with your team, with drafts, scheduled posts, pages, images, comments and reader stats.",
  access: "everyone",
  resources: {
    d1: ["DB"],
    r2: ["media"],
  },
  // Readers outside the organization open published blogs, and may comment.
  // Every handler under /b/ checks the blog's reader access itself and
  // answers 404 for a team-only blog to anyone off its team.
  public: [
    { path: "/b/**", methods: ["GET"] },
    { path: "/b/:slug/p/:postSlug/comments", methods: ["POST"] },
  ],
  // The stylesheet and icon the public blog pages load.
  publicAssets: ["/assets/**", "/icon.svg"],
});
