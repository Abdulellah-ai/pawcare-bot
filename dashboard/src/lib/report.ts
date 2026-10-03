/** Report model + plain-Arabic summary. Pure functions (no I/O) so they can be unit-tested. Rules: the internal numbers charter. */
import { compareCounts, count, ruleOfThree, secondsText, trust, wilson, pct, type Trust } from "./stats.ts";

export type Timing = { n: number; median: number | null; p90: number | null };
export type Report = {
  messagesIn: number; voiceIn: number; conversationsActive: number; newCustomers: number; botOnly: number;
  handoffsTotal: number; handoffsByReason: Record<string, number>; emergencies: number; handoffsUnanswered: number;
  staff: Timing; bot: Timing & { max: number | null };
  inHours: number; shifts: { morning: number; afternoon: number; evening: number; night: number };
  intents: { intent: string; n: number }[];
  bookings: { created: number; convsWithBooking: number; denominator: number };
  daily: { d: string; n: number }[]; errors: number; voiceFailures: number;
};

export type Line = { tone: "ok" | "warn" | "info"; text: string };

export const INTENT_LABEL: Record<string, string> = {
  greeting: "ترحيب", info_hours: "ساعات الدوام", info_location: "الموقع", pricing: "الأسعار", services: "الخدمات", booking: "حجز موعد",
  emergency: "حالة طارئة", complaint: "شكوى", medical_question: "سؤال طبي", rescue_case: "حالة إنقاذ", boarding: "إيواء", grooming: "عناية وتجميل",
  human_request: "طلب التحدث لموظف", thanks: "شكر", out_of_scope: "خارج اختصاصنا", other: "أخرى",
};
export const SHIFT_LABEL = { morning: "الصباح (6–11)", afternoon: "الظهر (12–16)", evening: "المساء (17–21)", night: "الليل (22–5)" } as const;

/** Share as "X%" with a plain-language range, only when the sample is big enough to mean something. */
export function shareText(k: number, n: number): string {
  if (n === 0) return "لا بيانات";
  if (n < 10) return `${k} من ${n} (العدد قليل لحساب نسبة)`;
  const w = wilson(k, n);
  return `${k} من ${n} (≈ ${pct(w.p)}%، والأرجح بين ${pct(w.low)}% و${pct(w.high)}%)`;
}

export const TRUST_HINT: Record<Trust, string> = {
  none: "الأعداد قليلة جدًا؛ لا تبنِ عليها قرارًا.",
  early: "مؤشر مبدئي؛ يحتاج رسائل أكثر ليثبت.",
  ok: "عدد كافٍ لقراءة معقولة.",
};

/** The short "what happened" sentences shown at the top of the page. `prev` is the previous period of EQUAL length. */
export function summarize(cur: Report, prev: Report | null): Line[] {
  const L: Line[] = [];
  if (cur.messagesIn === 0) return [{ tone: "info", text: "لا توجد رسائل في هذه الفترة بعد." }];

  // 1) volume (+ honest comparison)
  let cmp = "";
  if (prev) {
    const c = compareCounts(cur.messagesIn, prev.messagesIn);
    cmp = c.verdict === "higher" ? " أكثر بوضوح من الفترة السابقة."
      : c.verdict === "lower" ? " أقل بوضوح من الفترة السابقة."
      : c.verdict === "same" ? " والفرق عن الفترة السابقة ضمن التذبذب العادي."
      : " والأعداد قليلة جدًا للمقارنة بالفترة السابقة.";
  }
  L.push({ tone: "info", text: `وصل ${count(cur.messagesIn, ["رسالة","رسالتان","رسائل","رسالة"])} في ${count(cur.conversationsActive, ["محادثة","محادثتان","محادثات","محادثة"])}، منها ${count(cur.newCustomers, ["عميل جديد","عميلان جديدان","عملاء جدد","عميل جديد"])}.${cmp}` });

  // 2) what the bot handled alone
  if (cur.conversationsActive > 0) L.push({ tone: "ok", text: `أجاب البوت وحده في ${shareText(cur.botOnly, cur.conversationsActive)}.` });

  // 3) emergencies
  if (cur.emergencies > 0) L.push({ tone: "warn", text: `سُجّلت ${count(cur.emergencies, ["حالة طارئة","حالتان طارئتان","حالات طارئة","حالة طارئة"])} وحُوّلت للموظفين.` });
  else if (cur.conversationsActive >= 30) L.push({ tone: "ok", text: `لم تُسجَّل حالات طارئة في ${count(cur.conversationsActive, ["محادثة","محادثتان","محادثات","محادثة"])} (النسبة الحقيقية على الأرجح أقل من ${Math.max(1, pct(ruleOfThree(cur.conversationsActive)))}%).` });
  else L.push({ tone: "ok", text: `لم تُسجَّل حالات طارئة (المحادثات ${cur.conversationsActive} فقط، فهذا لا يكفي لاستنتاج أنها نادرة).` });

  // 4) unanswered handoffs: the one thing that needs action
  if (cur.handoffsUnanswered > 0) L.push({ tone: "warn", text: `${count(cur.handoffsUnanswered, ["تحويل","تحويلان","تحويلات","تحويل"])} لم يردّ عليه أي موظف بعد. يحتاج متابعة الآن.` });
  else if (cur.handoffsTotal > 0) L.push({ tone: "ok", text: `كل التحويلات (${cur.handoffsTotal}) وجدت ردًّا من موظف أو أُغلقت.` });

  // 5) speed: median + p90 only, p90 needs >= 20 answers
  if (cur.bot.n > 0 && cur.bot.median != null) {
    const slow = cur.bot.n >= 20 && cur.bot.p90 != null ? `، و9 من كل 10 ردود خلال ${secondsText(cur.bot.p90)}` : "";
    L.push({ tone: "info", text: `سرعة البوت: نصف الردود وصلت خلال ${secondsText(cur.bot.median)}${slow}${cur.bot.n < 10 ? " (عدد الردود قليل)" : ""}.` });
  }
  if (cur.staff.n > 0 && cur.staff.median != null) {
    L.push({ tone: cur.staff.median > 900 ? "warn" : "info", text: `سرعة الموظفين: نصف التحويلات ردّوا عليها خلال ${secondsText(cur.staff.median)}${cur.staff.n < 10 ? " (عدد قليل)" : ""}.` });
  }

  // 6) after-hours coverage
  if (cur.messagesIn >= 30) {
    const off = cur.messagesIn - cur.inHours;
    L.push({ tone: "info", text: `${pct(off / cur.messagesIn)}% من الرسائل جاءت خارج ساعات الدوام، وهذه ما كان سيستقبلها أحد لولا البوت.` });
  }

  // 7) busiest part of the day: only with enough messages
  if (cur.messagesIn >= 50) {
    const [k] = Object.entries(cur.shifts).sort((a, b) => b[1] - a[1])[0];
    L.push({ tone: "info", text: `أكثر وقت نشاطًا: ${SHIFT_LABEL[k as keyof typeof SHIFT_LABEL]}.` });
  }

  // 8) bookings: denominator = conversations that actually wanted to book, same period
  if (cur.bookings.denominator > 0) L.push({ tone: "ok", text: `من المحادثات التي فيها نية حجز، انتهى بحجز: ${shareText(cur.bookings.convsWithBooking, cur.bookings.denominator)}.` });
  else if (cur.bookings.created > 0) L.push({ tone: "ok", text: `تم تسجيل ${cur.bookings.created} حجز.` });

  // 9) voice + failures
  if (cur.voiceIn > 0) L.push({ tone: "info", text: `${cur.voiceIn} من ${cur.messagesIn} كانت رسائل صوتية.` });
  if (cur.voiceFailures > 0) L.push({ tone: "warn", text: `تعذّرت معالجة ${count(cur.voiceFailures, ["رسالة صوتية","رسالتان صوتيتان","رسائل صوتية","رسالة صوتية"])}؛ تأكد من صفحة المراقبة.` });
  if (cur.errors > 0) L.push({ tone: "warn", text: `حدث ${count(cur.errors, ["خطأ تقني","خطآن تقنيان","أخطاء تقنية","خطأ تقني"])} في هذه الفترة (التفاصيل في المراقبة).` });
  return L;
}

export { trust };
