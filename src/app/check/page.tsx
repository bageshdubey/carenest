import { ListEditor } from "@/components/app/list-editor";
import { type MedicineRow, toMedicine } from "@/lib/db/rows";
import { requireFamily } from "@/lib/supabase/server";

// Every page reads the login session, so it renders on the server per request.
export const instant = false;

/** Checks a new prescription's list, or edits the current list when nothing is pending. */
export default async function CheckPage() {
  const { supabase, family } = await requireFamily();
  const after = family.parent_linked_at ? "/home" : "/setup";

  const { data: pending } = await supabase
    .from("prescriptions")
    .select("id")
    .eq("family_id", family.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const query = pending
    ? supabase.from("medicines").select("*").eq("prescription_id", pending.id)
    : supabase.from("medicines").select("*").eq("family_id", family.id).eq("active", true);
  const { data: rows } = await query.order("created_at");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
      <ListEditor
        lang={family.child_lang}
        callName={family.parent_call_name}
        mode={pending ? "pending" : "active"}
        prescriptionId={pending?.id ?? null}
        medicines={((rows ?? []) as MedicineRow[]).map(toMedicine)}
        after={after}
      />
    </main>
  );
}
