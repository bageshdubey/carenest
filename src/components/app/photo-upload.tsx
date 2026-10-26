"use client";

import { Camera, FileImage, LoaderCircle } from "lucide-react";
import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import { uploadChildPrescription } from "@/app/actions";
import { Button } from "@/components/ui/button";

export type UploadErrors = { read: string; busy: string; size: string };
type UploadError = keyof UploadErrors;

/** Longest side of a photo after shrinking. Prescription text stays sharp at this size. */
const MAX_SIDE = 1600;
/** Photos smaller than this are sent as they are. */
const SHRINK_ABOVE_BYTES = 500 * 1024;
/** Same limit as the server: Vercel refuses requests over 4.5 MB, and a PDF can't be shrunk here. */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Phone camera photos are often 2 to 12 MB. This redraws a photo as a JPEG of at most 1600 px,
 * usually 200 to 500 KB. A PDF, a small photo or one the browser can't draw is sent as it is.
 */
export async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= SHRINK_ABOVE_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob && blob.size < file.size ? new File([blob], "prescription.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

type Source = "camera" | "file";

/** Phones and tablets have a touch screen and a camera the browser can open directly. */
const TOUCH = "(pointer: coarse)";
function onTouchChange(callback: () => void) {
  const query = window.matchMedia(TOUCH);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/**
 * Two ways to add a prescription: take a photo with the phone's camera, or choose a photo or PDF
 * already on the device. A laptop's browser ignores the camera hint, so there only "choose" shows.
 */
export function PhotoUpload({
  cameraLabel,
  pickLabel,
  readingText,
  errors,
  onDone,
}: {
  cameraLabel: string;
  pickLabel: string;
  readingText: string;
  errors: UploadErrors;
  onDone: () => void;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<Source | null>(null);
  const [error, setError] = useState<UploadError | null>(null);
  // Shown on the server render too, so a phone never sees it appear late.
  const canCapture = useSyncExternalStore(onTouchChange, () => window.matchMedia(TOUCH).matches, () => true);

  function send(source: Source, file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(source);
    start(async () => {
      try {
        const photo = await shrink(file);
        if (photo.size > MAX_UPLOAD_BYTES) return setError("size");
        const fd = new FormData();
        fd.set("photo", photo);
        const res = await uploadChildPrescription(fd);
        if (res.ok) onDone();
        else setError(res.error === "busy" || res.error === "size" ? res.error : "read");
      } catch (err) {
        // A dropped connection, or a request the server refused.
        console.error("Prescription upload failed", err);
        setError("read");
      }
    });
  }

  const onChange = (source: Source) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Cleared so that picking the same photo again, after an error, still starts an upload.
    e.target.value = "";
    send(source, file);
  };
  const icon = (source: Source) =>
    pending && busy === source ? (
      <LoaderCircle className="size-5 shrink-0 animate-spin" aria-hidden />
    ) : source === "camera" ? (
      <Camera className="size-5 shrink-0" aria-hidden />
    ) : (
      <FileImage className="size-5 shrink-0" aria-hidden />
    );

  return (
    <div className="flex flex-col gap-2.5">
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={onChange("camera")} />
      <input ref={picker} id="photo" type="file" accept="image/*,application/pdf" className="hidden" onChange={onChange("file")} />
      {canCapture ? (
        <Button size="lg" className="h-14 gap-2.5 rounded-2xl text-lg font-bold whitespace-normal" disabled={pending} onClick={() => camera.current?.click()}>
          {icon("camera")}
          {pending && busy === "camera" ? readingText : cameraLabel}
        </Button>
      ) : null}
      <Button
        size="lg"
        variant={canCapture ? "outline" : "default"}
        className={`h-14 gap-2.5 rounded-2xl text-lg whitespace-normal ${canCapture ? "" : "font-bold"}`}
        disabled={pending}
        onClick={() => picker.current?.click()}
      >
        {icon("file")}
        {pending && busy === "file" ? readingText : pickLabel}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-bad">
          {errors[error]}
        </p>
      ) : null}
    </div>
  );
}
