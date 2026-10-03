/** Uniform result contract for every dashboard write (empty arrays are NOT errors; real query errors throw). */
export type DalErrorKind = "forbidden" | "not_found" | "invalid" | "lint" | "unavailable" | "unknown";
export type DalResult<T> = { ok: true; data: T } | { ok: false; kind: DalErrorKind; message: string };

export class DalQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DalQueryError";
  }
}

export const ok = <T>(data: T): DalResult<T> => ({ ok: true, data });
export const fail = (kind: DalErrorKind, message: string): DalResult<never> => ({ ok: false, kind, message });

/** PostgREST returns numeric/bigint columns as strings in some cases; the generated types lie. Convert explicitly, throw on NaN. */
export function toNumber(value: unknown, field: string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(n)) {
    throw new DalQueryError(`قيمة رقمية غير صالحة في الحقل ${field}`);
  }
  return n;
}
export function toNumberOrNull(value: unknown, field: string): number | null {
  return value === null || value === undefined ? null : toNumber(value, field);
}

const LINT_LABELS: Record<string, string> = {
  contains_url: "يحتوي على رابط",
  contains_email: "يحتوي على بريد إلكتروني",
  override_attempt_en: "محاولة تجاوز التعليمات",
  override_attempt_ar: "محاولة تجاوز التعليمات",
  role_hijack: "محاولة تغيير دور البوت",
  prompt_exfiltration: "طلب كشف التعليمات الداخلية",
  secret_reference: "إشارة إلى أسرار أو كلمات مرور",
  infra_command: "أمر يخص الخوادم أو البيانات",
};
export const lintLabel = (code: string) => LINT_LABELS[code] ?? "محتوى غير مسموح";
export const lintLabelList = (codes: string[]) => [...new Set(codes.map(lintLabel))].join("، ");

/** Map a Postgres/PostgREST error to a safe Arabic message. Raw database text is NEVER shown to the user. */
export function mapDbError(err: { code?: string; message?: string } | null | undefined): { kind: DalErrorKind; message: string } {
  const code = err?.code;
  const msg = err?.message ?? "";
  if (code === "42501") return { kind: "forbidden", message: "ليس لديك صلاحية لتنفيذ هذا الإجراء." };
  if (code === "P0002") return { kind: "not_found", message: "العنصر غير موجود." };
  if (code === "22023" && msg.startsWith("lint_failed")) {
    const codes = msg.replace("lint_failed:", "").split(",").map((s) => s.trim()).filter((c) => c in LINT_LABELS);
    const labels = [...new Set(codes.map(lintLabel))];
    return { kind: "lint", message: `النص مرفوض: ${labels.join("، ") || "محتوى غير مسموح"}.` };
  }
  if (code === "22023") return { kind: "invalid", message: "هذا الانتقال غير مسموح في الحالة الحالية." };
  return { kind: "unknown", message: "حدث خطأ غير متوقع. حاول مرة أخرى." };
}
