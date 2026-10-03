import Link from "next/link";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { getReport } from "@/lib/dal/read";
import { INTENT_LABEL, SHIFT_LABEL, summarize, TRUST_HINT } from "@/lib/report";
import { secondsText, trust } from "@/lib/stats";
import { HANDOFF_REASON } from "@/lib/format";

export const dynamic = "force-dynamic";

const RANGES = [{ days: 7, label: "آخر 7 أيام" }, { days: 30, label: "آخر 30 يومًا" }, { days: 90, label: "آخر 90 يومًا" }];
const DOT = { ok: "bg-ok", warn: "bg-warn", info: "bg-info" } as const;
const trustTone = { none: "danger", early: "warn", ok: "ok" } as const;
const TRUST_BADGE = { none: "عدد قليل جدًا، لا تعتمد عليه", early: "عدد قليل، قراءة أولية", ok: "عدد كافٍ" } as const;

function Kpi({ label, value, n, hint }: { label: string; value: string | number; n: number; hint?: string }) {
  const t = trust(n);
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone={trustTone[t]}>{TRUST_BADGE[t]}</Badge>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
    </Card>
  );
}

function Bars({ rows }: { rows: { label: string; n: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-2 text-sm">
          <span className="truncate">{r.label}</span>
          <span className="h-3 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full bg-accent" style={{ width: `${(r.n / max) * 100}%` }} /></span>
          <span className="tabular-nums text-muted">{r.n}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams;
  const days = RANGES.some((r) => String(r.days) === sp.days) ? Number(sp.days) : 7;
  const { current: c, previous: p } = await getReport(days);
  const lines = summarize(c, p);
  const empty = c.messagesIn === 0;

  return (
    <>
      <PageHeader title="التقارير" subtitle="ملخص بسيط لما حدث، مع تنبيه صريح حين تكون الأرقام قليلة" />
      <nav aria-label="الفترة" className="mb-4 flex gap-2">
        {RANGES.map((r) => (
          <Link key={r.days} href={`/reports?days=${r.days}`} aria-current={r.days === days ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm ${r.days === days ? "bg-accent text-accent-fg font-medium" : "bg-surface-2 hover:bg-border"}`}>{r.label}</Link>
        ))}
      </nav>

      <Card className="mb-4">
        <h2 className="mb-3 font-bold">الخلاصة</h2>
        <ul className="space-y-2">
          {lines.map((l, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <span aria-hidden className={`mt-2 h-2 w-2 shrink-0 rounded-full ${DOT[l.tone]}`} />
              <span>{l.text}</span>
            </li>
          ))}
        </ul>
      </Card>

      {empty ? (
        <Empty>لا توجد بيانات كافية في هذه الفترة لعرض التفاصيل.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="رسائل وصلت" value={c.messagesIn} n={c.messagesIn} />
            <Kpi label="محادثات" value={c.conversationsActive} n={c.conversationsActive} hint={`${c.newCustomers} عميل جديد`} />
            <Kpi label="تحويلات للموظفين" value={c.handoffsTotal} n={c.conversationsActive} hint={`${c.emergencies} طارئة`} />
            <Kpi label="حجوزات" value={c.bookings.created} n={c.bookings.denominator} hint={`من ${c.bookings.denominator} طلب حجز`} />
          </div>
          <p className="mt-2 text-xs text-muted">{TRUST_HINT[trust(c.messagesIn)]}</p>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 font-bold">ماذا يسأل العملاء؟</h2>
              {c.intents.length === 0 ? <Empty>لا بيانات.</Empty> : <Bars rows={c.intents.map((i) => ({ label: INTENT_LABEL[i.intent] ?? i.intent, n: i.n }))} />}
            </Card>
            <Card>
              <h2 className="mb-3 font-bold">متى يكتبون؟</h2>
              <Bars rows={(Object.keys(SHIFT_LABEL) as (keyof typeof SHIFT_LABEL)[]).map((k) => ({ label: SHIFT_LABEL[k], n: c.shifts[k] }))} />
              <p className="mt-3 text-xs text-muted">{c.messagesIn >= 50 ? "" : "أقل من 50 رسالة: لا نحدد «وقت الذروة» لأن الصدفة تؤثر كثيرًا."}</p>
            </Card>
            <Card>
              <h2 className="mb-3 font-bold">السرعة</h2>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-muted">البوت (المنتصف)</dt><dd className="text-xl font-bold">{c.bot.median != null ? secondsText(c.bot.median) : "—"}</dd></div>
                <div><dt className="text-muted">أبطأ رد مرصود</dt><dd className="text-xl font-bold">{c.bot.max != null ? secondsText(c.bot.max) : "—"}</dd></div>
                <div><dt className="text-muted">الموظفون (المنتصف)</dt><dd className="text-xl font-bold">{c.staff.median != null ? secondsText(c.staff.median) : "—"}</dd></div>
                <div><dt className="text-muted">ردود الموظفين المحسوبة</dt><dd className="text-xl font-bold tabular-nums">{c.staff.n}</dd></div>
              </dl>
            </Card>
            <Card>
              <h2 className="mb-3 font-bold">لماذا حُوّلت المحادثات؟</h2>
              {Object.keys(c.handoffsByReason).length === 0 ? <Empty>لا تحويلات في هذه الفترة.</Empty> : (
                <Bars rows={Object.entries(c.handoffsByReason).map(([k, n]) => ({ label: HANDOFF_REASON[k] ?? k, n }))} />
              )}
            </Card>
          </div>

          <Card className="mt-4">
            <h2 className="mb-3 font-bold">الرسائل يوميًا</h2>
            <Bars rows={c.daily.map((d) => ({ label: new Date(`${d.d}T12:00:00Z`).toLocaleDateString("ar-JO", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }), n: d.n }))} />
          </Card>
        </>
      )}

      <Card className="mt-6">
        <h2 className="mb-3 font-bold">كيف أقرأ هذه الأرقام؟</h2>
        <dl className="space-y-4 text-sm leading-7">
          <div>
            <dt className="font-medium">ليش أحيانًا مكتوب «عدد قليل»؟</dt>
            <dd className="text-muted">
              لأن الرقم الصغير ممكن يكون صدفة. مثال: إذا 3 عملاء من أصل 4 سألوا عن الأسعار، هذا لا يعني أن 75% من العملاء كلهم يسألون عنها.
              كلما زادت الرسائل صار الرقم أصدق: <b>أقل من 10</b> لا تعتمد عليه، <b>من 10 إلى 29</b> قراءة أولية، <b>30 فأكثر</b> مقبول.
            </dd>
          </div>
          <div>
            <dt className="font-medium">«ضمن التذبذب العادي»</dt>
            <dd className="text-muted">نقارن مع نفس عدد الأيام قبلها. إذا الفرق صغير نكتب هذه العبارة، يعني ما تغيّر شيء حقيقي، مجرد اختلاف عادي من فترة لفترة.</dd>
          </div>
          <div>
            <dt className="font-medium">«نصف الردود وصلت خلال…»</dt>
            <dd className="text-muted">يعني نصف الردود أسرع من هذا الوقت والنصف الثاني أبطأ. نستخدمه بدل المتوسط لأن رد بطيء واحد يخرّب المتوسط. و«أبطأ رد» هو أطول انتظار حصل فعلًا.</dd>
          </div>
          <div>
            <dt className="font-medium">«أجاب البوت وحده»</dt>
            <dd className="text-muted">محادثات انتهت بدون ما يتدخل موظف.</dd>
          </div>
          <div>
            <dt className="font-medium">الأوقات</dt>
            <dd className="text-muted">بتوقيت عمّان. الدوام: السبت إلى الخميس من 10 صباحًا إلى 8 مساءً، والجمعة من 2 ظهرًا إلى 8 مساءً.</dd>
          </div>
        </dl>
      </Card>
    </>
  );
}
