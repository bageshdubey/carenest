import { redirect } from "next/navigation";
import { connection } from "next/server";
import { signOut } from "@/app/actions";
import { SendLink } from "@/components/app/send-link";
import { SetupWizard } from "@/components/app/setup-wizard";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { makeT } from "@/lib/i18n/child";
import { currentSession } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

// Every page reads the login session, so it renders on the server per request.
export const instant = false;

export default async function SetupPage() {
  // Render only for the real request: the login check reads the current time.
  await connection();
  const { supabase, user, family } = await currentSession();
  if (!user) redirect("/");
  if (family?.parent_linked_at) redirect("/home");

  const t = makeT(family?.child_lang ?? "en");
  // The "connected" screen says what is still missing: an approved list, or not yet.
  const { count } = family
    ? await supabase.from("medicines").select("id", { count: "exact", head: true }).eq("family_id", family.id).eq("active", true)
    : { count: 0 };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
      <form action={signOut} className="mb-4 flex items-center justify-end gap-2">
        <ThemeToggle label={t("themeToggle")} />
        <button type="submit" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-lg")}>
          {t("signOut")}
        </button>
      </form>
      {family ? (
        <SendLink
          lang={family.child_lang}
          callName={family.parent_call_name}
          parentPhone={family.parent_phone}
          parentLang={family.parent_lang}
          linkCode={family.link_code}
          hasList={(count ?? 0) > 0}
        />
      ) : (
        <SetupWizard defaultName={(user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? ""} />
      )}
    </main>
  );
}
