"use client";

import { useRef, useState, useTransition } from "react";
import { chatStyle } from "@/actions/assistant";
import { Card } from "@/components/ui";

export type StyleMsg = { id: string; role: "admin" | "assistant" | "system"; content: string; mode: string | null; applied: boolean };

const TRY_EXAMPLES = ["مرحبا", "كم سعر الكشف؟", "بدي أحجز موعد لقطتي"];
const FEEDBACK_EXAMPLES = ["لا تقول أهلين، قول أهلا وسهلا", "خلّ كلامك أبسط وأقصر", "كن أدفأ شوي"];

function Bubble({ m }: { m: StyleMsg }) {
  if (m.role === "admin") return <div className="ms-auto max-w-[90%] whitespace-pre-wrap break-words rounded-2xl bg-accent-soft px-3 py-2 text-sm">{m.content}</div>;
  if (m.role === "system") return <div className="mx-auto max-w-[90%] rounded-2xl bg-warn-soft px-3 py-2 text-center text-sm text-warn">{m.content}</div>;
  const reply = m.mode === "reply";
  const updated = m.applied;
  return (
    <div className={`me-auto max-w-[90%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${reply ? "bg-info-soft" : updated ? "bg-ok-soft" : "bg-surface-2"}`}>
      {reply && <p className="mb-1 text-xs font-medium text-info">🐾 هيك رح يرد البوت:</p>}
      {updated && <p className="mb-1 text-xs font-medium text-ok">✅ تم تطبيق التعديل على البوت</p>}
      {m.content}
    </div>
  );
}

export function StyleChat({ initialMessages }: { initialMessages: StyleMsg[] }) {
  const [messages, setMessages] = useState<StyleMsg[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, startSend] = useTransition();
  const seq = useRef(0);
  const push = (m: Omit<StyleMsg, "id">) => setMessages((all) => [...all, { ...m, id: `local-${seq.current++}` }]);

  function send(value = text) {
    const msg = value.trim();
    if (msg.length < 2 || sending) return;
    setText("");
    push({ role: "admin", content: msg, mode: null, applied: false });
    startSend(async () => {
      const r = await chatStyle(msg);
      if (!r.ok) { push({ role: "system", content: r.message, mode: null, applied: false }); return; }
      push({ role: "assistant", content: r.data.message, mode: r.data.mode, applied: r.data.applied });
    });
  }

  return (
    <Card className="flex flex-col">
      <h2 className="font-bold">💬 تحدّث مع المساعد</h2>
      <p className="mb-3 text-sm leading-7 text-muted">
        اكتب رسالة كأنك عميل (مثل «مرحبا») وشوف كيف يرد البوت. إذا ما عجبك رده، قله ملاحظتك بكلامك العادي (مثل «لا تقول أهلين، قول أهلا وسهلا»)
        وهو بيعدّل أسلوبه ويطبّقه فورًا.
      </p>
      <div className="mb-3 flex max-h-96 min-h-48 flex-col gap-2 overflow-y-auto rounded-lg border border-border bg-bg p-3" aria-live="polite">
        {messages.length === 0 && <p className="m-auto text-center text-sm text-muted">ابدأ بكتابة «مرحبا» لتشوف كيف يرد البوت.</p>}
        {messages.map((m) => <Bubble key={m.id} m={m} />)}
        {sending && <div className="me-auto rounded-2xl bg-surface-2 px-3 py-2 text-sm text-muted">المساعد يكتب…</div>}
      </div>

      <div className="mb-3 flex flex-col gap-3 text-xs">
        <div>
          <p className="mb-1.5 font-medium text-muted">مثال: اكتب رسالة كأنك عميل</p>
          <div className="flex flex-wrap gap-2">
            {TRY_EXAMPLES.map((x) => (
              <button key={x} type="button" onClick={() => setText(x)} className="rounded-full border border-border px-2.5 py-1 hover:bg-surface-2">{x}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 font-medium text-muted">مثال: ملاحظة على أسلوب البوت</p>
          <div className="flex flex-wrap gap-2">
            {FEEDBACK_EXAMPLES.map((x) => (
              <button key={x} type="button" onClick={() => setText(x)} className="rounded-full border border-border px-2.5 py-1 hover:bg-surface-2">{x}</button>
            ))}
          </div>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex flex-col gap-2">
        <label htmlFor="style-message" className="sr-only">رسالتك للمساعد</label>
        <textarea
          id="style-message" value={text} onChange={(e) => setText(e.target.value)} maxLength={1500} rows={3}
          placeholder="اكتب رسالة للتجربة، أو ملاحظتك على أسلوب البوت…"
          className="w-full resize-y rounded-lg border border-border bg-surface p-2 text-sm"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">{text.length}/1500</span>
          <button type="submit" disabled={sending || text.trim().length < 2} className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg disabled:opacity-50">
            {sending ? "جارٍ الإرسال…" : "إرسال"}
          </button>
        </div>
      </form>
    </Card>
  );
}
