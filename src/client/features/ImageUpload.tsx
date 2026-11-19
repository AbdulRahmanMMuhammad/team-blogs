import { ImagePlus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/client/components/ui/button";

/** Uploads an image to the blog and hands back the Markdown that shows it. */
export function ImageUpload({
  blogId,
  onInsert,
}: {
  blogId: string;
  onInsert: (markdown: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

  async function upload(file: File) {
    setPending(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`/api/blogs/${blogId}/media`, { method: "POST", body: form });
      const result = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !result.url) throw new Error(result.error ?? "The upload failed.");
      const alt = file.name.replace(/\.[^.]+$/, "").replace(/[[\]]/g, "");
      onInsert(`![${alt}](${result.url})`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The upload failed.");
    } finally {
      setPending(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
        className="sr-only"
        aria-label="Image file"
        data-testid="image-upload"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        pending={pending}
        onClick={() => input.current?.click()}
      >
        <ImagePlus aria-hidden />
        Insert image
      </Button>
    </>
  );
}

/** Inserts text at the textarea's cursor (or the end), on its own lines. */
export function insertAt(
  textarea: HTMLTextAreaElement | null,
  body: string,
  text: string,
): string {
  const at = textarea?.selectionStart ?? body.length;
  const before = body.slice(0, at);
  const after = body.slice(at);
  const lead = before && !before.endsWith("\n") ? "\n\n" : "";
  const tail = after && !after.startsWith("\n") ? "\n\n" : "";
  return `${before}${lead}${text}${tail}${after}`;
}
