"use client";

import { useEffect } from "react";

/** Error boundary: real query errors surface here instead of being swallowed. Only a safe generic message is shown. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("dashboard error", error.digest ?? error.name);
  }, [error]);
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-4xl">⚠️</p>
      <h1 className="text-xl font-bold">تعذّر تحميل الصفحة</h1>
      <p className="max-w-md text-sm text-muted">حدث خطأ أثناء جلب البيانات. جرّب مرة أخرى، وإن استمر فراجع صفحة المراقبة.</p>
      <button type="button" onClick={reset} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg">إعادة المحاولة</button>
    </main>
  );
}
