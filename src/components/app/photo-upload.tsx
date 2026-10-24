"use client";

import { Camera, LoaderCircle } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { uploadChildPrescription } from "@/app/actions";
import { Button } from "@/components/ui/button";

/** Takes or picks a prescription photo and sends it to be read. */
export function PhotoUpload({ label, readingText, errorText, onDone }: { label: string; readingText: string; errorText: string; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        id="photo"
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setError(false);
          const fd = new FormData();
          fd.set("photo", file);
          start(async () => {
            const res = await uploadChildPrescription(fd);
            if (res.ok) onDone();
            else setError(true);
          });
        }}
      />
      <Button size="lg" className="h-14 gap-2.5 rounded-2xl text-lg font-bold whitespace-normal" disabled={pending} onClick={() => input.current?.click()}>
        {pending ? <LoaderCircle className="size-5 shrink-0 animate-spin" aria-hidden /> : <Camera className="size-5 shrink-0" aria-hidden />}
        {pending ? readingText : label}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-bad">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}
