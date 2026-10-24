import { Lock, MessageCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleButton } from "@/components/app/google-button";
import { HeroVideo } from "@/components/app/hero-video";
import { LogoMark } from "@/components/app/illustrations";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { makeT } from "@/lib/i18n/child";
import { currentSession } from "@/lib/supabase/server";

// Every page reads the login session, so it renders on the server per request.
export const instant = false;

export default async function Landing({ searchParams }: PageProps<"/">) {
  const { user } = await currentSession();
  if (user) redirect("/home");
  const { error, lang: langParam } = await searchParams;
  const lang = langParam === "hi" ? "hi" : "en";
  const t = makeT(lang);
  const trust = [
    { Icon: ShieldCheck, text: t("trustAdvice") },
    { Icon: MessageCircle, text: t("trustNoApp") },
    { Icon: Lock, text: t("trustPrivate") },
  ];
  const seg = (code: "en" | "hi", label: string) => (
    <Link
      href={code === "en" ? "/" : "/?lang=hi"}
      aria-current={lang === code ? "true" : undefined}
      className={`grid min-h-8 place-items-center rounded-full px-3 text-sm ${lang === code ? "bg-card font-bold" : "text-muted-foreground"}`}
    >
      {label}
    </Link>
  );

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-6 md:max-w-5xl">
      <header className="flex items-center justify-between py-4">
        <span className="flex items-center gap-2">
          <LogoMark />
          <span className="font-heading text-lg font-bold">CareNest</span>
        </span>
        <div className="flex items-center gap-2">
          <nav className="flex rounded-full bg-muted p-[3px]" aria-label="Language">
            {seg("en", "EN")}
            {seg("hi", "हिंदी")}
          </nav>
          <ThemeToggle label={t("themeToggle")} className="size-[38px] rounded-full bg-muted" />
        </div>
      </header>

      <div className="grid flex-1 gap-6 md:grid-cols-2 md:items-center md:gap-12">
        <HeroVideo label={t("videoLabel")} pauseLabel={t("pauseVideo")} playLabel={t("playVideo")} className="md:order-last" />

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            <h1 className="text-[32px] leading-[1.1] font-bold tracking-tight md:text-5xl">{t("landingHeadline")}</h1>
            <p className="text-[17px] leading-relaxed text-muted-foreground">{t("landingSub")}</p>
          </div>

          <div className="flex flex-col gap-2">
            {error ? <p className="text-sm text-bad">{t("signinError")}</p> : null}
            <GoogleButton label={t("google")} />
            <p className="text-center text-sm text-muted-foreground">{t("noPassword")}</p>
          </div>

          <ul className="flex flex-wrap gap-2">
            {trust.map(({ Icon, text }) => (
              <li key={text} className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm">
                <Icon className="size-4 text-primary" aria-hidden />
                {text}
              </li>
            ))}
          </ul>

          <section className="flex flex-col gap-2.5 rounded-2xl bg-card p-4">
            <h2 className="text-sm font-bold text-muted-foreground">{t("howTitle")}</h2>
            <ol className="flex flex-col gap-2.5">
              {(["how1", "how2", "how3"] as const).map((k, i) => (
                <li key={k} className="flex items-center gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold text-primary">{i + 1}</span>
                  <span className="text-[15px] leading-snug">{t(k)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      <footer className="pt-8 text-center text-sm text-muted-foreground">
        <Link href="/privacy" className="underline">
          {t("privacy")}
        </Link>
      </footer>
    </main>
  );
}
