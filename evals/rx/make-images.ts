/**
 * Makes the made-up prescription and report photos for the reading eval, and writes the right
 * answer for each into gold.json from the same data, so nobody has to type the answers up.
 * Every name, clinic and doctor is invented. Run: node evals/rx/make-images.ts
 *
 * Images are drawn with ffmpeg (drawtext), in printed and handwriting-style fonts, some tilted,
 * blurred or noisy. They are still far cleaner than a real doctor's handwriting.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ffmpeg: string = createRequire(import.meta.url)("@ffmpeg-installer/ffmpeg").path;
const HERE = fileURLToPath(new URL(".", import.meta.url));
const OUT = join(HERE, "images");

const SUP = "/System/Library/Fonts/Supplemental/";
const FONTS = {
  arial: SUP + "Arial.ttf",
  arialBold: SUP + "Arial Bold.ttf",
  narrow: SUP + "Arial Narrow.ttf",
  times: SUP + "Times New Roman.ttf",
  courier: SUP + "Courier New.ttf",
  bradley: SUP + "Bradley Hand Bold.ttf",
  chalk: SUP + "Chalkboard.ttc",
  noteworthy: "/System/Library/Fonts/Noteworthy.ttc",
  devanagari: SUP + "DevanagariMT.ttc",
};
type Font = keyof typeof FONTS;

type Meal = "b" | "l" | "d";
type GoldMed = {
  name: string;
  strength: string;
  quantity: string;
  meals: Meal[];
  food: "before" | "after" | "any";
  asNeeded: boolean;
  days: number | null;
  purposeWritten: string | null;
};
type GoldValue = { test: string; value: number; low: number | null; high: number | null; flag: "high" | "low" | "in_range" | "unknown" };
export type Gold =
  | { id: string; file: string; about: string; type: "prescription"; hard?: boolean; dateIso: string; medicines: GoldMed[]; followUp: { afterDays: number } | { date: string; time: string | null } | null }
  | { id: string; file: string; about: string; type: "lab_report"; values: GoldValue[] }
  | { id: string; file: string; about: string; type: "other" | "unreadable" };

/** shrink: scales the photo down to this fraction and back up, like a low-resolution phone photo. */
type Look = { font: Font; size?: number; ink?: string; rotate?: number; blur?: number; noise?: number; quality?: number; shrink?: number };

/** One medicine line as written, and what it means. */
type Line = { text: string; extra?: { text: string; font: Font }; gold: Partial<GoldMed> & Pick<GoldMed, "name" | "strength" | "meals"> };

const med = (g: Line["gold"]): GoldMed => ({ quantity: "1 tablet", food: "any", asNeeded: false, days: null, purposeWritten: null, ...g });

type RxSpec = { id: string; about: string; hard?: boolean; look: Look; lines: Line[]; footer?: string; followUp?: Extract<Gold, { type: "prescription" }>["followUp"] };

const DATE = "22/10/2026";
const DATE_ISO = "2026-10-22";

const RX: RxSpec[] = [
  {
    id: "P01",
    about: "printed, plain words",
    look: { font: "arial" },
    lines: [
      { text: "1. Tab. Amlodipine 5 mg      1 tab   Morning           After food", gold: { name: "Amlodipine", strength: "5 mg", meals: ["b"], food: "after" } },
      { text: "2. Tab. Metformin 500 mg     1 tab   Morning & Night   After food", gold: { name: "Metformin", strength: "500 mg", meals: ["b", "d"], food: "after" } },
      { text: "3. Tab. Atorvastatin 10 mg   1 tab   Night             After food", gold: { name: "Atorvastatin", strength: "10 mg", meals: ["d"], food: "after" } },
    ],
  },
  {
    id: "P02",
    about: "printed, 1-0-1 with AC / PC",
    look: { font: "times", size: 40 },
    lines: [
      { text: "1. Tab. Pantoprazole 40 mg     1-0-0   AC", gold: { name: "Pantoprazole", strength: "40 mg", meals: ["b"], food: "before" } },
      { text: "2. Tab. Telmisartan 40 mg      1-0-0   PC", gold: { name: "Telmisartan", strength: "40 mg", meals: ["b"], food: "after" } },
      { text: "3. Tab. Glimepiride 1 mg       1-0-1   AC", gold: { name: "Glimepiride", strength: "1 mg", meals: ["b", "d"], food: "before" } },
    ],
  },
  {
    id: "P03",
    about: "printed, BD / TDS / OD",
    look: { font: "courier", size: 34 },
    lines: [
      { text: "1. Tab. Metformin 500 mg      BD after meals", gold: { name: "Metformin", strength: "500 mg", meals: ["b", "d"], food: "after" } },
      { text: "2. Cap. Amoxicillin 500 mg    TDS x 5 days", gold: { name: "Amoxicillin", strength: "500 mg", quantity: "1 capsule", meals: ["b", "l", "d"], days: 5 } },
      { text: "3. Tab. Rosuvastatin 10 mg    OD at night", gold: { name: "Rosuvastatin", strength: "10 mg", meals: ["d"] } },
      { text: "4. Tab. Levothyroxine 50 mcg  OD morning, empty stomach", gold: { name: "Levothyroxine", strength: "50 mcg", meals: ["b"], food: "before" } },
    ],
  },
  {
    id: "P04",
    about: "printed, course lengths",
    look: { font: "arial", size: 36 },
    lines: [
      { text: "1. Tab. Azithromycin 500 mg   1-0-0   after food    x 3 days", gold: { name: "Azithromycin", strength: "500 mg", meals: ["b"], food: "after", days: 3 } },
      { text: "2. Tab. Pantoprazole 40 mg    1-0-0   before food   x 7 days", gold: { name: "Pantoprazole", strength: "40 mg", meals: ["b"], food: "before", days: 7 } },
      { text: "3. Tab. Cetirizine 10 mg      0-0-1                 x 5 days", gold: { name: "Cetirizine", strength: "10 mg", meals: ["d"], days: 5 } },
    ],
  },
  {
    id: "P05",
    about: "printed, 1 week and continue",
    look: { font: "arial", size: 36 },
    lines: [
      { text: "1. Tab. Amlodipine 5 mg      1-0-0   after food   - continue", gold: { name: "Amlodipine", strength: "5 mg", meals: ["b"], food: "after" } },
      { text: "2. Tab. Doxycycline 100 mg   1-0-1   after food   x 1 week", gold: { name: "Doxycycline", strength: "100 mg", meals: ["b", "d"], food: "after", days: 7 } },
      { text: "3. Tab. Metformin 500 mg     1-0-1   after food   - continue", gold: { name: "Metformin", strength: "500 mg", meals: ["b", "d"], food: "after" } },
    ],
  },
  {
    id: "P06",
    about: "printed, SOS and PRN",
    look: { font: "arial", size: 36 },
    lines: [
      { text: "1. Tab. Paracetamol 650 mg   1 tab SOS for fever", gold: { name: "Paracetamol", strength: "650 mg", meals: [], asNeeded: true, purposeWritten: "fever" } },
      { text: "2. Tab. Ondansetron 4 mg     1 tab PRN for vomiting", gold: { name: "Ondansetron", strength: "4 mg", meals: [], asNeeded: true, purposeWritten: "vomiting" } },
      { text: "3. Tab. Amlodipine 5 mg      1-0-0  after food", gold: { name: "Amlodipine", strength: "5 mg", meals: ["b"], food: "after" } },
    ],
  },
  {
    id: "P07",
    about: "printed, review after 2 weeks",
    look: { font: "arial" },
    lines: [
      { text: "1. Tab. Telmisartan 40 mg    1-0-0   after food", gold: { name: "Telmisartan", strength: "40 mg", meals: ["b"], food: "after" } },
      { text: "2. Tab. Atorvastatin 20 mg   0-0-1   after food", gold: { name: "Atorvastatin", strength: "20 mg", meals: ["d"], food: "after" } },
    ],
    footer: "Review after 2 weeks.",
    followUp: { afterDays: 14 },
  },
  {
    id: "P08",
    about: "printed, next visit date dd/mm",
    look: { font: "times", size: 40 },
    lines: [
      { text: "1. Tab. Glimepiride 2 mg     1-0-0   before breakfast", gold: { name: "Glimepiride", strength: "2 mg", meals: ["b"], food: "before" } },
      { text: "2. Tab. Metformin 1000 mg    0-0-1   after dinner", gold: { name: "Metformin", strength: "1000 mg", meals: ["d"], food: "after" } },
    ],
    footer: "Next visit: 12/11/2026 at 11 am",
    followUp: { date: "2026-11-12", time: "11:00" },
  },
  {
    id: "P09",
    about: "handwriting font",
    look: { font: "bradley", size: 44, ink: "0x1b2a6b" },
    lines: [
      { text: "Tab Amlodipine 5mg   1-0-0   after food", gold: { name: "Amlodipine", strength: "5 mg", meals: ["b"], food: "after" } },
      { text: "Tab Metoprolol 25mg   1-0-1   after food", gold: { name: "Metoprolol", strength: "25 mg", meals: ["b", "d"], food: "after" } },
      { text: "Tab Ecosprin 75mg   0-1-0   after lunch", gold: { name: "Ecosprin", strength: "75 mg", meals: ["l"], food: "after" } },
      { text: "Tab Atorva 10mg   0-0-1", gold: { name: "Atorva", strength: "10 mg", meals: ["d"] } },
    ],
  },
  {
    id: "P10",
    about: "handwriting font, tilted 4 degrees",
    look: { font: "chalk", size: 40, ink: "0x1b2a6b", rotate: 4 },
    lines: [
      { text: "Tab Thyronorm 50 mcg   1-0-0   empty stomach", gold: { name: "Thyronorm", strength: "50 mcg", meals: ["b"], food: "before" } },
      { text: "Tab Glycomet 500   1-0-1   after food", gold: { name: "Glycomet", strength: "500", meals: ["b", "d"], food: "after" } },
      { text: "Tab Telma 40   1-0-0", gold: { name: "Telma", strength: "40", meals: ["b"] } },
    ],
  },
  {
    id: "P11",
    about: "handwriting font, blurred, noisy, tilted",
    look: { font: "bradley", size: 42, ink: "0x24306e", rotate: -3, blur: 1.6, noise: 18, quality: 12 },
    lines: [
      { text: "Tab Amlodipine 10mg   1-0-0   after food", gold: { name: "Amlodipine", strength: "10 mg", meals: ["b"], food: "after" } },
      { text: "Tab Metformin 500mg   1-0-1   after food", gold: { name: "Metformin", strength: "500 mg", meals: ["b", "d"], food: "after" } },
      { text: "Tab Clopidogrel 75mg   0-1-0   after food", gold: { name: "Clopidogrel", strength: "75 mg", meals: ["l"], food: "after" } },
      { text: "Tab Rosuvastatin 5mg   0-0-1", gold: { name: "Rosuvastatin", strength: "5 mg", meals: ["d"] } },
    ],
  },
  {
    id: "P12",
    about: "printed, instructions in Hindi",
    look: { font: "arial", size: 38 },
    lines: [
      { text: "1. Tab. Amlodipine 5 mg", extra: { text: "सुबह 1 गोली, खाने के बाद", font: "devanagari" }, gold: { name: "Amlodipine", strength: "5 mg", meals: ["b"], food: "after" } },
      { text: "2. Tab. Metformin 500 mg", extra: { text: "सुबह और रात 1 गोली, खाने के बाद", font: "devanagari" }, gold: { name: "Metformin", strength: "500 mg", meals: ["b", "d"], food: "after" } },
      { text: "3. Tab. Pantoprazole 40 mg", extra: { text: "सुबह 1 गोली, खाली पेट", font: "devanagari" }, gold: { name: "Pantoprazole", strength: "40 mg", meals: ["b"], food: "before" } },
    ],
  },
  {
    id: "P13",
    about: "printed, Indian brand names",
    look: { font: "narrow", size: 40 },
    lines: [
      { text: "1. Tab. Telma-H 40        1-0-0   after breakfast", gold: { name: "Telma-H", strength: "40", meals: ["b"], food: "after" } },
      { text: "2. Tab. Glycomet GP 1     1-0-1   before food", gold: { name: "Glycomet GP", strength: "1", meals: ["b", "d"], food: "before" } },
      { text: "3. Cap. Ecosprin AV 75    0-0-1   after dinner", gold: { name: "Ecosprin AV", strength: "75", quantity: "1 capsule", meals: ["d"], food: "after" } },
      { text: "4. Tab. Pan 40            1-0-0   before breakfast", gold: { name: "Pan", strength: "40", meals: ["b"], food: "before" } },
    ],
  },
  {
    id: "P14",
    about: "printed, half tablets",
    look: { font: "arial", size: 36 },
    lines: [
      { text: "1. Tab. Metoprolol 50 mg    1/2-0-1/2   after food", gold: { name: "Metoprolol", strength: "50 mg", quantity: "half tablet", meals: ["b", "d"], food: "after" } },
      { text: "2. Tab. Losartan 25 mg      1-0-0       after food", gold: { name: "Losartan", strength: "25 mg", meals: ["b"], food: "after" } },
      { text: "3. Tab. Furosemide 40 mg    1-0-0       before breakfast", gold: { name: "Furosemide", strength: "40 mg", meals: ["b"], food: "before" } },
    ],
  },
  {
    id: "P15",
    about: "printed, HS and bedtime, decimal strength",
    look: { font: "times", size: 40 },
    lines: [
      { text: "1. Tab. Atorvastatin 10 mg    1 HS", gold: { name: "Atorvastatin", strength: "10 mg", meals: ["d"] } },
      { text: "2. Tab. Clonazepam 0.25 mg    1 at bedtime", gold: { name: "Clonazepam", strength: "0.25 mg", meals: ["d"] } },
      { text: "3. Tab. Amlodipine 2.5 mg     1-0-0   after food", gold: { name: "Amlodipine", strength: "2.5 mg", meals: ["b"], food: "after" } },
    ],
  },
  {
    id: "P16",
    about: "printed, course + SOS + continue + review after 10 days",
    look: { font: "times", size: 38 },
    lines: [
      { text: "1. Tab. Cefuroxime 500 mg    1-0-1   after food   x 5 days", gold: { name: "Cefuroxime", strength: "500 mg", meals: ["b", "d"], food: "after", days: 5 } },
      { text: "2. Tab. Paracetamol 500 mg   1 tab SOS if pain", gold: { name: "Paracetamol", strength: "500 mg", meals: [], asNeeded: true, purposeWritten: "pain" } },
      { text: "3. Tab. Telmisartan 40 mg    1-0-0   after food   continue", gold: { name: "Telmisartan", strength: "40 mg", meals: ["b"], food: "after" } },
    ],
    footer: "Review after 10 days.",
    followUp: { afterDays: 10 },
  },
  {
    id: "P17",
    about: "handwriting font, grey ink, tilted 8 degrees, five lines",
    look: { font: "noteworthy", size: 38, ink: "0x6b6b80", rotate: -8, noise: 10, quality: 8 },
    lines: [
      { text: "Tab Amlodipine 5mg  1-0-0  after food", gold: { name: "Amlodipine", strength: "5 mg", meals: ["b"], food: "after" } },
      { text: "Tab Metformin 500mg  1-0-1  after food", gold: { name: "Metformin", strength: "500 mg", meals: ["b", "d"], food: "after" } },
      { text: "Tab Atorvastatin 10mg  0-0-1", gold: { name: "Atorvastatin", strength: "10 mg", meals: ["d"] } },
      { text: "Tab Pantoprazole 40mg  1-0-0  before food", gold: { name: "Pantoprazole", strength: "40 mg", meals: ["b"], food: "before" } },
      { text: "Tab Methylcobalamin 1500mcg  0-1-0  after lunch", gold: { name: "Methylcobalamin", strength: "1500 mcg", meals: ["l"], food: "after" } },
    ],
  },
  {
    id: "P18",
    about: "printed, purpose written",
    look: { font: "arial", size: 36 },
    lines: [
      { text: "1. Tab. Amlodipine 5 mg     1-0-0   after food   (for BP)", gold: { name: "Amlodipine", strength: "5 mg", meals: ["b"], food: "after", purposeWritten: "BP" } },
      { text: "2. Tab. Metformin 500 mg    1-0-1   after food   (for sugar)", gold: { name: "Metformin", strength: "500 mg", meals: ["b", "d"], food: "after", purposeWritten: "sugar" } },
      { text: "3. Tab. Pantoprazole 40 mg  1-0-0   before food  (for acidity)", gold: { name: "Pantoprazole", strength: "40 mg", meals: ["b"], food: "before", purposeWritten: "acidity" } },
    ],
  },
];

type LabSpec = { id: string; about: string; look: Look; rows: { test: string; value: number; unit: string; range: string | null; low: number | null; high: number | null }[] };

const LABS: LabSpec[] = [
  {
    id: "L01",
    about: "printed lab report, ranges a - b",
    look: { font: "arial", size: 32 },
    rows: [
      { test: "Haemoglobin", value: 11.2, unit: "g/dL", range: "12.0 - 15.0", low: 12, high: 15 },
      { test: "Fasting Blood Sugar", value: 132, unit: "mg/dL", range: "70 - 110", low: 70, high: 110 },
      { test: "Serum Creatinine", value: 0.9, unit: "mg/dL", range: "0.6 - 1.2", low: 0.6, high: 1.2 },
      { test: "HbA1c", value: 7.4, unit: "%", range: "4.0 - 5.6", low: 4, high: 5.6 },
    ],
  },
  {
    id: "L02",
    about: "printed lab report, values without a range and '< 200'",
    look: { font: "courier", size: 30 },
    rows: [
      { test: "TSH", value: 3.1, unit: "uIU/mL", range: "0.4 - 4.0", low: 0.4, high: 4 },
      { test: "Vitamin D (25-OH)", value: 18, unit: "ng/mL", range: null, low: null, high: null },
      { test: "Total Cholesterol", value: 220, unit: "mg/dL", range: "< 200", low: null, high: 200 },
      { test: "ESR", value: 24, unit: "mm/hr", range: null, low: null, high: null },
    ],
  },
  {
    id: "L03",
    about: "lab report photo, tilted and blurred",
    look: { font: "arial", size: 32, rotate: 3, blur: 1.2, noise: 12, quality: 10 },
    rows: [
      { test: "Sodium", value: 132, unit: "mmol/L", range: "135 - 145", low: 135, high: 145 },
      { test: "Potassium", value: 4.2, unit: "mmol/L", range: "3.5 - 5.1", low: 3.5, high: 5.1 },
      { test: "Blood Urea", value: 48, unit: "mg/dL", range: "15 - 40", low: 15, high: 40 },
    ],
  },
];

const W = 1240;
const H = 1650;
const tmp = mkdtempSync(join(tmpdir(), "carenest-rx-"));
let fileNo = 0;

type Text = { text: string; x: number; y: number; font: Font; size: number; ink?: string };

/** Each line goes through a text file, so no characters need escaping in the filter. */
function drawFilters(texts: Text[], look: Look): string {
  const parts = texts.map((t) => {
    const f = join(tmp, `t${fileNo++}.txt`);
    writeFileSync(f, t.text);
    return `drawtext=fontfile='${FONTS[t.font]}':textfile='${f}':expansion=none:x=${t.x}:y=${t.y}:fontsize=${t.size}:fontcolor=${t.ink ?? look.ink ?? "0x111111"}`;
  });
  if (look.rotate) parts.push(`rotate=${(look.rotate * Math.PI) / 180}:fillcolor=0x8a8a8a`);
  if (look.blur) parts.push(`gblur=sigma=${look.blur}`);
  if (look.shrink) parts.push(`scale=iw*${look.shrink}:-1`, `scale=${W}:-1`);
  if (look.noise) parts.push(`noise=alls=${look.noise}:allf=t`);
  return parts.join(",\n");
}

function render(file: string, texts: Text[], look: Look) {
  const script = join(tmp, `f${fileNo++}.txt`);
  writeFileSync(script, drawFilters(texts, look));
  execFileSync(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", `color=c=0xf6f2e8:s=${W}x${H}`,
    "-filter_script:v", script,
    "-frames:v", "1", "-q:v", String(look.quality ?? 3),
    join(OUT, file),
  ]);
}

function header(look: Look): Text[] {
  const hand = ["bradley", "chalk", "noteworthy"].includes(look.font);
  return [
    { text: "SHANTI FAMILY CLINIC", x: 60, y: 50, font: "arialBold", size: 46, ink: "0x0b5d4b" },
    { text: "Dr. Meera Joglekar, MBBS, MD (Medicine)", x: 60, y: 115, font: "arial", size: 28, ink: "0x0b5d4b" },
    { text: "Plot 00, Imaginary Road, Pune  |  Reg. No. 00000", x: 60, y: 155, font: "arial", size: 24, ink: "0x0b5d4b" },
    { text: `Name: Sarala K.        Age/Sex: 88 / F        Date: ${DATE}`, x: 60, y: 240, font: hand ? look.font : "arial", size: hand ? 36 : 30 },
    { text: "Rx", x: 60, y: 320, font: "times", size: 64 },
  ];
}

function rxTexts(s: RxSpec): Text[] {
  const size = s.look.size ?? 38;
  const step = Math.round(size * 2.4);
  const out = header(s.look);
  let y = 420;
  for (const l of s.lines) {
    out.push({ text: l.text, x: 80, y, font: s.look.font, size });
    if (l.extra) {
      y += Math.round(size * 1.3);
      out.push({ text: `    ${l.extra.text}`, x: 120, y, font: l.extra.font, size });
    }
    y += step;
  }
  if (s.footer) out.push({ text: s.footer, x: 80, y: y + 40, font: s.look.font, size });
  out.push({ text: "Dr. M. Joglekar", x: 820, y: 1480, font: "bradley", size: 40, ink: "0x1b2a6b" });
  return out;
}

function labTexts(s: LabSpec): Text[] {
  const size = s.look.size ?? 32;
  const out: Text[] = [
    { text: "NORTHSTAR DIAGNOSTICS", x: 60, y: 50, font: "arialBold", size: 46, ink: "0x7a1f2b" },
    { text: "Imaginary Lane, Mumbai  |  Lab ID 0000", x: 60, y: 115, font: "arial", size: 26, ink: "0x7a1f2b" },
    { text: `Patient: Sarala K.     Age/Sex: 88 / F     Collected: ${DATE}`, x: 60, y: 200, font: "arial", size: 28 },
    { text: "TEST", x: 60, y: 300, font: "arialBold", size },
    { text: "RESULT", x: 560, y: 300, font: "arialBold", size },
    { text: "REFERENCE RANGE", x: 860, y: 300, font: "arialBold", size },
  ];
  let y = 380;
  for (const r of s.rows) {
    out.push({ text: r.test, x: 60, y, font: s.look.font, size });
    out.push({ text: `${r.value} ${r.unit}`, x: 560, y, font: s.look.font, size });
    if (r.range) out.push({ text: `${r.range} ${r.unit}`, x: 860, y, font: s.look.font, size });
    y += Math.round(size * 2.2);
  }
  out.push({ text: "-- End of report --", x: 460, y: y + 60, font: "arial", size: 26 });
  return out;
}

function flag(v: number, low: number | null, high: number | null): GoldValue["flag"] {
  if (low === null && high === null) return "unknown";
  if (high !== null && v > high) return "high";
  if (low !== null && v < low) return "low";
  return "in_range";
}

mkdirSync(OUT, { recursive: true });
const gold: Gold[] = [];

/**
 * The hard tier: the same slips, photographed badly (low resolution, blur, faint ink, tilt).
 * The clean set reads almost perfectly, so this is where reading errors, and whether the app
 * marks them "Please check", show up.
 */
const HARD: { id: string; from: string; look: Partial<Look> }[] = [
  { id: "H01", from: "P09", look: { shrink: 0.3, blur: 1.5, quality: 20 } },
  { id: "H02", from: "P10", look: { shrink: 0.28, blur: 2, noise: 25, quality: 24 } },
  { id: "H03", from: "P11", look: { shrink: 0.3, blur: 2.6, noise: 30, quality: 28 } },
  { id: "H04", from: "P13", look: { shrink: 0.25, blur: 1.8, ink: "0x8a8a96", quality: 26 } },
  { id: "H05", from: "P14", look: { shrink: 0.25, blur: 2.2, noise: 20, rotate: 6, quality: 26 } },
  { id: "H06", from: "P15", look: { shrink: 0.25, blur: 2.4, ink: "0x9a9aa6", quality: 28 } },
  { id: "H07", from: "P16", look: { shrink: 0.22, blur: 2, noise: 25, rotate: -5, quality: 30 } },
  { id: "H08", from: "P17", look: { shrink: 0.3, blur: 2.4, noise: 25, ink: "0x8f8fa0", quality: 28 } },
  { id: "H09", from: "P03", look: { shrink: 0.22, blur: 2.4, noise: 20, quality: 28 } },
  { id: "H10", from: "P02", look: { shrink: 0.22, blur: 2.6, ink: "0x8a8a96", quality: 30 } },
  { id: "H11", from: "P01", look: { shrink: 0.14, blur: 3, noise: 25, quality: 31 } },
  { id: "H12", from: "P09", look: { shrink: 0.14, blur: 3, noise: 25, quality: 31 } },
  { id: "H13", from: "P14", look: { shrink: 0.13, blur: 3.2, ink: "0x8a8a96", quality: 31 } },
  { id: "H14", from: "P17", look: { shrink: 0.15, blur: 3, noise: 30, quality: 31 } },
];
for (const h of HARD) {
  const base = RX.find((s) => s.id === h.from)!;
  RX.push({ ...base, id: h.id, about: `hard: ${base.about}, badly photographed`, look: { ...base.look, ...h.look }, hard: true } as RxSpec);
}

for (const s of RX) {
  const file = `${s.id}.jpg`;
  render(file, rxTexts(s), s.look);
  gold.push({ id: s.id, file, about: s.about, type: "prescription", hard: s.hard, dateIso: DATE_ISO, medicines: s.lines.map((l) => med(l.gold)), followUp: s.followUp ?? null });
}

for (const s of LABS) {
  const file = `${s.id}.jpg`;
  render(file, labTexts(s), s.look);
  gold.push({ id: s.id, file, about: s.about, type: "lab_report", values: s.rows.map((r) => ({ test: r.test, value: r.value, low: r.low, high: r.high, flag: flag(r.value, r.low, r.high) })) });
}

// A shopping receipt: not a medical document (PRD eval set row 8).
render(
  "R01.jpg",
  [
    { text: "GANESH SUPER BAZAAR", x: 300, y: 80, font: "courier", size: 44 },
    { text: "Imaginary Market, Pune", x: 380, y: 140, font: "courier", size: 28 },
    ...["Rice (5 kg)          450.00", "Toor dal (1 kg)      160.00", "Sugar (1 kg)          48.00", "Tea powder (500 g)   240.00", "Soap x 3              90.00", "--------------------------", "TOTAL                988.00", "Thank you, visit again"].map(
      (text, i) => ({ text, x: 260, y: 260 + i * 70, font: "courier" as Font, size: 36 }),
    ),
  ],
  { font: "courier" },
);
gold.push({ id: "R01", file: "R01.jpg", about: "shopping receipt", type: "other" });

// A prescription blurred past reading: the safe answer is "send a clearer photo".
const blurred = RX[0];
render("U01.jpg", rxTexts(blurred), { ...blurred.look, blur: 14, quality: 20 });
gold.push({ id: "U01", file: "U01.jpg", about: "prescription blurred past reading", type: "unreadable" });

writeFileSync(join(HERE, "gold.json"), JSON.stringify(gold, null, 2) + "\n");
console.log(`Wrote ${gold.length} images to ${OUT} and gold.json`);
