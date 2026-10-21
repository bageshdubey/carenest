import { redirect } from "next/navigation";
import { SendLink } from "@/components/app/send-link";
import { SetupWizard } from "@/components/app/setup-wizard";
import { currentSession } from "@/lib/supabase/server";

// Every page reads the login session, so it renders on the server per request.
export const instant = false;

export default async function SetupPage() {
  const { user, family } = await currentSession();
  if (!user) redirect("/");
  if (family?.parent_linked_at) redirect("/home");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
      {family ? (
        <SendLink lang={family.child_lang} callName={family.parent_call_name} parentPhone={family.parent_phone} linkCode={family.link_code} />
      ) : (
        <SetupWizard defaultName={(user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? ""} />
      )}
    </main>
  );
}
