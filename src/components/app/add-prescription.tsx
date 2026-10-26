"use client";

import { useRouter } from "next/navigation";
import { PhotoUpload, type UploadErrors } from "./photo-upload";

export function AddPrescription(props: { cameraLabel: string; pickLabel: string; readingText: string; errors: UploadErrors }) {
  const router = useRouter();
  return (
    <div className="mt-auto">
      <PhotoUpload {...props} onDone={() => router.push("/check")} />
    </div>
  );
}
