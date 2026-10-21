"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChildLang } from "@/lib/domain/types";
import { makeT } from "@/lib/i18n/child";

/**
 * The link the parent taps opens a chat with CareNest, with a message that
 * carries the family's code. The child shares it to the parent on WhatsApp.
 */
export function SendLink({ lang, callName, parentPhone, linkCode }: { lang: ChildLang; callName: string; parentPhone: string; linkCode: string }) {
  const t = makeT(lang, { n: callName });
  const [copied, setCopied] = useState(false);
  const botNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";
  const botLink = `https://wa.me/${botNumber}?text=${encodeURIComponent(`Hi CareNest ${linkCode}`)}`;
  const shareText = `${callName}, tap this link and send the message. It's CareNest, for your medicines: ${botLink}`;
  const shareUrl = `https://wa.me/${parentPhone}?text=${encodeURIComponent(shareText)}`;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <h1 className="text-2xl leading-tight font-bold">{t("sendTitle")}</h1>
      <p className="text-muted-foreground">{t("sendSub")}</p>
      <div className="rounded-2xl bg-card p-4 font-mono text-sm break-all">{botLink}</div>
      <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">{t("waiting")}</p>
      <div className="mt-auto flex flex-col gap-2">
        <a href={shareUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants({ size: "lg" }), "h-12 rounded-xl text-base font-bold")}>
          {t("shareWa")}
        </a>
        <Button
          variant="outline"
          size="lg"
          className="h-12 rounded-xl"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(botLink);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? t("copied") : t("copyLink")}
        </Button>
        <Link href="/home" className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-12 rounded-xl")}>
          {t("goHome")}
        </Link>
      </div>
    </div>
  );
}
