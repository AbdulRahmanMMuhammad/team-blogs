import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { BlogShell, messageOf } from "@/client/components/BlogShell";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { addMember, getTeam, removeMember, setRole } from "@/serverFunctions/blogs";

export const Route = createFileRoute("/blogs/$blogId/team")({
  loader: async ({ params }) => {
    const data = await getTeam({ data: { blogId: params.blogId } });
    if (!data) throw notFound();
    return data;
  },
  head: () => ({ meta: [{ title: "Team" }] }),
  component: Team,
});

type Role = "admin" | "author";
const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "author", label: "Author" },
];

function Team() {
  const { blog, team, candidates, me } = Route.useLoaderData();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [role, setNewRole] = useState<Role>("author");
  const [pending, setPending] = useState(false);

  async function change(work: () => Promise<unknown>) {
    setError(null);
    setPending(true);
    try {
      await work();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      await router.invalidate();
      setPending(false);
    }
  }

  const people = candidates.map((c) => ({ value: c.id, label: c.email }));

  return (
    <BlogShell blog={blog}>
      <div className="space-y-6">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {team.map((member) => (
            <li key={member.userId} data-testid="team-row" className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="min-w-0 flex-1 truncate">
                {member.email}
                {member.userId === me ? <span className="text-muted-foreground"> (you)</span> : null}
              </span>
              {blog.isAdmin ? (
                <>
                  <Select
                    key={`${member.userId}:${member.role}`}
                    items={ROLES}
                    value={member.role}
                    disabled={pending}
                    onValueChange={(value) => {
                      if (value && value !== member.role)
                        void change(() =>
                          setRole({ data: { blogId: blog.id, userId: member.userId, role: value as Role } }),
                        );
                    }}
                  >
                    <SelectTrigger size="sm" aria-label={`Role for ${member.email}`} className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => change(() => removeMember({ data: { blogId: blog.id, userId: member.userId } }))}
                  >
                    Remove
                  </Button>
                </>
              ) : (
                <Badge variant="secondary">{member.role === "admin" ? "Admin" : "Author"}</Badge>
              )}
            </li>
          ))}
        </ul>

        {blog.isAdmin ? (
          <section className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight">Add to the team</h2>
            {people.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Everyone who has opened this app is already on the team. Others appear here after their first visit.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Select items={people} value={person} onValueChange={(value) => setPerson(value as string | null)}>
                  <SelectTrigger aria-label="Person" className="min-w-56 bg-card">
                    <SelectValue placeholder="Choose a person" />
                  </SelectTrigger>
                  <SelectContent>
                    {people.map((item) => (
                      <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select items={ROLES} value={role} onValueChange={(value) => value && setNewRole(value as Role)}>
                  <SelectTrigger aria-label="Role" className="w-28 bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  disabled={!person || pending}
                  onClick={() =>
                    person &&
                    change(async () => {
                      await addMember({ data: { blogId: blog.id, userId: person, role } });
                      setPerson(null);
                    })
                  }
                >
                  Add
                </Button>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Authors write and manage their own posts and pages. Admins manage everything in the blog.
            </p>
          </section>
        ) : null}
      </div>
    </BlogShell>
  );
}
