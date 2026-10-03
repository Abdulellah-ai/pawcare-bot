import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Layer 1 of the two-layer write defense (layer 2 is is_admin() inside every SECURITY DEFINER RPC).
 * Verifies the JWT with the auth server (getUser) and then the admin flag in the database.
 */
export const requireAdmin = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data, error } = await supabase.rpc("is_admin");
  if (error || data !== true) redirect("/login?e=forbidden");
  return { supabase, user };
});
