"use client";

import { useRouter } from "next/navigation";
import { PhotoUpload } from "./photo-upload";

export function AddPrescription(props: { label: string; readingText: string; errorText: string }) {
  const router = useRouter();
  return (
    <div className="mt-auto">
      <PhotoUpload {...props} onDone={() => router.push("/check")} />
    </div>
  );
}
