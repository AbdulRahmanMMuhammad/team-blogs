import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { mediaKey } from "@/server/blogs";
import { mediaFile } from "@/server/public";
import { openBlog } from "@/server/publicRoute";

// An uploaded image, readable by whoever may read its blog.
export const Route = createFileRoute("/b/$slug/media/$mediaId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const found = await openBlog(request, params.slug);
        const file = found ? await mediaFile(params.mediaId) : null;
        if (!found || !file || file.blogId !== found.blog.id)
          return new Response("Not found", { status: 404 });
        const object = await env.media.get(mediaKey(file.blogId, params.mediaId));
        if (!object) return new Response("Not found", { status: 404 });
        return new Response(object.body, {
          headers: {
            "content-type": file.contentType,
            "cache-control": found.blog.access === "public" ? "public, max-age=300" : "private, no-store",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
