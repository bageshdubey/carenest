import { LockKeyhole } from "lucide-react";
import Link from "next/link";

/** Reassurance before the child adds health data: how photos are kept, with a link to the full policy. */
export function PrivacyNote({ text, linkLabel }: { text: string; linkLabel: string }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">
      <LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        {text}{" "}
        <Link href="/privacy" className="underline">
          {linkLabel}
        </Link>
      </span>
    </p>
  );
}
