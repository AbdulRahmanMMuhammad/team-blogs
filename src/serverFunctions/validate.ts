import type { z } from "zod";

/** A validator whose error is the first problem in plain words, for the page to show. */
export function validate<T extends z.ZodType>(schema: T) {
  return (data: unknown): z.infer<T> => {
    const result = schema.safeParse(data);
    if (!result.success)
      throw new Error(result.error.issues[0]?.message ?? "Check the form.");
    return result.data;
  };
}
