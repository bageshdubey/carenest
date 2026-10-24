"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/browser";

/** Google's "G", as Google asks sign-in buttons to show it. */
function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#fff" />
      <path d="M17.6 12.2c0-.4 0-.8-.1-1.2H12v2.2h3.2a2.8 2.8 0 0 1-1.2 1.8v1.5h1.9c1.1-1 1.7-2.5 1.7-4.3Z" fill="#4285F4" />
      <path d="M12 18c1.6 0 2.9-.5 3.9-1.4l-1.9-1.5c-.5.4-1.2.6-2 .6a3.5 3.5 0 0 1-3.3-2.4H6.8v1.5A6 6 0 0 0 12 18Z" fill="#34A853" />
      <path d="M8.7 13.3a3.6 3.6 0 0 1 0-2.3V9.5H6.8a6 6 0 0 0 0 5.3l1.9-1.5Z" fill="#FBBC05" />
      <path d="M12 8.4c.9 0 1.6.3 2.2.9l1.7-1.7A6 6 0 0 0 6.8 9.5l1.9 1.5A3.5 3.5 0 0 1 12 8.4Z" fill="#EA4335" />
    </svg>
  );
}

export function GoogleButton({ label }: { label: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="lg"
      className="h-14 w-full gap-3 rounded-2xl text-lg font-bold"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await supabaseBrowser().auth.signInWithOAuth({
          provider: "google",
          // Always show Google's account list, so people with several Gmails pick one.
          options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: "select_account" } },
        });
      }}
    >
      <GoogleG />
      {label}
    </Button>
  );
}
