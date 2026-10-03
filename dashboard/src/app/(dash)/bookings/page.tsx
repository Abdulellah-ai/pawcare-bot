import Link from "next/link";
import { setBookingStatus } from "@/actions/admin";
import { ActionButton } from "@/components/ActionButton";
import { Badge, Card, Empty, PageHeader, bookingTone } from "@/components/ui";
import { listBookings } from "@/lib/dal/read";
import { BOOKING_STATUS, SPECIES, formatDate, petAge } from "@/lib/format";

export const dynamic = "force-dynamic";

const FILTERS = [["", "الكل"], ["new", "جديد"], ["confirmed", "مؤكد"], ["completed", "مكتمل"], ["cancelled", "ملغي"]] as const;

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter = status && status in BOOKING_STATUS ? status : "";
  const bookings = await listBookings(filter || undefined);

  return (
    <>
      <PageHeader title="الحجوزات" subtitle="كل حجز جمعه البوت من العملاء" />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="تصفية الحجوزات">
        {FILTERS.map(([value, label]) => (
          <Link
            key={value}
            href={value ? `/bookings?status=${value}` : "/bookings"}
            className={`rounded-full border px-3 py-1 text-sm ${filter === value ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface hover:bg-surface-2"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {bookings.length === 0 ? (
        <Empty>لا توجد حجوزات {filter ? "بهذه الحالة" : "بعد"}. ستظهر هنا عندما يحجز العملاء عبر البوت.</Empty>
      ) : (
        <div className="grid gap-3">
          {bookings.map((b) => (
            <Card key={b.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-bold">{b.ownerName} <span className="font-normal text-muted" dir="ltr">· {b.phone}</span></p>
                  <p className="text-sm">
                    {b.petName ?? "حيوان بدون اسم"} · {SPECIES[b.petSpecies] ?? b.petSpecies} · {petAge(b.petAgeMonths)}
                  </p>
                  <p className="mt-1 text-sm text-muted">السبب: {b.reason}</p>
                  <p className="text-sm text-muted">الوقت المفضل: {b.preferredTime ?? "غير محدد"}</p>
                  <p className="mt-1 text-xs text-muted">{formatDate(b.createdAt)}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge tone={bookingTone(b.status)}>{BOOKING_STATUS[b.status] ?? b.status}</Badge>
                  <div className="flex flex-wrap justify-end gap-2">
                    {b.status === "new" && (
                      <ActionButton tone="primary" action={setBookingStatus.bind(null, b.id, "confirmed")}>تأكيد</ActionButton>
                    )}
                    {b.status === "confirmed" && (
                      <ActionButton tone="primary" action={setBookingStatus.bind(null, b.id, "completed")}>تم الإنجاز</ActionButton>
                    )}
                    {(b.status === "new" || b.status === "confirmed") && (
                      <ActionButton tone="danger" confirmText="إلغاء هذا الحجز؟" action={setBookingStatus.bind(null, b.id, "cancelled")}>إلغاء</ActionButton>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
