import { AddPrescription } from "@/components/app/add-prescription";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { makeT } from "@/lib/i18n/child";
import { requireFamily } from "@/lib/supabase/server";

// Every page reads the login session, so it renders on the server per request.
export const instant = false;

/** The child adds another prescription photo from the Medicines tab. */
export default async function AddPage() {
  const { family } = await requireFamily();
  const t = makeT(family.child_lang, { n: family.parent_call_name });
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <div className="flex justify-end">
        <ThemeToggle label={t("themeToggle")} />
      </div>
      <h1 className="text-2xl leading-tight font-bold">{t("addRx")}</h1>
      <p className="text-muted-foreground">{t("photosSub")}</p>
      <AddPrescription label={t("addPhoto")} readingText={t("reading")} errorText={t("readErr")} />
    </main>
  );
}
