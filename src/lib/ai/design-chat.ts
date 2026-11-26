import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "../auth/middleware.ts";
import {
  cleanContext,
  cleanHistory,
  parseAnswer,
  systemPrompt,
  turnPrompt,
  type ChatOp,
} from "../studio/chat.ts";

export type DesignChatResult =
  | { ok: true; reply: string; ops: ChatOp[]; textLeft: number }
  | { ok: false; kind: "unavailable" | "limit" | "missed" | "bad" };

/**
 * One turn of the design chat. The shopper's words and a summary of the design go to
 * the model, and a checked list of edits comes back for the studio to apply. Counted
 * against the daily text cap; it never spends on pictures itself.
 */
export const designChat = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { message?: string; context?: unknown; history?: unknown } | undefined) => ({
    message: String(input?.message ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500),
    context: cleanContext(input?.context),
    history: cleanHistory(input?.history),
  }))
  .handler(async ({ data, context }): Promise<DesignChatResult> => {
    if (!data.message || !data.context) return { ok: false, kind: "bad" };
    const { admit, remaining } = await import("./guard.server.ts");
    const verdict = await admit("text", context.userId);
    if (verdict !== "ok") return { ok: false, kind: verdict };
    const { completeChat } = await import("./grok.server.ts");
    const raw = await completeChat([
      { role: "system", content: systemPrompt() },
      ...data.history.map((line) => ({ role: line.role, content: line.text })),
      { role: "user", content: turnPrompt(data.context, data.message) },
    ]);
    const answer = raw ? parseAnswer(raw) : null;
    if (!answer) return { ok: false, kind: "missed" };
    return { ok: true, ...answer, textLeft: await remaining("text", context.userId) };
  });

/** What this visitor has left today, for the chat to show before anything is spent. */
export const aiAllowance = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const live = Boolean(process.env.XAI_API_KEY?.trim());
    if (!live) return { live, text: 0, image: 0 };
    const { remaining } = await import("./guard.server.ts");
    const [text, image] = await Promise.all([remaining("text", context.userId), remaining("image", context.userId)]);
    return { live, text, image };
  });
