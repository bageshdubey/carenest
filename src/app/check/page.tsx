import { connection } from "next/server";
import { BackLink } from "@/components/app/back-link";
import { ListEditor, type ShownPhoto } from "@/components/app/list-editor";
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
  const medicines = ((rows ?? []) as MedicineRow[]).map(toMedicine);
  // A strip photo the child took is in the private bucket, so it gets a 1-hour link; a sample is already a web link.
  const realPaths = medicines.flatMap((m) => (m.photo?.kind === "real" && m.photo.path ? [m.photo.path] : []));
  const { data: signedPhotos } = realPaths.length ? await supabase.storage.from("uploads").createSignedUrls(realPaths, 3600) : { data: [] };
  const photos: Record<string, ShownPhoto> = {};
  for (const m of medicines) {
    if (!m.id || !m.photo) continue;
    const src = m.photo.kind === "sample" ? m.photo.url : (signedPhotos ?? []).find((s) => s.path === m.photo?.path)?.signedUrl;
    if (src) photos[m.id] = { src, kind: m.photo.kind, source: m.photo.source };
  }
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
        medicines={medicines}
        photos={photos}
        current={((currentRows ?? []) as MedicineRow[]).map(toMedicine)}
        after={after}
      />
    </main>
  );
}
