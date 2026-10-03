import { logout } from "@/actions/auth";
import { Nav } from "@/components/Nav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { requireAdmin } from "@/lib/auth";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();
  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 p-4 md:flex-row">
      <aside className="md:sticky md:top-4 md:h-[calc(100vh-2rem)] md:w-60 md:shrink-0">
        <div className="flex h-full flex-col gap-4 rounded-xl border border-border bg-surface p-3">
          <div className="px-2 pt-1">
            <p className="text-lg font-bold">🐾 باو كير</p>
            <p className="text-xs text-muted">لوحة الإدارة (عرض تجريبي)</p>
          </div>
          <Nav />
          <div className="mt-auto flex flex-col gap-2 border-t border-border pt-3">
            <ThemeToggle />
            <p className="truncate px-1 text-xs text-muted" dir="ltr">{user.email}</p>
            <form action={logout}>
              <button type="submit" className="w-full rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2">تسجيل الخروج</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
