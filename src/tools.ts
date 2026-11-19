// The app's tools for AI clients, served by the Gateway at /mcp with the
// signed-in user. They call the same scoped queries as the pages.
import { ToolError, defineTools } from "@every-app/sdk/server";
import { z } from "zod";
import { AppError } from "@/server/access";
import * as blogs from "@/server/blogs";
import * as posts from "@/server/posts";

export const tools = defineTools(
  {
    list_blogs: {
      description: "List the blogs the user is on the team of, with their public address.",
      risk: "read",
      input: z.object({}).strict(),
      handler: (_input, { user }) => blogs.listMyBlogs(user),
    },
    list_posts: {
      description: "List one blog's posts with their state (draft, scheduled, published) and labels.",
      risk: "read",
      input: z.object({ blogId: z.string() }).strict(),
      handler: async ({ blogId }, { user }) => {
        try {
          return (await posts.listPosts(user, blogId)).posts;
        } catch (error) {
          if (error instanceof AppError) throw new ToolError(error.message);
          throw error;
        }
      },
    },
  },
  { instructions: "Call list_blogs first to learn blog ids." },
);
