import { vi } from "vitest";

// toPlainObject は FormData/URLSearchParams を zod 検証用の plain object に変換する。
function toPlainObject(input: FormData | URLSearchParams): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};

  for (const [key, value] of input.entries()) {
    const normalizedValue = typeof value === "string" ? value : "";
    const currentValue = mapped[key];
    if (typeof currentValue === "undefined") {
      mapped[key] = normalizedValue;
      continue;
    }

    if (Array.isArray(currentValue)) {
      currentValue.push(normalizedValue);
      continue;
    }

    mapped[key] = [currentValue, normalizedValue];
  }

  return mapped;
}

// toFieldErrors は zod issue 配列を route で参照しやすい map 形式へ変換する。
function toFieldErrors(issues: Array<{ message: string; path: PropertyKey[] }>): Record<string, string[]> {
  const mapped: Record<string, string[]> = {};
  for (const issue of issues) {
    const firstPath = issue.path[0];
    const key = typeof firstPath === "symbol" ? firstPath.toString() : String(firstPath ?? "form");
    if (!mapped[key]) {
      mapped[key] = [];
    }
    mapped[key].push(issue.message);
  }
  return mapped;
}

vi.mock("@conform-to/zod", async () => {
  const zodModule = await import("zod");

  return {
    // getZodConstraint は UI 側の補助用途なので統合テストでは空制約を返す。
    getZodConstraint: () => ({}),
    // parseWithZod は action で使う最小要件（status/value/error/reply）だけを実装する。
    parseWithZod: (
      value: FormData | URLSearchParams,
      options: { schema: { safeParse: (data: unknown) => ReturnType<typeof zodModule.z.safeParse> } },
    ) => {
      const parsed = options.schema.safeParse(toPlainObject(value));
      if (parsed.success) {
        return {
          status: "success" as const,
          value: parsed.data,
          reply: (replyOptions?: unknown) => replyOptions ?? {},
        };
      }

      const fieldErrors = toFieldErrors(parsed.error.issues);
      return {
        status: "error" as const,
        error: fieldErrors,
        reply: (replyOptions?: Record<string, unknown>) => ({
          fieldErrors,
          formErrors: parsed.error.flatten().formErrors,
          ...(replyOptions ?? {}),
        }),
      };
    },
  };
});
