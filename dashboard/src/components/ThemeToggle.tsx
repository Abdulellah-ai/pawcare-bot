"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "light" || explicit === "dark") return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => setTheme(currentTheme()), []);

  function toggle() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch { /* storage may be unavailable; theme still applies for this visit */ }
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="تبديل الوضع الليلي والنهاري"
      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-2"
    >
      {theme === "dark" ? "☀️ الوضع النهاري" : "🌙 الوضع الليلي"}
    </button>
  );
}
