import { ChevronLeft } from "lucide-react";
import Link from "next/link";

/** "< Back" at the top left of a screen. A plain link, so it works before any script loads. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="-ml-2 flex h-10 items-center gap-1 rounded-xl px-2 text-[15px] font-medium text-foreground hover:bg-muted">
      <ChevronLeft className="size-5" aria-hidden />
      {label}
    </Link>
  );
}
