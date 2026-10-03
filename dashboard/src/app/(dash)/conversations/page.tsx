import Link from "next/link";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { listConversations } from "@/lib/dal/read";
import { CONV_STATUS, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  const conversations = await listConversations();
  return (
    <>
      <PageHeader title="المحادثات" subtitle="كل عميل تحدث مع البوت" />
      {conversations.length === 0 ? (
        <Empty>لا توجد محادثات بعد. ابدأ بمراسلة البوت على تلجرام لتظهر هنا.</Empty>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link href={`/conversations/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
                  <div className="min-w-0">
                    <p className="font-medium">{c.customerName}{c.username && <span className="text-muted" dir="ltr"> @{c.username}</span>}</p>
                    <p className="text-xs text-muted">آخر نشاط: {formatDate(c.lastMessageAt)}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {c.isBanned && <Badge tone="danger">محظور</Badge>}
                    <Badge tone={c.status === "handoff" ? "warn" : c.status === "closed" ? "neutral" : "accent"}>{CONV_STATUS[c.status] ?? c.status}</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
