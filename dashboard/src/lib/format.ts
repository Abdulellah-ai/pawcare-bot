const dtf = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Amman" });
export const formatDate = (iso: string | null | undefined) => (iso ? dtf.format(new Date(iso)) : "—");

export const BOOKING_STATUS: Record<string, string> = { new: "جديد", confirmed: "مؤكد", cancelled: "ملغي", completed: "مكتمل" };
export const HANDOFF_STATUS: Record<string, string> = { open: "مفتوح", taken: "قيد المعالجة", resolved: "تم الحل" };
export const HANDOFF_REASON: Record<string, string> = {
  emergency: "طارئ", complaint: "شكوى", medical: "سؤال طبي", customer_request: "طلب العميل", low_confidence: "غير واثق", other: "أخرى",
};
export const CONV_STATUS: Record<string, string> = { bot: "البوت", handoff: "موظف", closed: "مغلقة" };
export const SPECIES: Record<string, string> = { cat: "قطة", dog: "كلب", bird: "طائر", rabbit: "أرنب", rodent: "قارض", other: "أخرى" };
export const SENDER: Record<string, string> = { customer: "العميل", bot: "البوت", staff: "الموظف", system: "النظام" };
export const CONFIG_STATUS: Record<string, string> = { draft: "مسودة (لم تُطبَّق بعد)", active: "المعمول به الآن", archived: "نسخة قديمة" };
export const CONFIG_KIND: Record<string, string> = { style: "الأسلوب", knowledge: "المعرفة" };
export const SEVERITY: Record<string, string> = { info: "معلومة", warning: "تحذير", error: "خطأ", critical: "حرج" };

export function petAge(months: number | null): string {
  if (months === null) return "—";
  if (months < 12) return `${months} شهر`;
  const y = Math.floor(months / 12), m = months % 12;
  return m ? `${y} سنة و${m} شهر` : `${y} سنة`;
}
