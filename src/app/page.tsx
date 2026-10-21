import { redirect } from "next/navigation";
import { GoogleButton } from "@/components/app/google-button";
import { makeT } from "@/lib/i18n/child";
import { currentSession } from "@/lib/supabase/server";

// Every page reads the login session, so it renders on the server per request.
export const instant = false;

export default async function Landing({ searchParams }: PageProps<"/">) {
  const { user } = await currentSession();
  if (user) redirect("/home");
  const { error } = await searchParams;
  const t = makeT("en");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-10">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">CareNest · {t("forFamilies")}</p>
      <h1 className="text-3xl leading-tight font-bold">{t("landingTitle")}</h1>
      <p className="text-muted-foreground">{t("landingBody")}</p>

      <div className="rounded-2xl bg-card p-4">
        <p className="text-xs text-muted-foreground">{t("example")}</p>
        <p className="mt-2 font-mono text-sm">Breakfast, after food</p>
        <p>Amlodipine 5 mg, 1 tablet (for blood pressure)</p>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        {error ? <p className="text-sm text-bad">{t("signinError")}</p> : null}
        <GoogleButton label={t("google")} />
        <p className="text-center text-xs text-muted-foreground">{t("noPassword")}</p>
      </div>
    </main>
  );
}
