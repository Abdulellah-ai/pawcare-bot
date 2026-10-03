import { z } from "zod";

/** What the style assistant (n8n) must return in the style chat. Anything else is rejected, never trusted as-is. */
export const styleChatReply = z.object({
  mode: z.enum(["reply", "update", "chat"]),
  message: z.string().min(1).max(1500),
  proposed_style: z.string().max(30000),
  out_of_scope: z.array(z.string().max(300)).max(10),
});
export type StyleChatReply = z.infer<typeof styleChatReply>;

/** The only case where the dashboard may change the live style: an 'update' whose text really differs and is not trivially short. */
export function styleUpdateOf(reply: StyleChatReply, current: string): string | null {
  if (reply.mode !== "update") return null;
  const next = reply.proposed_style.trim();
  if (next.length < 20 || next === current.trim()) return null;
  return next;
}
