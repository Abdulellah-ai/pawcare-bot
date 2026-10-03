"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1>حدث خطأ غير متوقع</h1>
          <button onClick={reset} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #888", cursor: "pointer" }}>إعادة المحاولة</button>
        </div>
      </body>
    </html>
  );
}
