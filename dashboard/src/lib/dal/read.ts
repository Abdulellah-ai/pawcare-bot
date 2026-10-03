import "server-only";
import { requireAdmin } from "@/lib/auth";
import type { Report, Timing } from "@/lib/report";
import { DalQueryError, toNumber, toNumberOrNull } from "@/lib/dal/result";

/** All dashboard reads go through here: session-bound client (RLS), explicit numeric conversion, throw on real errors. */

const fail = (what: string): never => {
  throw new DalQueryError(`تعذّر تحميل ${what}.`); // raw DB text intentionally not exposed
};

export type Stats = {
  conversationsTotal: number; conversationsHandoff: number; bookingsTotal: number; bookingsNew: number;
  handoffsActive: number; emergenciesTotal: number; messages24h: number; errors24h: number;
};

export async function getStats(): Promise<Stats> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("v_dashboard_stats").select("*").single();
  if (error || !data) return fail("الإحصائيات");
  return {
    conversationsTotal: toNumber(data.conversations_total, "conversations_total"),
    conversationsHandoff: toNumber(data.conversations_handoff, "conversations_handoff"),
    bookingsTotal: toNumber(data.bookings_total, "bookings_total"),
    bookingsNew: toNumber(data.bookings_new, "bookings_new"),
    handoffsActive: toNumber(data.handoffs_active, "handoffs_active"),
    emergenciesTotal: toNumber(data.emergencies_total, "emergencies_total"),
    messages24h: toNumber(data.messages_24h, "messages_24h"),
    errors24h: toNumber(data.errors_24h, "errors_24h"),
  };
}

type CustomerRef = { first_name: string | null; username: string | null } | null;
/** PostgREST embeds a to-one relation as an object or a 1-element array depending on typing; normalize to one object. */
const one = <T,>(v: unknown): T | null => (Array.isArray(v) ? ((v[0] as T | undefined) ?? null) : ((v as T | null | undefined) ?? null));
type CustomerFull = { id: string; first_name: string | null; username: string | null; is_banned: boolean };

export type Booking = {
  id: string; ownerName: string; phone: string; petName: string | null; petSpecies: string; petAgeMonths: number | null;
  reason: string; preferredTime: string | null; status: string; createdAt: string; customer: CustomerRef;
};

export async function listBookings(status?: string): Promise<Booking[]> {
  const { supabase } = await requireAdmin();
  let q = supabase
    .from("bookings")
    .select("id,owner_name,phone,pet_name,pet_species,pet_age_months,reason,preferred_time,status,created_at,customer:customers(first_name,username)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return fail("الحجوزات");
  return (data ?? []).map((r) => ({
    id: r.id, ownerName: r.owner_name, phone: r.phone, petName: r.pet_name, petSpecies: r.pet_species,
    petAgeMonths: toNumberOrNull(r.pet_age_months, "pet_age_months"), reason: r.reason, preferredTime: r.preferred_time,
    status: r.status, createdAt: r.created_at, customer: one<NonNullable<CustomerRef>>(r.customer),
  }));
}

export type ConversationRow = {
  id: string; status: string; lastMessageAt: string; customerId: string; customerName: string; username: string | null; isBanned: boolean;
};

export async function listConversations(): Promise<ConversationRow[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("conversations")
    .select("id,status,last_message_at,customer:customers(id,first_name,username,is_banned)")
    .is("deleted_at", null)
    .order("last_message_at", { ascending: false })
    .limit(200);
  if (error) return fail("المحادثات");
  return (data ?? []).map((r) => {
    const c = one<CustomerFull>(r.customer);
    return {
      id: r.id, status: r.status, lastMessageAt: r.last_message_at, customerId: c?.id ?? "",
      customerName: c?.first_name ?? "بدون اسم", username: c?.username ?? null, isBanned: c?.is_banned ?? false,
    };
  });
}

export type MessageRow = { id: string; direction: string; sender: string; body: string | null; intent: string | null; urgency: string | null; createdAt: string };

export async function getConversation(id: string): Promise<{ conversation: ConversationRow; messages: MessageRow[] } | null> {
  const { supabase } = await requireAdmin();
  const { data: c, error } = await supabase
    .from("conversations")
    .select("id,status,last_message_at,customer:customers(id,first_name,username,is_banned)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return fail("المحادثة");
  if (!c) return null;
  const { data: msgs, error: mErr } = await supabase
    .from("messages")
    .select("id,direction,sender,body,intent,urgency,created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(500);
  if (mErr) return fail("الرسائل");
  const cu = one<CustomerFull>(c.customer);
  return {
    conversation: {
      id: c.id, status: c.status, lastMessageAt: c.last_message_at, customerId: cu?.id ?? "",
      customerName: cu?.first_name ?? "بدون اسم", username: cu?.username ?? null, isBanned: cu?.is_banned ?? false,
    },
    messages: (msgs ?? []).map((m) => ({
      id: m.id, direction: m.direction, sender: m.sender, body: m.body, intent: m.intent, urgency: m.urgency, createdAt: m.created_at,
    })),
  };
}

export type Handoff = {
  id: string; conversationId: string; reason: string; status: string; summary: string | null; createdAt: string; customerName: string;
};

export async function listHandoffs(): Promise<Handoff[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("handoffs")
    .select("id,conversation_id,reason,status,summary,created_at,customer:customers(first_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return fail("التحويلات");
  return (data ?? []).map((h) => ({
    id: h.id, conversationId: h.conversation_id, reason: h.reason, status: h.status, summary: h.summary, createdAt: h.created_at,
    customerName: one<{ first_name: string | null }>(h.customer)?.first_name ?? "بدون اسم",
  }));
}

export type ErrorRow = { id: number; source: string; severity: string; message: string; createdAt: string };
export async function listErrors(): Promise<ErrorRow[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("v_recent_errors").select("id,source,severity,message,created_at").limit(100);
  if (error) return fail("سجل الأخطاء");
  return (data ?? []).map((e) => ({ id: toNumber(e.id, "id"), source: e.source, severity: e.severity, message: e.message, createdAt: e.created_at }));
}

export type StuckRow = { updateId: number; status: string; receivedAt: string };
export async function listStuckUpdates(): Promise<StuckRow[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("v_stuck_updates").select("update_id,status,received_at").limit(50);
  if (error) return fail("الرسائل العالقة");
  return (data ?? []).map((u) => ({ updateId: toNumber(u.update_id, "update_id"), status: u.status, receivedAt: u.received_at }));
}

export type ConfigKind = "style" | "knowledge";
export type ConfigVersion = { id: string; kind: ConfigKind; version: number; status: string; note: string | null; createdAt: string; publishedAt: string | null; content: string };

export async function listConfigVersions(kind: ConfigKind): Promise<ConfigVersion[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("bot_config_versions")
    .select("id,kind,version,status,note,created_at,published_at,content")
    .eq("kind", kind)
    .order("version", { ascending: false })
    .limit(30);
  if (error) return fail("إصدارات التعليمات");
  return (data ?? []).map((v) => ({
    id: v.id, kind: v.kind as ConfigKind, version: toNumber(v.version, "version"), status: v.status, note: v.note,
    createdAt: v.created_at, publishedAt: v.published_at, content: v.content,
  }));
}

export type ChatRow = { id: string; role: string; content: string; createdAt: string; mode: string | null; applied: boolean };
/** Chat history of one assistant (style or knowledge); each logged row carries {kind} in its proposal column. */
export async function listAdminChat(kind: ConfigKind): Promise<ChatRow[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("admin_chat_messages")
    .select("id,role,content,created_at,proposal")
    .eq("proposal->>kind", kind)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return fail("محادثة المساعد");
  return (data ?? []).reverse().map((m) => {
    const p = (m.proposal && typeof m.proposal === "object" ? m.proposal : {}) as Record<string, unknown>;
    return { id: m.id, role: m.role, content: m.content, createdAt: m.created_at, mode: typeof p.mode === "string" ? p.mode : null, applied: p.applied === true };
  });
}

// ---------- Reports (admin_report RPC; numbers converted explicitly) ----------

const num = (o: Record<string, unknown>, k: string) => toNumber(o[k] ?? 0, k);
const numOrNull = (o: Record<string, unknown>, k: string) => toNumberOrNull(o[k], k);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const timing = (v: unknown): Timing => { const o = rec(v); return { n: num(o, "n"), median: numOrNull(o, "median_s"), p90: numOrNull(o, "p90_s") }; };

function parseReport(raw: unknown): Report {
  const r = rec(raw);
  const bot = rec(r.bot_response), sh = rec(r.shifts), bk = rec(r.bookings);
  return {
    messagesIn: num(r, "messages_in"), voiceIn: num(r, "voice_in"), conversationsActive: num(r, "conversations_active"), newCustomers: num(r, "new_customers"),
    botOnly: num(r, "bot_only"), handoffsTotal: num(r, "handoffs_total"),
    handoffsByReason: Object.fromEntries(Object.entries(rec(r.handoffs_by_reason)).map(([k, v]) => [k, toNumber(v, k)])),
    emergencies: num(r, "emergencies"), handoffsUnanswered: num(r, "handoffs_unanswered"),
    staff: timing(r.staff_response), bot: { ...timing(bot), max: numOrNull(bot, "max_s") },
    inHours: num(r, "in_hours"),
    shifts: { morning: num(sh, "morning"), afternoon: num(sh, "afternoon"), evening: num(sh, "evening"), night: num(sh, "night") },
    intents: (Array.isArray(r.intents) ? r.intents : []).map((x) => { const o = rec(x); return { intent: String(o.intent ?? "other"), n: num(o, "n") }; }),
    bookings: { created: num(bk, "created"), convsWithBooking: num(bk, "convs_with_booking"), denominator: num(bk, "booking_denominator") },
    daily: (Array.isArray(r.daily) ? r.daily : []).map((x) => { const o = rec(x); return { d: String(o.d ?? ""), n: num(o, "n") }; }),
    errors: num(r, "errors"), voiceFailures: num(r, "voice_failures"),
  };
}

/** The last `days` days (ending now) and the equally long period right before it, for an honest comparison. */
export async function getReport(days: number): Promise<{ current: Report; previous: Report; from: string; to: string }> {
  const { supabase } = await requireAdmin();
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const prevFrom = new Date(from.getTime() - days * 86_400_000);
  const call = async (a: Date, b: Date) => {
    const { data, error } = await supabase.rpc("admin_report", { p_from: a.toISOString(), p_to: b.toISOString() });
    if (error) return fail("التقرير");
    return parseReport(data);
  };
  const [current, previous] = await Promise.all([call(from, to), call(prevFrom, from)]);
  return { current, previous, from: from.toISOString(), to: to.toISOString() };
}
