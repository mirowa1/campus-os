import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { createClient } from "@/lib/supabase/server";

type ServerClient = ReturnType<typeof createClient>;

/**
 * Load the current user; redirect to login on missing session or fetch timeout.
 */
export async function getUserOrRedirect(
  supabase: ServerClient,
  loginPath = "/login"
): Promise<User> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(loginPath);
    return user;
  } catch (err) {
    console.warn(
      "[getUserOrRedirect] getUser failed or timed out; redirecting to login",
      err instanceof Error ? err.message : err
    );
    redirect(loginPath);
  }
}
