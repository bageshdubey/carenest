"use client";

import { Check, LoaderCircle, Pause, Play, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createFamily } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mealsInOrder } from "@/lib/domain/meals";
import type { ChildLang, MealKey, ParentLang } from "@/lib/domain/types";
import { CHILD_MEALS, makeT } from "@/lib/i18n/child";
import { pm } from "@/lib/i18n/parent";
import { ClockIllo, FamilyIllo, IlloPanel, PhoneIllo, RxIllo } from "./illustrations";
import { PhotoUpload } from "./photo-upload";
import { PrivacyNote } from "./privacy-note";

const CALL_NAMES = ["Amma", "Papa", "Mummy", "Aai", "Baba"];
const PARENT_LANGS: [ParentLang, string][] = [
  ["en", "English"],
  ["hi", "हिंदी"],
  ["mr", "मराठी"],
];
const TOTAL = 4;

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`min-h-12 rounded-full px-[18px] text-[17px] ${on ? "border-2 border-primary bg-brand-soft font-bold text-primary" : "border-[1.5px] border-border bg-card"}`}
    >
      {children}
    </button>
  );
}

/** Four bars, filled up to this step, with "Step 2 of 4" under them. */
function Progress({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
        {Array.from({ length: TOTAL }, (_, i) => (
          <span key={i} className={`h-1.5 rounded-full ${i < step ? "bg-primary" : "bg-border"}`} />
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function SetupWizard({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [childName, setChildName] = useState(defaultName);
  const [call, setCall] = useState("Amma");
  const [other, setOther] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [childLang, setChildLang] = useState<ChildLang>("en");
  const [parentLang, setParentLang] = useState<ParentLang>("en");
  const [meals, setMeals] = useState<Record<MealKey, string>>({ b: "08:30", l: "13:30", d: "20:30" });
  const [error, setError] = useState("");
  const [saving, start] = useTransition();

  const callName = call === "Other" ? other.trim() : call;
  const t = makeT(childLang, { n: callName || "Amma" });
  const digits = (s: string) => s.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");

  function next() {
    setError("");
    if (step === 1) {
      if (!childName.trim()) return setError(t("nameErr"));
      if (!callName) return setError(t("otherErr"));
    }
    if (step === 2 && digits(parentPhone).length !== 10) return setError(t("numErr"));
    if (step === 4) {
      if (!mealsInOrder(meals)) return setError(t("mealOrderErr"));
      start(async () => {
        const res = await createFamily({ childName, callName, parentPhone, childLang, parentLang, meals });
        if (res.ok) setStep(5);
        else if (res.error === "phoneTaken") {
          setStep(2);
          setError(t("phoneTaken"));
        } else setError(res.error === "meals" ? t("mealOrderErr") : res.error === "phone" ? t("numErr") : t("saveErr"));
      });
      return;
    }
    setStep(step + 1);
  }

  if (step === 5) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <p className="flex items-center gap-1.5 text-sm font-bold text-primary">
          <Check className="size-4" aria-hidden /> {t("setupSaved")}
        </p>
        <IlloPanel className="h-44">
          <RxIllo />
        </IlloPanel>
        <h1 className="text-[28px] leading-tight font-bold">{t("photosQ")}</h1>
        <p className="text-[17px] leading-relaxed text-muted-foreground">{t("photosSub")}</p>
        <PrivacyNote text={t("privacyNote")} linkLabel={t("privacy")} />
        <div className="mt-auto flex flex-col gap-2.5">
          <PhotoUpload
            cameraLabel={t("takePhoto")}
            pickLabel={t("choosePhoto")}
            readingText={t("reading")}
            errors={{ read: t("readErr"), busy: t("busyErr"), size: t("sizeErr") }}
            onDone={() => router.push("/check")}
          />
          <Button variant="outline" size="lg" className="h-13 rounded-2xl text-[17px]" onClick={() => router.refresh()}>
            {t("skip")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <Progress step={step} label={t("step", { a: step, b: TOTAL })} />

      {step === 1 && (
        <>
          <IlloPanel>
            <FamilyIllo />
          </IlloPanel>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="childName" className="font-bold text-muted-foreground">
              {t("yourName")}
            </Label>
            <Input id="childName" className="h-13 rounded-2xl bg-card text-lg" value={childName} onChange={(e) => setChildName(e.target.value)} />
          </div>
          <h1 className="text-2xl leading-tight font-bold">{t("callQ")}</h1>
          <div className="flex flex-wrap gap-2">
            {[...CALL_NAMES, "Other"].map((c) => (
              <Chip key={c} on={call === c} onClick={() => setCall(c)}>
                {c === "Other" ? t("other") : c}
              </Chip>
            ))}
          </div>
          {call === "Other" && (
            <Input id="other" className="h-13 rounded-2xl bg-card text-lg" placeholder={t("otherPlaceholder")} aria-label={t("callQ")} value={other} onChange={(e) => setOther(e.target.value)} />
          )}
          <p className="text-sm text-muted-foreground">{t("callSub")}</p>
        </>
      )}

      {step === 2 && (
        <>
          <IlloPanel>
            <PhoneIllo />
          </IlloPanel>
          <h1 className="text-[28px] leading-tight font-bold">{t("parentNumberQ")}</h1>
          <PhoneInput id="parentPhone" label={t("parentNumberQ")} value={parentPhone} onChange={setParentPhone} />
          <div className="flex items-start gap-3 rounded-2xl bg-card p-4">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <p className="text-[15px] leading-relaxed">
              {t("parentNumberSub")} {t("numUse")}
            </p>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h1 className="text-[26px] leading-tight font-bold">{t("langQ")}</h1>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold text-muted-foreground">{t("langYou")}</p>
            <div className="flex flex-wrap gap-2">
              <Chip on={childLang === "en"} onClick={() => setChildLang("en")}>
                English
              </Chip>
              <Chip on={childLang === "hi"} onClick={() => setChildLang("hi")}>
                हिंदी
              </Chip>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold text-muted-foreground">{t("langParent")}</p>
            <div className="flex flex-wrap gap-2">
              {PARENT_LANGS.map(([code, label]) => (
                <Chip key={code} on={parentLang === code} onClick={() => setParentLang(code)}>
                  {label}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-bold text-muted-foreground">{t("firstMsg")}</p>
            <WelcomePreview
              key={parentLang}
              text={pm(parentLang, "welcome", { n: callName || "Amma", c: childName.trim() || "…" })}
              lang={parentLang}
              voiceUrl={`/api/welcome-voice?${new URLSearchParams({ lang: parentLang, n: callName || "Amma", c: childName.trim() })}`}
              labels={{ play: t("playVoice"), pause: t("pauseVoice"), error: t("voiceErr") }}
            />
          </div>
          <p className="text-sm text-muted-foreground">{t("langNote")}</p>
        </>
      )}

      {step === 4 && (
        <>
          <IlloPanel>
            <ClockIllo />
          </IlloPanel>
          <h1 className="text-[28px] leading-tight font-bold">{t("mealsQ")}</h1>
          <p className="text-[17px] leading-relaxed text-muted-foreground">{t("mealsSub")}</p>
          <div className="rounded-2xl bg-card px-4">
            {(["b", "l", "d"] as MealKey[]).map((k) => (
              <div key={k} className="flex items-center justify-between border-b py-3 last:border-0">
                <Label htmlFor={`meal_${k}`} className="text-[17px]">
                  {CHILD_MEALS[childLang][k]}
                </Label>
                <input
                  id={`meal_${k}`}
                  type="time"
                  value={meals[k]}
                  onChange={(e) => setMeals({ ...meals, [k]: e.target.value })}
                  className="rounded-xl border-[1.5px] bg-background px-2.5 py-2 font-mono text-[17px]"
                />
              </div>
            ))}
          </div>
        </>
      )}

      {error ? (
        <p role="alert" className="rounded-xl bg-bad-soft px-3 py-2.5 text-[15px] text-bad">
          {error}
        </p>
      ) : null}

      <div className="mt-auto flex gap-2.5 pt-2">
        {step > 1 && (
          <Button variant="outline" size="lg" className="h-13 flex-1 rounded-2xl text-[17px]" onClick={() => setStep(step - 1)} disabled={saving}>
            {t("back")}
          </Button>
        )}
        <Button size="lg" className="h-13 flex-[2] rounded-2xl text-[17px] font-bold" onClick={next} disabled={saving}>
          {t("next")}
        </Button>
      </div>
    </div>
  );
}

type VoiceStatus = "idle" | "loading" | "playing" | "error";

/**
 * What the parent's first WhatsApp will look like: a voice note, then the welcome text.
 * The voice loads only on the first tap. The parent passes key={lang}, so changing the
 * language starts a fresh player for the new voice.
 */
function WelcomePreview({
  text,
  lang,
  voiceUrl,
  labels,
}: {
  text: string;
  lang: ParentLang;
  voiceUrl: string;
  labels: { play: string; pause: string; error: string };
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [progress, setProgress] = useState(0);

  function toggle() {
    const el = audio.current;
    if (!el) return;
    if (status === "playing" || status === "loading") {
      el.pause();
      return;
    }
    // After a failed load the element stays broken until it is told to fetch again.
    if (status === "error") el.load();
    setStatus("loading");
    el.play().catch(() => setStatus("error"));
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-[#ece5dd] p-3 dark:bg-muted">
      <audio
        ref={audio}
        src={voiceUrl}
        preload="none"
        onPlaying={() => setStatus("playing")}
        onWaiting={() => setStatus("loading")}
        onPause={() => setStatus((s) => (s === "error" ? s : "idle"))}
        onEnded={() => setProgress(0)}
        onTimeUpdate={(e) => {
          const { currentTime, duration } = e.currentTarget;
          if (duration > 0 && Number.isFinite(duration)) setProgress(currentTime / duration);
        }}
        onError={() => setStatus("error")}
      />
      <div className="flex w-52 items-center gap-2.5 rounded-2xl rounded-bl-sm bg-card px-3 py-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={status === "playing" || status === "loading" ? labels.pause : labels.play}
          className="grid size-7 shrink-0 place-items-center rounded-full bg-primary"
        >
          {status === "loading" ? (
            <LoaderCircle className="size-3.5 animate-spin text-primary-foreground" aria-hidden />
          ) : status === "playing" ? (
            <Pause className="size-3.5 fill-primary-foreground text-primary-foreground" aria-hidden />
          ) : (
            <Play className="size-3.5 fill-primary-foreground text-primary-foreground" aria-hidden />
          )}
        </button>
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-border" aria-hidden="true">
          <span className="block h-full rounded-full bg-primary" style={{ width: `${progress * 100}%` }} />
        </span>
      </div>
      {status === "error" ? (
        <p role="alert" className="text-sm text-bad">
          {labels.error}
        </p>
      ) : null}
      <p lang={lang} className="max-w-[300px] rounded-2xl rounded-bl-sm bg-card px-3 py-2.5 text-[15px] leading-relaxed">
        {text}
      </p>
    </div>
  );
}

function PhoneInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-13 place-items-center rounded-2xl border-[1.5px] bg-card px-3.5 text-lg">+91</span>
      <Input
        id={id}
        aria-label={label}
        inputMode="numeric"
        autoComplete="tel-national"
        className="h-13 rounded-2xl bg-card text-lg"
        placeholder="98765 43210"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
