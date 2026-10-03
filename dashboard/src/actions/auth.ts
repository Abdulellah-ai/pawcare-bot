"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null };

const credentials = z.object({ email: z.string().trim().email().max(200), password: z.string().min(1).max(200) });

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "أدخل بريدًا إلكترونيًا وكلمة مرور صحيحين." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "بيانات الدخول غير صحيحة." }; // never reveal which part was wrong
  const { data } = await supabase.rpc("is_admin");
  if (data !== true) {
    await supabase.auth.signOut();
    return { error: "هذا الحساب غير مخوّل بدخول اللوحة." };
  }
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
