import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { getEveryAppUser } from "@every-app/sdk/server";
import { deleteMedia } from "@/server/media";

// Deletes an uploaded image: its uploader or a blog admin.
export const Route = createFileRoute("/api/blogs/$blogId/media/$mediaId")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        const user = await getEveryAppUser(request, env);
        if (!user) return new Response(null, { status: 401 });
        const status = await deleteMedia(user, params.blogId, params.mediaId);
        return new Response(null, { status });
      },
    },
  },
});
