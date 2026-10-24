"use client";

import { Camera, Check, LoaderCircle, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { parentLinked } from "@/app/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChildLang, ParentLang } from "@/lib/domain/types";
import { makeT } from "@/lib/i18n/child";
import { pm } from "@/lib/i18n/parent";
import { IlloPanel, JoinedIllo, SendIllo } from "./illustrations";

/** How often the page asks whether the parent has sent the message. */
const POLL_MS = 4000;
const LANG_KEY = { en: "langEn", hi: "langHi", mr: "langMr" } as const;

/**
 * The link the parent taps opens a chat with CareNest, with a message that carries the
 * family's code. The child sends it to the parent on WhatsApp, in the parent's language.
 * The page checks by itself and shows "connected" as soon as the parent's message arrives.
 */
export function SendLink({
  lang,
  callName,
  parentPhone,
  parentLang,
  linkCode,
  hasList,
}: {
  lang: ChildLang;
  callName: string;
  parentPhone: string;
  parentLang: ParentLang;
  linkCode: string;
  hasList: boolean;
}) {
  const t = makeT(lang, { n: callName });
  const [tapped, setTapped] = useState(false);
  const [linked, setLinked] = useState(false);
  const [copied, setCopied] = useState(false);
  const botNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";
  const botLink = `https://wa.me/${botNumber}?text=${encodeURIComponent(`Hi CareNest ${linkCode}`)}`;
  const invite = pm(parentLang, "invite", { n: callName, link: botLink });
  const shareUrl = `https://wa.me/${parentPhone}?text=${encodeURIComponent(invite)}`;
  const parentLangName = t(LANG_KEY[parentLang]);

  useEffect(() => {
    if (linked) return;
    const id = setInterval(async () => {
      try {
        if (await parentLinked()) setLinked(true);
      } catch {
        // A failed check is tried again on the next tick.
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [linked]);

  if (linked) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <IlloPanel className="mt-2 h-56">
          <JoinedIllo />
        </IlloPanel>
        <div role="status" className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl leading-tight font-bold">{t("connectedTitle")}</h1>
          <p className="max-w-80 text-[17px] leading-relaxed text-muted-foreground">{t("connectedSub", { l: parentLangName })}</p>
        </div>
        <section className="flex flex-col gap-3 rounded-2xl bg-card p-4">
          <h2 className="text-sm font-bold text-muted-foreground">{hasList ? t("allSet") : t("nextRx")}</h2>
          {hasList ? (
            <p className="flex items-start gap-3 text-base leading-snug">
              <Check className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              {t("allSetBody")}
            </p>
          ) : (
            <>
              <p className="flex items-start gap-3 text-base leading-snug">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft">
                  <MessageCircle className="size-[18px] text-primary" aria-hidden />
                </span>
                {t("nextRxParent")}
              </p>
              <p className="flex items-start gap-3 text-base leading-snug">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft">
                  <Camera className="size-[18px] text-primary" aria-hidden />
                </span>
                {t("nextRxYou")}
              </p>
            </>
          )}
        </section>
        <div className="mt-auto flex flex-col gap-2.5">
          <Link href="/home" className={cn(buttonVariants({ size: "lg" }), "h-14 rounded-2xl text-lg font-bold")}>
            {t("toDashboard")}
          </Link>
          {hasList ? null : (
            <Link href="/add" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-13 rounded-2xl text-[17px]")}>
              {t("addPhoto")}
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="text-sm font-bold text-primary">{t("lastStep")}</p>
      <IlloPanel>
        <SendIllo />
      </IlloPanel>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] leading-tight font-bold">{t("sendTitle")}</h1>
        <p className="text-[17px] leading-relaxed text-muted-foreground">{t("sendSub")}</p>
      </div>
      <section className="flex flex-col gap-2 rounded-2xl bg-card p-4">
        <h2 className="text-sm font-bold text-muted-foreground">{t("sendPreview", { l: parentLangName })}</h2>
        <p lang={parentLang} className="text-base leading-relaxed">
          {invite.replace(botLink, "").replace(/[:：]\s*$/, "").trim()}
        </p>
        <p className="text-sm text-primary underline">wa.me/… (CareNest)</p>
      </section>
      {tapped ? (
        <p role="status" className="flex items-center gap-3 rounded-2xl bg-warn-soft px-3.5 py-3 text-[15px] leading-snug text-warn">
          <LoaderCircle className="size-5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
          {t("waiting")}
        </p>
      ) : null}
      <div className="mt-auto flex flex-col gap-2">
        <a
          href={shareUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => setTapped(true)}
          className={cn(buttonVariants({ size: "lg" }), "h-14 gap-2.5 rounded-2xl text-lg font-bold")}
        >
          <MessageCircle className="size-5" aria-hidden />
          {t("shareWa")}
        </a>
        <Button
          variant="ghost"
          size="lg"
          className="h-12 rounded-2xl text-base font-bold text-primary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(botLink);
              setCopied(true);
              setTapped(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? t("copied") : t("copyLink")}
        </Button>
        <Link href="/home" className="py-2 text-center text-sm text-muted-foreground underline">
          {t("goHome")}
        </Link>
      </div>
    </div>
  );
}
