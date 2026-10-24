"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function GoogleButton({ label }: { label: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="lg"
      className="h-12 w-full rounded-xl text-base font-bold"
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
      {label}
    </Button>
  );
}
