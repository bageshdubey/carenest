import { BellRing, Camera, UserPlus } from "lucide-react";
import { redirect } from "next/navigation";
import { GoogleButton } from "@/components/app/google-button";
import { makeT } from "@/lib/i18n/child";
import { currentSession } from "@/lib/supabase/server";

// Every page reads the login session, so it renders on the server per request.
export const instant = false;

const STEPS = [
  { Icon: UserPlus, title: "Add your parent's number", body: "One-time setup here, 2 minutes." },
  { Icon: Camera, title: "They send a prescription photo", body: "On WhatsApp, nothing to install." },
  { Icon: BellRing, title: "Reminders at every meal", body: "You see each dose here, taken or missed." },
];

export default async function Landing({ searchParams }: PageProps<"/">) {
  const { user } = await currentSession();
  if (user) redirect("/home");
  const { error } = await searchParams;
  const t = makeT("en");

  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-8 px-4 py-10 md:grid-cols-2 md:gap-12">
      <div className="flex flex-col gap-5">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">CareNest · {t("forFamilies")}</p>
        <h1 className="text-3xl leading-tight font-bold md:text-4xl">{t("landingTitle")}</h1>
        <p className="text-muted-foreground">{t("landingBody")}</p>

        <ol className="flex flex-col gap-3">
          {STEPS.map(({ Icon, title, body }, i) => (
            <li key={title} className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="flex flex-col">
                <span className="font-bold">
                  {i + 1}. {title}
                </span>
                <span className="text-sm text-muted-foreground">{body}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-4 rounded-3xl bg-card p-5">
        <p className="text-xs text-muted-foreground">On your parent&apos;s WhatsApp</p>
        <div className="flex flex-col gap-2 rounded-2xl bg-muted p-3">
          <div className="flex items-center gap-2 self-end rounded-2xl rounded-br-sm bg-brand-soft px-3 py-2 text-sm">
            <Camera className="size-4" aria-hidden /> Prescription photo
          </div>
          <div className="max-w-[85%] self-start rounded-2xl rounded-bl-sm bg-card px-3 py-2 text-sm">
            <p className="font-mono text-xs text-muted-foreground">{t("example")}</p>
            <p className="mt-1 font-mono text-xs">Breakfast, after food</p>
            <p>Amlodipine 5 mg, 1 tablet (for blood pressure)</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {error ? <p className="text-sm text-bad">{t("signinError")}</p> : null}
          <GoogleButton label={t("google")} />
          <p className="text-center text-xs text-muted-foreground">{t("noPassword")}</p>
        </div>
      </div>
    </main>
  );
}
