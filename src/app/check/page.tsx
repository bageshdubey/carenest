import { connection } from "next/server";
import { BackLink } from "@/components/app/back-link";
import { ListEditor } from "@/components/app/list-editor";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { type MedicineRow, toMedicine } from "@/lib/db/rows";
import { makeT } from "@/lib/i18n/child";
import { requireFamily } from "@/lib/supabase/server";

// Every page reads the login session, so it renders on the server per request.
export const instant = false;

/** Checks a new prescription's list, or edits the current list when nothing is pending. */
export default async function CheckPage() {
  // Render only for the real request: the login check reads the current time.
  await connection();
  const { supabase, family } = await requireFamily();
  const after = family.parent_linked_at ? "/home" : "/setup";
  const t = makeT(family.child_lang);

  const { data: pending } = await supabase
    .from("prescriptions")
    .select("id, photo_path")
    .eq("family_id", family.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // The child checks the list against the photo. The bucket is private, so a link that works for 1 hour.
  const { data: signed } = pending?.photo_path ? await supabase.storage.from("uploads").createSignedUrl(pending.photo_path, 3600) : { data: null };

  const query = pending
    ? supabase.from("medicines").select("*").eq("prescription_id", pending.id)
    : supabase.from("medicines").select("*").eq("family_id", family.id).eq("active", true);
  const { data: rows } = await query.order("created_at");
  // A new prescription is added to the current list, so its medicines are compared with that list.
  const { data: currentRows } = pending
    ? await supabase.from("medicines").select("*").eq("family_id", family.id).eq("active", true).order("created_at")
    : { data: [] };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
      <div className="mb-2 flex items-center justify-between">
        <BackLink href={after} label={t("back")} />
        <ThemeToggle label={t("themeToggle")} />
      </div>
      <ListEditor
        lang={family.child_lang}
        callName={family.parent_call_name}
        mode={pending ? "pending" : "active"}
        prescriptionId={pending?.id ?? null}
        photoUrl={signed?.signedUrl ?? null}
        photoIsPdf={!!pending?.photo_path?.endsWith(".pdf")}
        medicines={((rows ?? []) as MedicineRow[]).map(toMedicine)}
        current={((currentRows ?? []) as MedicineRow[]).map(toMedicine)}
        after={after}
      />
    </main>
  );
}
