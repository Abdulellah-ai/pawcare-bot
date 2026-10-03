import { Badge, Card, Empty, PageHeader, severityTone } from "@/components/ui";
import { listErrors, listStuckUpdates } from "@/lib/dal/read";
import { SEVERITY, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Shows what the backend monitoring (n8n) already records. The dashboard runs no monitoring of its own. */
export default async function MonitoringPage() {
  const [errors, stuck] = await Promise.all([listErrors(), listStuckUpdates()]);
  return (
    <>
      <PageHeader title="المراقبة" subtitle="أخطاء آخر 24 ساعة ورسائل لم يكتمل الرد عليها" />
      <div className="grid gap-4">
        <Card>
          <h2 className="mb-1 font-bold">رسائل عالقة</h2>
          <p className="mb-3 text-sm text-muted">رسائل سُجّلت ولم يُرسل ردها خلال دقيقتين. وجودها يعني أن جزءًا من السلسلة متوقف.</p>
          {stuck.length === 0 ? (
            <Empty>لا توجد رسائل عالقة. ✅</Empty>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {stuck.map((s) => (
                <li key={s.updateId} className="flex justify-between py-2">
                  <span dir="ltr">update #{s.updateId}</span>
                  <span className="text-muted">{s.status} · {formatDate(s.receivedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-bold">سجل الأخطاء والتحذيرات</h2>
          {errors.length === 0 ? (
            <Empty>لا توجد أخطاء مسجلة خلال آخر 24 ساعة. ✅</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {errors.map((e) => (
                <li key={e.id} className="py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge tone={severityTone(e.severity)}>{SEVERITY[e.severity] ?? e.severity}</Badge>
                    <span className="font-mono text-xs text-muted" dir="ltr">{e.source}</span>
                    <span className="ms-auto text-xs text-muted">{formatDate(e.createdAt)}</span>
                  </div>
                  <p className="mt-1 break-words">{e.message}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
