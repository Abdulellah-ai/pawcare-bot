import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { setCustomerBanned } from "@/actions/admin";
import { ActionButton } from "@/components/ActionButton";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { getConversation } from "@/lib/dal/read";
import { CONV_STATUS, SENDER, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const data = await getConversation(id);
  if (!data) notFound();
  const { conversation: c, messages } = data;

  return (
    <>
      <PageHeader
        title={c.customerName}
        subtitle={`${c.username ? "@" + c.username + " · " : ""}${CONV_STATUS[c.status] ?? c.status}`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/conversations" className="text-sm text-accent hover:underline">← كل المحادثات</Link>
            {c.isBanned ? (
              <ActionButton action={setCustomerBanned.bind(null, c.customerId, false)}>رفع الحظر</ActionButton>
            ) : (
              <ActionButton tone="danger" confirmText="حظر هذا العميل من استخدام البوت؟" action={setCustomerBanned.bind(null, c.customerId, true)}>حظر العميل</ActionButton>
            )}
          </div>
        }
      />
      {messages.length === 0 ? (
        <Empty>لا توجد رسائل في هذه المحادثة.</Empty>
      ) : (
        <Card>
          <ol className="flex flex-col gap-3">
            {messages.map((m) => {
              const mine = m.direction === "out";
              return (
                <li key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.sender === "staff" ? "bg-warn-soft" : mine ? "bg-accent-soft" : "bg-surface-2"}`}>
                    <p className="mb-0.5 text-xs text-muted">
                      {SENDER[m.sender] ?? m.sender} · {formatDate(m.createdAt)}
                      {m.urgency === "emergency" && <> · <Badge tone="danger">طارئ</Badge></>}
                    </p>
                    <p className="whitespace-pre-wrap break-words">{m.body ?? "—"}</p>
                    {m.intent && <p className="mt-1 text-xs text-muted">النية: {m.intent}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </>
  );
}
