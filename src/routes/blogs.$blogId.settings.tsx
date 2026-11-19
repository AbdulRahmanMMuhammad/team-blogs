import { createFileRoute, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { BlogShell, NoAccess, messageOf } from "@/client/components/BlogShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/client/components/ui/radio-group";
import { Textarea } from "@/client/components/ui/textarea";
import { deleteBlog, getSettings, saveNavigation, updateBlog } from "@/serverFunctions/blogs";

export const Route = createFileRoute("/blogs/$blogId/settings")({
  loader: async ({ params }) => {
    const data = await getSettings({ data: { blogId: params.blogId } });
    if (!data) throw notFound();
    return data;
  },
  head: () => ({ meta: [{ title: "Settings" }] }),
  component: Settings,
});

function Settings() {
  const { blog, settings, pages } = Route.useLoaderData();
  if (!blog.isAdmin)
    return (
      <BlogShell blog={blog}>
        <NoAccess>Only blog admins can change these settings.</NoAccess>
      </BlogShell>
    );
  return (
    <BlogShell blog={blog}>
      <BlogForm key={JSON.stringify(settings)} blogId={blog.id} initial={settings} />
      <Navigation key={JSON.stringify(pages)} blogId={blog.id} pages={pages} />
      <DangerZone blogId={blog.id} title={blog.title} />
    </BlogShell>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <div className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-xs">{children}</div>
    </section>
  );
}

function Choice({
  legend,
  value,
  onChange,
  options,
}: {
  legend: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; hint?: string }[];
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <RadioGroup value={value} onValueChange={(next) => onChange(next as string)}>
        {options.map((option) => (
          <label key={option.value} className="flex items-start gap-3 text-sm">
            <RadioGroupItem value={option.value} aria-label={option.label} className="mt-0.5" />
            <span>
              <span className="font-medium">{option.label}</span>
              {option.hint ? <span className="block text-muted-foreground">{option.hint}</span> : null}
            </span>
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

type SettingsData = ReturnType<typeof Route.useLoaderData>["settings"];

function BlogForm({ blogId, initial }: { blogId: string; initial: SettingsData }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    setError(null);
    setPending(true);
    try {
      await updateBlog({ data: { blogId, ...form } });
      toast.success("Settings saved");
      await router.invalidate();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Section title="Blog">
        <div className="space-y-2">
          <Label htmlFor="settings-title">Title</Label>
          <Input id="settings-title" value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-slug">Address</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">/b/</span>
            <Input id="settings-slug" value={form.slug} maxLength={60} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </div>
          {form.slug !== initial.slug ? (
            <p className="text-sm text-muted-foreground">Links to the old address, including image links in posts, stop working.</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-description">Description</Label>
          <Textarea id="settings-description" value={form.description} maxLength={500} rows={3} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
      </Section>
      <Section title="Readers and comments">
        <Choice
          legend="Who can read"
          value={form.access}
          onChange={(access) => setForm({ ...form, access: access as SettingsData["access"] })}
          options={[
            { value: "public", label: "Public", hint: "Anyone with the link." },
            { value: "team", label: "Team only", hint: "Only this blog's team." },
          ]}
        />
        <Choice
          legend="Who can comment"
          value={form.commentPolicy}
          onChange={(policy) => setForm({ ...form, commentPolicy: policy as SettingsData["commentPolicy"] })}
          options={[
            { value: "anyone", label: "Anyone", hint: "Readers give a name." },
            { value: "members", label: "Members only", hint: "People signed in to your organization." },
            { value: "nobody", label: "Nobody" },
          ]}
        />
        <Choice
          legend="New comments"
          value={form.moderation}
          onChange={(moderation) => setForm({ ...form, moderation: moderation as SettingsData["moderation"] })}
          options={[
            { value: "hold", label: "Hold for approval" },
            { value: "publish", label: "Publish immediately" },
          ]}
        />
      </Section>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" pending={pending}>Save settings</Button>
    </form>
  );
}

function Navigation({
  blogId,
  pages,
}: {
  blogId: string;
  pages: { id: string; title: string; navPosition: number | null }[];
}) {
  const [order, setOrder] = useState(() =>
    pages
      .filter((page) => page.navPosition !== null)
      .sort((a, b) => a.navPosition! - b.navPosition!)
      .map((page) => page.id),
  );
  const [pending, setPending] = useState(false);
  const byId = new Map(pages.map((page) => [page.id, page]));
  const listed = [...order, ...pages.filter((page) => !order.includes(page.id)).map((page) => page.id)];

  function move(id: string, by: number) {
    const at = order.indexOf(id);
    const to = at + by;
    if (at < 0 || to < 0 || to >= order.length) return;
    const next = [...order];
    [next[at], next[to]] = [next[to]!, next[at]!];
    setOrder(next);
  }

  async function save() {
    setPending(true);
    try {
      await saveNavigation({ data: { blogId, pageIds: order } });
      toast.success("Navigation saved");
    } catch (cause) {
      toast.error(messageOf(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <Section title="Navigation">
      {pages.length === 0 ? (
        <p className="text-sm text-muted-foreground">Published pages can be added to the blog's navigation.</p>
      ) : (
        <>
          <ul className="space-y-1">
            {listed.map((id) => {
              const page = byId.get(id)!;
              const at = order.indexOf(id);
              return (
                <li key={id} className="flex items-center gap-3">
                  <Checkbox
                    checked={at >= 0}
                    aria-label={`Show ${page.title} in navigation`}
                    onCheckedChange={(checked) =>
                      setOrder(checked ? [...order, id] : order.filter((other) => other !== id))
                    }
                  />
                  <span className="flex-1 text-sm">{page.title}</span>
                  {at >= 0 ? (
                    <>
                      <Button type="button" size="icon-sm" variant="ghost" aria-label={`Move ${page.title} up`} disabled={at === 0} onClick={() => move(id, -1)}>
                        <ArrowUp />
                      </Button>
                      <Button type="button" size="icon-sm" variant="ghost" aria-label={`Move ${page.title} down`} disabled={at === order.length - 1} onClick={() => move(id, 1)}>
                        <ArrowDown />
                      </Button>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <Button variant="outline" pending={pending} onClick={save}>Save navigation</Button>
        </>
      )}
    </Section>
  );
}

function DangerZone({ blogId, title }: { blogId: string; title: string }) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <Section title="Delete blog">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Deletes every post, page, comment, image and stat in it.</p>
        <Button variant="destructive" onClick={() => setConfirming(true)}>Delete blog</Button>
      </div>
      {confirming ? (
        <ConfirmDialog
          title={`Delete ${title}?`}
          confirmLabel="Delete blog"
          destructive
          pending={pending}
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            setPending(true);
            try {
              await deleteBlog({ data: { blogId } });
              toast.success("Blog deleted");
              await navigate({ to: "/" });
            } catch (cause) {
              toast.error(messageOf(cause));
              setPending(false);
              setConfirming(false);
            }
          }}
        />
      ) : null}
    </Section>
  );
}
