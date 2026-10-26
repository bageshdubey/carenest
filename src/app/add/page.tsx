import { connection } from "next/server";
import { AddPrescription } from "@/components/app/add-prescription";
import { BackLink } from "@/components/app/back-link";
import { PrivacyNote } from "@/components/app/privacy-note";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { makeT } from "@/lib/i18n/child";
import { requireFamily } from "@/lib/supabase/server";

// Every page reads the login session, so it renders on the server per request.
export const instant = false;

/** The child adds another prescription photo from the Medicines tab. */
export default async function AddPage() {
  // Render only for the real request: the login check reads the current time.
  await connection();
  const { family } = await requireFamily();
  const t = makeT(family.child_lang, { n: family.parent_call_name });
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <BackLink href={family.parent_linked_at ? "/home?tab=meds" : "/setup"} label={t("back")} />
        <ThemeToggle label={t("themeToggle")} />
      </div>
      <h1 className="text-2xl leading-tight font-bold">{t("addRx")}</h1>
      <p className="text-muted-foreground">{t("photosSub")}</p>
      <PrivacyNote text={t("privacyNote")} linkLabel={t("privacy")} />
      <AddPrescription cameraLabel={t("takePhoto")} pickLabel={t("choosePhoto")} readingText={t("reading")} errors={{ read: t("readErr"), busy: t("busyErr"), size: t("sizeErr") }} />
    </main>
  );
}
