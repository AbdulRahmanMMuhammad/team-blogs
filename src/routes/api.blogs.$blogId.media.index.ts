import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { getEveryAppUser } from "@every-app/sdk/server";
import { rememberUser } from "@/server/access";
import { uploadMedia } from "@/server/media";
import { MAX_IMAGE_BYTES } from "@/shared/text";

// Image upload from the post and page editors (multipart, field "file").
// Private: the Gateway admits only signed-in members.
export const Route = createFileRoute("/api/blogs/$blogId/media/")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const user = await getEveryAppUser(request, env);
        if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
        await rememberUser(user);
        const length = Number(request.headers.get("content-length") ?? "0");
        if (length > MAX_IMAGE_BYTES + 64 * 1024)
          return Response.json({ error: "Images can be up to 10 MB." }, { status: 413 });
        const form = await request.formData().catch(() => null);
        const file = form?.get("file");
        if (!(file instanceof File))
          return Response.json({ error: "Choose an image to upload." }, { status: 400 });
        const result = await uploadMedia(user, params.blogId, file);
        if (result.status !== 201)
          return Response.json({ error: result.error }, { status: result.status });
        return Response.json(
          { id: result.id, url: result.url, filename: result.filename },
          { status: 201 },
        );
      },
    },
  },
});
