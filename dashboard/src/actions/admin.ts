"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { fail, mapDbError, ok, type DalResult } from "@/lib/dal/result";

const uuid = z.string().uuid();

/** Every write: requireAdmin() (layer 1) -> zod -> RPC whose first line is is_admin() (layer 2). No direct table writes exist. */

export async function setBookingStatus(id: string, status: "confirmed" | "cancelled" | "completed"): Promise<DalResult<null>> {
  const parsed = z.object({ id: uuid, status: z.enum(["confirmed", "cancelled", "completed"]) }).safeParse({ id, status });
  if (!parsed.success) return fail("invalid", "بيانات غير صالحة.");
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_set_booking_status", { p_id: parsed.data.id, p_status: parsed.data.status });
  if (error) { const m = mapDbError(error); return fail(m.kind, m.message); }
  revalidatePath("/bookings");
  revalidatePath("/");
  return ok(null);
}

export async function setHandoffStatus(id: string, status: "taken" | "resolved"): Promise<DalResult<null>> {
  const parsed = z.object({ id: uuid, status: z.enum(["taken", "resolved"]) }).safeParse({ id, status });
  if (!parsed.success) return fail("invalid", "بيانات غير صالحة.");
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_set_handoff_status", { p_id: parsed.data.id, p_status: parsed.data.status });
  if (error) { const m = mapDbError(error); return fail(m.kind, m.message); }
  revalidatePath("/handoffs");
  revalidatePath("/");
  return ok(null);
}

export async function setCustomerBanned(id: string, banned: boolean): Promise<DalResult<null>> {
  const parsed = z.object({ id: uuid, banned: z.boolean() }).safeParse({ id, banned });
  if (!parsed.success) return fail("invalid", "بيانات غير صالحة.");
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_set_customer_banned", { p_id: parsed.data.id, p_banned: parsed.data.banned });
  if (error) { const m = mapDbError(error); return fail(m.kind, m.message); }
  revalidatePath("/conversations");
  return ok(null);
}

const kindSchema = z.enum(["style", "knowledge"]);
const contentSchema = z.string().trim().min(20, "النص قصير جدًا.").max(30000, "النص طويل جدًا.");

export async function lintConfig(text: string): Promise<DalResult<string[]>> {
  const parsed = contentSchema.safeParse(text);
  if (!parsed.success) return fail("invalid", parsed.error.issues[0]?.message ?? "نص غير صالح.");
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_lint_config", { p_text: parsed.data });
  if (error) { const m = mapDbError(error); return fail(m.kind, m.message); }
  return ok((data as string[]) ?? []);
}

export async function createConfigDraft(kind: "style" | "knowledge", content: string, note: string): Promise<DalResult<{ version: number }>> {
  const parsed = z.object({ kind: kindSchema, content: contentSchema, note: z.string().trim().max(500) }).safeParse({ kind, content, note });
  if (!parsed.success) return fail("invalid", parsed.error.issues[0]?.message ?? "بيانات غير صالحة.");
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_create_config_draft", {
    p_kind: parsed.data.kind, p_content: parsed.data.content, p_note: parsed.data.note || null,
  });
  if (error) { const m = mapDbError(error); return fail(m.kind, m.message); }
  revalidatePath("/instructions");
  return ok({ version: Number((data as { version: number }).version) });
}

export async function publishConfig(id: string): Promise<DalResult<null>> {
  const parsed = uuid.safeParse(id);
  if (!parsed.success) return fail("invalid", "بيانات غير صالحة.");
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_publish_config", { p_id: parsed.data });
  if (error) { const m = mapDbError(error); return fail(m.kind, m.message); }
  revalidatePath("/instructions");
  return ok(null);
}

export async function discardConfigDraft(id: string): Promise<DalResult<null>> {
  const parsed = uuid.safeParse(id);
  if (!parsed.success) return fail("invalid", "بيانات غير صالحة.");
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_discard_config_draft", { p_id: parsed.data });
  if (error) { const m = mapDbError(error); return fail(m.kind, m.message); }
  revalidatePath("/instructions");
  return ok(null);
}
