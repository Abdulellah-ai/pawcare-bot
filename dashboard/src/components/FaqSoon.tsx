import { Badge, Card } from "@/components/ui";

const SAMPLE = [
  { q: "متى ساعات دوامكم؟", a: "نفتح من السبت إلى الخميس من 10 صباحًا حتى 8 مساءً، والجمعة من 2 ظهرًا حتى 8 مساءً." },
  { q: "وين موقع العيادة؟", a: "عمّان، عبدون، شارع الأمير شاكر، بناية 12." },
  { q: "كم سعر الكشف؟", a: "الكشف العادي 10 دنانير، والسعر النهائي بعد الفحص مع تقدير مكتوب قبل أي إجراء." },
];

/** Display-only preview of a planned feature. Nothing here is wired to data or actions. */
export function FaqSoon() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="font-bold">⚡ الأسئلة الشائعة</h2>
          <Badge tone="info">قريبًا</Badge>
        </div>
        <p className="text-sm leading-7 text-muted">
          هنا ستجهّز إجابات للأسئلة التي يسألها العملاء كثيرًا (الدوام، الموقع، الأسعار…). عندما يسأل العميل أحدها، يصله الجواب الجاهز <b>فورًا</b> وبنفس الصياغة دائمًا،
          وأي سؤال آخر يجيب عنه البوت كالمعتاد.
        </p>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <li className="rounded-lg bg-surface-2 p-3">⏱️ <b>أسرع</b><br /><span className="text-muted">الرد يصل فورًا</span></li>
          <li className="rounded-lg bg-surface-2 p-3">✅ <b>ثابت</b><br /><span className="text-muted">نفس الجواب في كل مرة</span></li>
          <li className="rounded-lg bg-surface-2 p-3">🧠 <b>ذكي</b><br /><span className="text-muted">يفهم الصيغ واللهجات المختلفة للسؤال</span></li>
        </ul>
      </Card>

      <Card className="opacity-70">
        <p className="mb-3 text-sm font-medium text-muted">مثال على الشكل (للعرض فقط)</p>
        <div className="flex flex-col gap-2" aria-hidden="true">
          {SAMPLE.map((s) => (
            <div key={s.q} className="rounded-lg border border-border p-3 text-sm">
              <p className="font-medium">{s.q}</p>
              <p className="mt-1 text-muted">{s.a}</p>
            </div>
          ))}
        </div>
        <button type="button" disabled className="mt-3 cursor-not-allowed rounded-lg border border-border px-4 py-1.5 text-sm text-muted">
          + إضافة سؤال (قريبًا)
        </button>
      </Card>
    </div>
  );
}
