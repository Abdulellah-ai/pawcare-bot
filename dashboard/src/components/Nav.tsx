"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "نظرة عامة", icon: "📊" },
  { href: "/bookings", label: "الحجوزات", icon: "📅" },
  { href: "/conversations", label: "المحادثات", icon: "💬" },
  { href: "/handoffs", label: "التحويلات والطوارئ", icon: "🚨" },
  { href: "/reports", label: "التقارير", icon: "📈" },
  { href: "/instructions", label: "تعليمات البوت", icon: "🧠" },
  { href: "/monitoring", label: "المراقبة", icon: "🩺" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav aria-label="التنقل الرئيسي" className="flex flex-row flex-wrap gap-1 md:flex-col md:flex-nowrap">
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${
              active ? "bg-accent text-accent-fg font-medium" : "text-fg hover:bg-surface-2"
            }`}
          >
            <span aria-hidden>{l.icon}</span>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
