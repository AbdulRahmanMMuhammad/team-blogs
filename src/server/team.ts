import { and, asc, eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { blogMembers, users } from "@/db/schema";
import {
  AppError,
  requireBlog,
  requireBlogAdmin,
  type Viewer,
} from "./access";

export const memberInput = z.object({
  blogId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(["admin", "author"]),
});
export const removeInput = z.object({
  blogId: z.string().min(1),
  userId: z.string().min(1),
});

const LAST_ADMIN = "A blog needs at least one admin.";

export async function listTeam(user: Viewer, blogId: string) {
  const access = await requireBlog(user, blogId);
  const team = await db
    .select({ userId: blogMembers.userId, role: blogMembers.role, email: users.email })
    .from(blogMembers)
    .leftJoin(users, eq(users.id, blogMembers.userId))
    .where(eq(blogMembers.blogId, blogId))
    .orderBy(asc(users.email));
  const candidates = access.isAdmin
    ? await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(
          and(
            eq(users.orgId, user.orgId),
            team.length
              ? notInArray(users.id, team.map((member) => member.userId))
              : undefined,
          ),
        )
        .orderBy(asc(users.email))
    : [];
  return {
    access,
    team: team.map((member) => ({ ...member, email: member.email ?? "" })),
    candidates,
  };
}

async function adminCount(blogId: string) {
  const admins = await db
    .select({ userId: blogMembers.userId })
    .from(blogMembers)
    .where(and(eq(blogMembers.blogId, blogId), eq(blogMembers.role, "admin")));
  return admins.length;
}

export async function addMember(
  user: Viewer,
  input: z.infer<typeof memberInput>,
) {
  await requireBlogAdmin(user, input.blogId);
  const [person] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, input.userId), eq(users.orgId, user.orgId)));
  if (!person) throw new AppError("Pick someone from your organization.");
  await db
    .insert(blogMembers)
    .values(input)
    .onConflictDoUpdate({
      target: [blogMembers.blogId, blogMembers.userId],
      set: { role: input.role },
    });
  return { ok: true };
}

export async function setRole(user: Viewer, input: z.infer<typeof memberInput>) {
  await requireBlogAdmin(user, input.blogId);
  const where = and(
    eq(blogMembers.blogId, input.blogId),
    eq(blogMembers.userId, input.userId),
  );
  const [current] = await db.select().from(blogMembers).where(where);
  if (!current) throw new AppError("That person isn't on the team.");
  if (
    current.role === "admin" &&
    input.role !== "admin" &&
    (await adminCount(input.blogId)) <= 1
  )
    throw new AppError(LAST_ADMIN);
  await db.update(blogMembers).set({ role: input.role }).where(where);
  return { ok: true };
}

export async function removeMember(
  user: Viewer,
  input: z.infer<typeof removeInput>,
) {
  await requireBlogAdmin(user, input.blogId);
  const where = and(
    eq(blogMembers.blogId, input.blogId),
    eq(blogMembers.userId, input.userId),
  );
  const [current] = await db.select().from(blogMembers).where(where);
  if (!current) throw new AppError("That person isn't on the team.");
  if (current.role === "admin" && (await adminCount(input.blogId)) <= 1)
    throw new AppError(LAST_ADMIN);
  await db.delete(blogMembers).where(where);
  return { ok: true };
}
