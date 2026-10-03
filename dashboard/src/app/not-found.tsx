import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-4xl">🔎</p>
      <h1 className="text-xl font-bold">الصفحة غير موجودة</h1>
      <Link href="/" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg">العودة للوحة</Link>
    </main>
  );
}
