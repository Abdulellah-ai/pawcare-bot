"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/actions/auth";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, { error: null });
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="text-sm font-medium" htmlFor="email">البريد الإلكتروني</label>
      <input id="email" name="email" type="email" required autoComplete="username" dir="ltr"
        className="rounded-lg border border-border bg-bg px-3 py-2 text-sm" />
      <label className="text-sm font-medium" htmlFor="password">كلمة المرور</label>
      <input id="password" name="password" type="password" required autoComplete="current-password" dir="ltr"
        className="rounded-lg border border-border bg-bg px-3 py-2 text-sm" />
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button type="submit" disabled={pending} className="mt-1 rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg disabled:opacity-60">
        {pending ? "جارٍ الدخول…" : "دخول"}
      </button>
    </form>
  );
}
