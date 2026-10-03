import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-3xl">🐾</p>
        <h1 className="mt-2 text-2xl font-bold">لوحة باو كير</h1>
        <p className="mb-5 text-sm text-muted">سجّل الدخول لإدارة البوت (عرض تجريبي).</p>
        {e === "forbidden" && <p role="alert" className="mb-4 rounded-lg bg-danger-soft p-2 text-sm text-danger">هذا الحساب غير مخوّل بدخول اللوحة.</p>}
        <LoginForm />
      </div>
    </main>
  );
}
