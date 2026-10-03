"use client";

import { useRef, useState, useTransition } from "react";
import { askAssistant, type Proposal } from "@/actions/assistant";
import { createConfigDraft, lintConfig } from "@/actions/admin";
import { lintLabel } from "@/lib/dal/result";
import { diffLines } from "@/lib/diff";
import { Badge, Card } from "@/components/ui";

type Kind = "style" | "knowledge";
type Msg = { id: string; role: "admin" | "assistant" | "system"; content: string };

const ROLE_STYLE: Record<Msg["role"], string> = {
  admin: "bg-accent-soft ms-auto",
  assistant: "bg-surface-2 me-auto",
  system: "bg-warn-soft text-warn mx-auto text-center",
};

export function Workbench({ kind, activeContent, initialMessages }: { kind: Kind; activeContent: string; initialMessages: Msg[] }) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [editor, setEditor] = useState(activeContent);
  const [note, setNote] = useState("");
  const [lint, setLint] = useState<string[] | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const [sending, startSend] = useTransition();
  const [saving, startSave] = useTransition();
  const seq = useRef(0);
  const push = (role: Msg["role"], content: string) => setMessages((m) => [...m, { id: `local-${seq.current++}`, role, content }]);

  function send() {
    const text = instruction.trim();
    if (!text || sending) return;
    setInstruction("");
    setProposal(null);
    setStatus(null);
    push("admin", text);
    startSend(async () => {
      const r = await askAssistant(kind, text);
      if (!r.ok) { push("system", r.message); return; }
      push("assistant", r.data.summary);
      setProposal(r.data);
    });
  }

  function saveDraft(content: string, draftNote: string) {
    setStatus(null);
    startSave(async () => {
      const r = await createConfigDraft(kind, content, draftNote);
      setStatus(r.ok ? { tone: "ok", text: `تم حفظ التعديل كمسودة. اضغط «تطبيق» عليه في قائمة التعديلات أدناه ليبدأ البوت باستخدامه.` } : { tone: "danger", text: r.message });
    });
  }

  function checkEditor() {
    setStatus(null);
    startSave(async () => {
      const r = await lintConfig(editor);
      if (!r.ok) { setStatus({ tone: "danger", text: r.message }); setLint(null); return; }
      setLint(r.data);
      setStatus(r.data.length ? { tone: "danger", text: "في النص شيء غير مسموح، شوف السبب أدناه." } : { tone: "ok", text: "النص سليم، تقدر تحفظه." });
    });
  }

  const diff = proposal ? diffLines(proposal.currentContent, proposal.proposedContent) : [];
  const changed = diff.filter((d) => d.type !== "same").length;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="flex flex-col">
        <h2 className="font-bold">💬 تحدّث مع المساعد</h2>
        <p className="mb-3 text-sm text-muted">
          اكتب ما تريد تغييره بكلامك العادي، مثل: «لا تقل للأسف» أو «خليك أقصر وأدفأ». المساعد يقترح تعديلًا فقط، ولا يتغيّر شيء قبل أن تراجعه وتضغط «تطبيق».
        </p>
        <div className="mb-3 flex max-h-80 min-h-40 flex-col gap-2 overflow-y-auto rounded-lg border border-border bg-bg p-3" aria-live="polite">
          {messages.length === 0 && <p className="m-auto text-sm text-muted">لا توجد رسائل بعد.</p>}
          {messages.map((m) => (
            <div key={m.id} className={`max-w-[90%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${ROLE_STYLE[m.role]}`}>{m.content}</div>
          ))}
          {sending && <div className="me-auto rounded-2xl bg-surface-2 px-3 py-2 text-sm text-muted">المساعد يكتب…</div>}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex flex-col gap-2">
          <label htmlFor="instruction" className="sr-only">تعليمتك للمساعد</label>
          <textarea
            id="instruction" value={instruction} onChange={(e) => setInstruction(e.target.value)} maxLength={1500} rows={3}
            placeholder="مثال: لا تستخدم كلمة «للأسف»، وكن أقصر وأدفأ في الردود."
            className="w-full resize-y rounded-lg border border-border bg-surface p-2 text-sm"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">{instruction.length}/1500</span>
            <button type="submit" disabled={sending || instruction.trim().length < 3} className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg disabled:opacity-50">
              {sending ? "جارٍ الإرسال…" : "إرسال"}
            </button>
          </div>
        </form>
      </Card>

      <div className="flex flex-col gap-4">
        {proposal && (
          <Card>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-bold">اقتراح المساعد</h2>
              <Badge tone={proposal.lint.length ? "danger" : "ok"}>{proposal.lint.length ? "مرفوض" : `${changed} سطرًا تغيّر`}</Badge>
            </div>
            {proposal.outOfScope.length > 0 && (
              <div className="mb-3 rounded-lg bg-warn-soft p-3 text-sm text-warn">
                <p className="font-medium">طلبات خارج صلاحية المساعد (لم تُنفَّذ):</p>
                <ul className="list-disc ps-5">{proposal.outOfScope.map((o, i) => <li key={i}>{o}</li>)}</ul>
              </div>
            )}
            {proposal.lint.length > 0 && (
              <p role="alert" className="mb-3 rounded-lg bg-danger-soft p-3 text-sm text-danger">
                لا يمكن حفظ هذا الاقتراح: {[...new Set(proposal.lint.map(lintLabel))].join("، ")}.
              </p>
            )}
            <div className="max-h-72 overflow-auto rounded-lg border border-border bg-bg p-2 text-sm leading-7" dir="auto">
              {diff.map((d, i) => (
                <div key={i} className={`whitespace-pre-wrap px-1 ${d.type === "add" ? "diff-add" : d.type === "del" ? "diff-del" : "text-muted"}`}>
                  {d.type === "add" ? "أُضيف: " : d.type === "del" ? "حُذف: " : ""}{d.text || " "}
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={saving || proposal.lint.length > 0 || changed === 0}
                onClick={() => saveDraft(proposal.proposedContent, proposal.summary.slice(0, 480))}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg disabled:opacity-50">حفظ كمسودة</button>
              <button type="button" onClick={() => { setEditor(proposal.proposedContent); setLint(null); setStatus(null); }}
                className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2">تعديله بنفسي قبل الحفظ</button>
              <button type="button" onClick={() => setProposal(null)} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2">إلغاء</button>
            </div>
          </Card>
        )}

        <Card>
          <details open={editor !== activeContent}>
          <summary className="cursor-pointer font-bold">✏️ تعديل النص بنفسي (اختياري)</summary>
          <p className="mb-2 mt-2 text-sm text-muted">تقدر تعدّل النص مباشرة. نفحصه قبل الحفظ، ولا يتغيّر البوت إلا بعد أن تضغط «تطبيق».</p>
          <label htmlFor="editor" className="sr-only">نص التعليمات</label>
          <textarea
            id="editor" value={editor} onChange={(e) => { setEditor(e.target.value); setLint(null); }} rows={14} maxLength={30000}
            className="w-full resize-y rounded-lg border border-border bg-surface p-3 text-sm leading-7" dir="auto"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="ملاحظة على التغيير (اختياري)"
              className="min-w-40 flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm" aria-label="ملاحظة على التغيير"
            />
            <button type="button" onClick={checkEditor} disabled={saving} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-50">فحص</button>
            <button type="button" onClick={() => saveDraft(editor, note.trim())} disabled={saving || editor === activeContent}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg disabled:opacity-50">حفظ كمسودة</button>
          </div>
          {lint && lint.length > 0 && (
            <p role="alert" className="mt-2 text-sm text-danger">مرفوض: {[...new Set(lint.map(lintLabel))].join("، ")}.</p>
          )}
          {status && <p role="status" className={`mt-2 text-sm ${status.tone === "ok" ? "text-ok" : "text-danger"}`}>{status.text}</p>}
          </details>
        </Card>
      </div>
    </div>
  );
}
