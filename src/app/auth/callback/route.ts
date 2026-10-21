import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Google sends the user back here after sign-in. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/home", url.origin));
  }
  return NextResponse.redirect(new URL("/?error=signin", url.origin));
}
