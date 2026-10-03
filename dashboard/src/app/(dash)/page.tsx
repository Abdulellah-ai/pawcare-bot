import Link from "next/link";
import { Badge, Card, Empty, PageHeader, handoffTone, reasonTone } from "@/components/ui";
import { listBookings, listHandoffs, getStats } from "@/lib/dal/read";
import { BOOKING_STATUS, HANDOFF_REASON, HANDOFF_STATUS, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/** A summary card that is also a link to its page; the arrow tells the user there is more behind it. */
function Kpi({ label, value, hint, tone, href }: { label: string; value: number; hint?: string; tone?: "danger" | "warn"; href: string }) {
  const color = tone === "danger" && value > 0 ? "text-danger" : tone === "warn" && value > 0 ? "text-warn" : "";
  return (
    <Link href={href} className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-5 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent">
      <div>
        <p className="text-sm text-muted">{label}</p>
        <p className={`mt-1 text-4xl font-bold tabular-nums ${color}`}>{value}</p>
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-lg text-accent transition-transform group-hover:-translate-x-1">←</span>
    </Link>
  );
}

export default async function OverviewPage() {
  const [stats, bookings, handoffs] = await Promise.all([getStats(), listBookings("new"), listHandoffs()]);
  const activeHandoffs = handoffs.filter((h) => h.status !== "resolved").slice(0, 5);

  return (
    <>
      <PageHeader title="نظرة عامة" subtitle="ملخص مباشر لنشاط البوت" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Kpi href="/conversations" label="المحادثات" value={stats.conversationsTotal} hint={`${stats.conversationsHandoff} عند موظف`} />
        <Kpi href="/bookings" label="حجوزات جديدة" value={stats.bookingsNew} hint={`من ${stats.bookingsTotal} إجمالًا`} tone="warn" />
        <Kpi href="/handoffs" label="تحويلات نشطة" value={stats.handoffsActive} hint={`${stats.emergenciesTotal} طارئة إجمالًا`} tone="danger" />
        <Kpi href="/monitoring" label="رسائل آخر 24 ساعة" value={stats.messages24h} hint={`${stats.errors24h} أخطاء`} tone={stats.errors24h > 0 ? "danger" : undefined} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">تحويلات تحتاج متابعة</h2>
            <Link href="/handoffs" className="text-sm text-accent hover:underline">عرض الكل</Link>
          </div>
          {activeHandoffs.length === 0 ? (
            <Empty>لا توجد تحويلات مفتوحة.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {activeHandoffs.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <Link href={`/conversations/${h.conversationId}`} className="font-medium hover:underline">{h.customerName}</Link>
                    <p className="truncate text-xs text-muted">{h.summary ?? "—"}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Badge tone={reasonTone(h.reason)}>{HANDOFF_REASON[h.reason] ?? h.reason}</Badge>
                    <Badge tone={handoffTone(h.status)}>{HANDOFF_STATUS[h.status] ?? h.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">أحدث الحجوزات الجديدة</h2>
            <Link href="/bookings" className="text-sm text-accent hover:underline">عرض الكل</Link>
          </div>
          {bookings.length === 0 ? (
            <Empty>لا توجد حجوزات جديدة بعد.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {bookings.slice(0, 5).map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="font-medium">{b.ownerName} <span className="text-muted">— {b.petName ?? "حيوان"}</span></p>
                    <p className="truncate text-xs text-muted">{b.reason} · {b.preferredTime ?? "وقت غير محدد"}</p>
                  </div>
                  <div className="shrink-0 text-end">
                    <Badge tone="info">{BOOKING_STATUS[b.status] ?? b.status}</Badge>
                    <p className="mt-1 text-xs text-muted">{formatDate(b.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
