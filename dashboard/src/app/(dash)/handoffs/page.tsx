import Link from "next/link";
import { setHandoffStatus } from "@/actions/admin";
import { ActionButton } from "@/components/ActionButton";
import { Badge, Card, Empty, PageHeader, handoffTone, reasonTone } from "@/components/ui";
import { listHandoffs } from "@/lib/dal/read";
import { HANDOFF_REASON, HANDOFF_STATUS, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HandoffsPage() {
  const handoffs = await listHandoffs();
  return (
    <>
      <PageHeader title="التحويلات والطوارئ" subtitle="حالات حوّلها البوت لفريق العيادة" />
      {handoffs.length === 0 ? (
        <Empty>لا توجد تحويلات بعد. تظهر هنا الطوارئ والشكاوى والأسئلة الطبية التي يحوّلها البوت لموظف.</Empty>
      ) : (
        <div className="grid gap-3">
          {handoffs.map((h) => (
            <Card key={h.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/conversations/${h.conversationId}`} className="text-lg font-bold hover:underline">{h.customerName}</Link>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{h.summary ?? "بدون ملخص"}</p>
                  <p className="mt-1 text-xs text-muted">{formatDate(h.createdAt)}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex gap-1">
                    <Badge tone={reasonTone(h.reason)}>{HANDOFF_REASON[h.reason] ?? h.reason}</Badge>
                    <Badge tone={handoffTone(h.status)}>{HANDOFF_STATUS[h.status] ?? h.status}</Badge>
                  </div>
                  <div className="flex gap-2">
                    {h.status === "open" && <ActionButton action={setHandoffStatus.bind(null, h.id, "taken")}>استلمتها</ActionButton>}
                    {h.status !== "resolved" && (
                      <ActionButton tone="primary" confirmText="تأكيد: تم حل هذه الحالة؟" action={setHandoffStatus.bind(null, h.id, "resolved")}>تم الحل</ActionButton>
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
