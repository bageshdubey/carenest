import { redirect } from "next/navigation";
import { signOut } from "@/app/actions";
import { SendLink } from "@/components/app/send-link";
import { SetupWizard } from "@/components/app/setup-wizard";
import { buttonVariants } from "@/components/ui/button";
import { makeT } from "@/lib/i18n/child";
import { currentSession } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

// Every page reads the login session, so it renders on the server per request.
export const instant = false;

export default async function SetupPage() {
  const { user, family } = await currentSession();
  if (!user) redirect("/");
  if (family?.parent_linked_at) redirect("/home");

  const t = makeT(family?.child_lang ?? "en");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
      <form action={signOut} className="mb-4 flex justify-end">
        <button type="submit" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-lg")}>
          {t("signOut")}
        </button>
      </form>
      {family ? (
        <SendLink lang={family.child_lang} callName={family.parent_call_name} parentPhone={family.parent_phone} linkCode={family.link_code} />
      ) : (
        <SetupWizard defaultName={(user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? ""} />
      )}
    </main>
  );
}
