import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { FamilyRow } from "@/lib/db/rows";

/** Supabase client acting as the signed-in child. Row-level security applies. */
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(list) {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}

/** The signed-in user and their family, or null for either. */
export async function currentSession() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, family: null };
  const { data } = await supabase.from("families").select("*").eq("owner_id", user.id).maybeSingle();
  return { supabase, user, family: (data as FamilyRow | null) ?? null };
}

/** For pages and actions that need a family: sends the user to the right place otherwise. */
export async function requireFamily() {
  const s = await currentSession();
  if (!s.user) redirect("/");
  if (!s.family) redirect("/setup");
  return { supabase: s.supabase, user: s.user, family: s.family };
}
