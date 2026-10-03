"use server";

import { createHmac, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { fail, lintLabelList, mapDbError, ok, type DalResult } from "@/lib/dal/result";
import { styleChatReply, styleUpdateOf } from "@/lib/style-chat";

export type Proposal = { summary: string; proposedContent: string; outOfScope: string[]; lint: string[]; currentContent: string };
export type StyleChatResult = { mode: "reply" | "update" | "chat"; message: string; applied: boolean; version: number | null; outOfScope: string[] };

const input = z.object({
  kind: z.enum(["style", "knowledge"]),
  instruction: z.string().trim().min(3, "اكتب تعليمة أوضح.").max(1500, "التعليمة طويلة (الحد 1500 حرف)."),
});
const chatInput = z.string().trim().min(2, "اكتب رسالة أوضح.").max(1500, "الرسالة طويلة (الحد 1500 حرف).");

// What the assistant must return for knowledge proposals. Anything else is rejected (strict contract, never trusted as-is).
const assistantReply = z.object({
  summary: z.string().max(1000),
  proposed_content: z.string().min(20).max(30000),
  out_of_scope: z.array(z.string().max(300)).max(10),
});

const MAX_PER_MINUTE = 6;
const UNAVAILABLE = "المساعد غير متاح الآن. جرّب بعد قليل.";

type Supabase = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

/** Shared per-minute limit for both assistant flows. */
async function overRateLimit(supabase: Supabase): Promise<boolean | "error"> {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await supabase
    .from("admin_chat_messages").select("id", { count: "exact", head: true }).eq("role", "admin").gte("created_at", since);
  if (error) return "error";
  return (count ?? 0) >= MAX_PER_MINUTE;
}

/** The ONLY door from the dashboard to the assistant service (single gateway): signs "<timestamp>.<raw body>" with the shared secret. */
async function callAssistant(payload: Record<string, unknown>): Promise<unknown | null> {
  const url = process.env.ASSISTANT_WEBHOOK_URL;
  const secret = process.env.ASSISTANT_HMAC_SECRET;
  if (!url || !secret) return null;
  const body = JSON.stringify({ request_id: randomUUID(), ...payload });
  const ts = Date.now().toString();
  const signature = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-PawCare-Timestamp": ts, "X-PawCare-Signature": signature, "ngrok-skip-browser-warning": "1" },
      body,
      signal: AbortSignal.timeout(110_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const logChat = (supabase: Supabase, role: "admin" | "assistant" | "system", content: string, proposal: Record<string, unknown>) =>
  supabase.rpc("admin_log_chat", { p_role: role, p_content: content, p_proposal: proposal });

/**
 * Knowledge flow: the assistant only PROPOSES text. Nothing is applied here; applying is a separate, explicit admin click.
 */
export async function askAssistant(kind: "style" | "knowledge", instruction: string): Promise<DalResult<Proposal>> {
  const parsed = input.safeParse({ kind, instruction });
  if (!parsed.success) return fail("invalid", parsed.error.issues[0]?.message ?? "مدخلات غير صالحة.");
  const { supabase } = await requireAdmin();

  const limited = await overRateLimit(supabase);
  if (limited === "error") return fail("unknown", "حدث خطأ غير متوقع. حاول مرة أخرى.");
  if (limited) return fail("unavailable", "طلبات كثيرة خلال دقيقة. انتظر قليلًا ثم أعد المحاولة.");

  const { data: active, error: aErr } = await supabase
    .from("bot_config_versions").select("content,version").eq("kind", parsed.data.kind).eq("status", "active").maybeSingle();
  if (aErr || !active) return fail("not_found", "لم يُضبط هذا النوع بعد.");

  await logChat(supabase, "admin", parsed.data.instruction, { kind: parsed.data.kind });

  const raw = await callAssistant({
    kind: parsed.data.kind, instruction: parsed.data.instruction, current_content: active.content, current_version: active.version,
  });
  if (raw === null) {
    await logChat(supabase, "system", UNAVAILABLE, { kind: parsed.data.kind });
    return fail("unavailable", UNAVAILABLE);
  }

  const reply = assistantReply.safeParse(raw);
  if (!reply.success) {
    const msg = "رد المساعد لم يكن بالصيغة المتوقعة، ولم يُطبَّق أي شيء.";
    await logChat(supabase, "system", msg, { kind: parsed.data.kind });
    return fail("unknown", msg);
  }

  // Layer 2 check, in the database (same lint the publish RPC will re-run).
  const { data: lint, error: lErr } = await supabase.rpc("admin_lint_config", { p_text: reply.data.proposed_content });
  if (lErr) { const m = mapDbError(lErr); return fail(m.kind, m.message); }

  await logChat(supabase, "assistant", reply.data.summary, { out_of_scope: reply.data.out_of_scope, lint: lint ?? [], kind: parsed.data.kind });

  return ok({
    summary: reply.data.summary, proposedContent: reply.data.proposed_content,
    outOfScope: reply.data.out_of_scope, lint: (lint as string[]) ?? [], currentContent: active.content,
  });
}

/**
 * Style flow: the admin talks to the assistant. It either answers like the bot (preview), or updates the style from feedback.
 * An update is applied immediately (lint in the database first, then create + publish as a new numbered edit that can be rolled back).
 */
export async function chatStyle(message: string): Promise<DalResult<StyleChatResult>> {
  const parsed = chatInput.safeParse(message);
  if (!parsed.success) return fail("invalid", parsed.error.issues[0]?.message ?? "رسالة غير صالحة.");
  const { supabase } = await requireAdmin();

  const limited = await overRateLimit(supabase);
  if (limited === "error") return fail("unknown", "حدث خطأ غير متوقع. حاول مرة أخرى.");
  if (limited) return fail("unavailable", "طلبات كثيرة خلال دقيقة. انتظر قليلًا ثم أعد المحاولة.");

  const [styleRes, knowledgeRes, histRes] = await Promise.all([
    supabase.from("bot_config_versions").select("content").eq("kind", "style").eq("status", "active").maybeSingle(),
    supabase.from("bot_config_versions").select("content").eq("kind", "knowledge").eq("status", "active").maybeSingle(),
    supabase.from("admin_chat_messages").select("role,content").eq("proposal->>kind", "style").in("role", ["admin", "assistant"])
      .order("created_at", { ascending: false }).limit(8),
  ]);
  if (styleRes.error || !styleRes.data) return fail("not_found", "لم يُضبط الأسلوب بعد.");
  const style = styleRes.data.content;
  const history = (histRes.data ?? []).reverse().map((m) => ({ role: m.role, content: String(m.content).slice(0, 600) }));

  await logChat(supabase, "admin", parsed.data, { kind: "style" });

  const raw = await callAssistant({
    kind: "style", flow: "style_chat", instruction: parsed.data, current_content: style,
    knowledge: knowledgeRes.data?.content ?? "", history,
  });
  if (raw === null) {
    await logChat(supabase, "system", UNAVAILABLE, { kind: "style" });
    return fail("unavailable", UNAVAILABLE);
  }
  const reply = styleChatReply.safeParse(raw);
  if (!reply.success) {
    const msg = "رد المساعد لم يكن بالصيغة المتوقعة، ولم يتغيّر شيء.";
    await logChat(supabase, "system", msg, { kind: "style" });
    return fail("unknown", msg);
  }

  let applied = false;
  let version: number | null = null;
  let shown = reply.data.message;
  const next = styleUpdateOf(reply.data, style);
  if (next) {
    // Layer 2 check in the database before anything is created.
    const { data: lint, error: lErr } = await supabase.rpc("admin_lint_config", { p_text: next });
    if (lErr) { const m = mapDbError(lErr); return fail(m.kind, m.message); }
    const problems = (lint as string[]) ?? [];
    if (problems.length > 0) {
      shown = `ما قدرت أطبّق هذا التعديل لأن فيه شيئًا غير مسموح: ${lintLabelList(problems)}. لم يتغيّر شيء.`;
    } else {
      const { data: draft, error: dErr } = await supabase.rpc("admin_create_config_draft", {
        p_kind: "style", p_content: next, p_note: reply.data.message.slice(0, 480),
      });
      if (dErr) { const m = mapDbError(dErr); return fail(m.kind, m.message); }
      const draftRow = draft as { id: string; version: number };
      const { error: pErr } = await supabase.rpc("admin_publish_config", { p_id: draftRow.id });
      if (pErr) { const m = mapDbError(pErr); return fail(m.kind, m.message); }
      applied = true;
      version = Number(draftRow.version);
      revalidatePath("/instructions");
    }
  }

  const result: StyleChatResult = { mode: reply.data.mode, message: shown, applied, version, outOfScope: reply.data.out_of_scope };
  await logChat(supabase, "assistant", shown, { kind: "style", mode: result.mode, applied, version, out_of_scope: result.outOfScope });
  return ok(result);
}
