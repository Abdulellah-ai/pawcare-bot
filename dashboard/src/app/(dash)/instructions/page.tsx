import Link from "next/link";
import { discardConfigDraft, publishConfig } from "@/actions/admin";
import { ActionButton } from "@/components/ActionButton";
import { FaqSoon } from "@/components/FaqSoon";
import { StyleChat } from "@/components/StyleChat";
import { Workbench } from "@/components/Workbench";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { listAdminChat, listConfigVersions, type ConfigKind } from "@/lib/dal/read";
import { CONFIG_KIND, CONFIG_STATUS, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const TONE: Record<string, "ok" | "warn" | "neutral"> = { active: "ok", draft: "warn", archived: "neutral" };

export default async function InstructionsPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind: rawKind } = await searchParams;
  const kind: ConfigKind = rawKind === "knowledge" ? "knowledge" : "style";
  const [versions, chat] = await Promise.all([listConfigVersions(kind), listAdminChat(kind)]);
  const active = versions.find((v) => v.status === "active");
  const tab = rawKind === "faq" ? "faq" : kind;

  const header = (
    <>
      <PageHeader
        title="تعليمات البوت"
        subtitle="عدّل طريقة كلام البوت وما يعرفه عن العيادة. التغيير يبدأ مع الرسائل التالية بعد أن تضغط «تطبيق»."
      />
      <div className="mb-4 flex gap-2" role="tablist" aria-label="نوع التعليمات">
        {(["style", "knowledge", "faq"] as const).map((k) => (
          <Link
            key={k} href={`/instructions?kind=${k}`} role="tab" aria-selected={tab === k}
            className={`rounded-full border px-4 py-1.5 text-sm ${tab === k ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface hover:bg-surface-2"}`}
          >
            {k === "faq" ? "الأسئلة الشائعة" : CONFIG_KIND[k]}{k === "faq" && <span className="ms-1.5 text-xs opacity-80">قريبًا</span>}
          </Link>
        ))}
      </div>
    </>
  );

  if (tab === "faq") {
    return (
      <>
        {header}
        <FaqSoon />
      </>
    );
  }

  return (
    <>
      {header}

      <p className="mb-4 rounded-xl border border-border bg-surface p-3 text-sm text-muted">
        🔒 قواعد السلامة (الطوارئ، منع التشخيص والوصفات، منع اختلاق الأسعار، التحويل لإنسان) <b>ثابتة ولا تُعدَّل من هنا</b>، وتتقدم دائمًا على أي أسلوب أو معرفة تكتبها.
      </p>

      {kind === "style" ? (
        <p role="note" className="mb-4 rounded-xl border border-warn bg-warn-soft p-3 text-sm leading-7 text-warn">
          ⚠️ <b>تنبيه:</b> أي تعديل تطلبه من المساعد هنا <b>يُطبَّق على البوت فورًا</b> ويغيّر طريقة رده مع كل العملاء. جرّب أولًا بكتابة رسالة وشوف الرد.
          وإن ما عجبك الأسلوب، تقدر ترجع لنسخة سابقة من «التعديلات السابقة» أسفل الصفحة.
        </p>
      ) : (
        <p role="note" className="mb-4 rounded-xl border border-warn bg-warn-soft p-3 text-sm leading-7 text-warn">
          ⚠️ <b>تنبيه مهم:</b> «المعرفة» هي كل ما يعرفه البوت عن العيادة (الأسعار، الدوام، السياسات). أي تغيير هنا <b>يؤثر بشكل كامل على أجوبة البوت</b> للعملاء،
          وأي معلومة خاطئة سيكررها البوت لكل من يسأل. راجع التعديل جيدًا قبل الضغط على «تطبيق»، وتقدر ترجع لنسخة سابقة من «التعديلات السابقة» أسفل الصفحة.
        </p>
      )}

      {!active ? (
        <Empty>لم يُضبط «{CONFIG_KIND[kind]}» بعد. البوت سيستخدم قواعد السلامة فقط.</Empty>
      ) : kind === "style" ? (
        <StyleChat
          key="style"
          initialMessages={chat.map((m) => ({ id: m.id, role: m.role as "admin" | "assistant" | "system", content: m.content, mode: m.mode, applied: m.applied }))}
        />
      ) : (
        <Workbench
          key="knowledge"
          kind={kind}
          activeContent={active.content}
          initialMessages={chat.map((m) => ({ id: m.id, role: m.role as "admin" | "assistant" | "system", content: m.content }))}
        />
      )}

      <Card className="mt-6">
        <h2 className="mb-1 font-bold">التعديلات السابقة — {CONFIG_KIND[kind]}</h2>
        <p className="mb-3 text-sm text-muted">كل تعديل تحفظه يبقى هنا، وتقدر ترجع لأي نسخة سابقة بضغطة.</p>
        <ul className="divide-y divide-border">
          {versions.map((v) => (
            <li key={v.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold">تعديل رقم {v.version}</span>
                  <Badge tone={TONE[v.status] ?? "neutral"}>{CONFIG_STATUS[v.status] ?? v.status}</Badge>
                  <span className="text-xs text-muted">{formatDate(v.publishedAt ?? v.createdAt)}</span>
                </div>
                <div className="flex gap-2">
                  {v.status === "draft" && (
                    <>
                      <ActionButton tone="primary" confirmText={`تطبيق التعديل رقم ${v.version}؟ سيتغير كلام البوت مع الرسائل التالية.`} action={publishConfig.bind(null, v.id)}>تطبيق</ActionButton>
                      <ActionButton tone="danger" confirmText="حذف هذه المسودة؟" action={discardConfigDraft.bind(null, v.id)}>حذف</ActionButton>
                    </>
                  )}
                  {v.status === "archived" && (
                    <ActionButton confirmText={`العودة للتعديل رقم ${v.version}؟ سيعمل البوت بهذه النسخة.`} action={publishConfig.bind(null, v.id)}>العودة لهذه النسخة</ActionButton>
                  )}
                </div>
              </div>
              {v.note && <p className="mt-1 text-sm text-muted">{v.note}</p>}
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-accent">عرض النص الكامل</summary>
                <div className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-bg p-3 text-sm leading-7" dir="auto">{v.content}</div>
              </details>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
