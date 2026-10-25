/**
 * Emergency words are caught in code before any AI call, so an emergency reply
 * never depends on a model. This is a best-effort keyword check: we never claim
 * the product detects emergencies.
 */
const EMERGENCY_PATTERNS: RegExp[] = [
  // English
  /\b(fell|fallen|fall down)\b(?!\s*asleep)/i,
  /\bchest\s*pain\b/i,
  /\b(can'?t|cannot|unable to|not able to)\s*breathe?\b/i,
  /\bbreathless(ness)?\b/i,
  /\b(unconscious|fainted|fainting|collapsed|stroke|heart attack|seizure)\b/i,
  /\b(heavy\s*)?bleeding\b/i,
  // Hindi (Devanagari). Not when a thing fell ("चश्मा गिर गया", "गोली नीचे गिर गई").
  /(?<!(?:चश्मा|चश्मे|फ़ोन|फोन|मोबाइल|गोली|दवा|दवाई|पर्चा|बोतल|चाबी|गिलास)\s+(?:(?:नीचे|ज़मीन पर|जमीन पर)\s+)?)गिर\s*(गई|गया|गये|गए|पड़ी|पड़ा)/,
  /(सीने|छाती)\s*में\s*दर्द/,
  /सांस\s*(नहीं|लेने में)/,
  /साँस\s*(नहीं|लेने में)/,
  /बेहोश/,
  /खून\s*(बह|निकल)/,
  // Hindi (romanised)
  /(?<!\b(?:chashma|chasma|phone|mobile|goli|dawa|dawai|bottle|chabi)\s+(?:(?:niche|neeche)\s+)?)\bgir\s*(gayi|gaya|gai|gya|padi|pada)\b/i,
  /\b(seene|chhati|chati)\s*(me|mein|main)\s*dard\b/i,
  /\b(saans|sans)\s*(nahi|nahin|lene)\b/i,
  /\bbehosh\b/i,
  // Marathi. Not "आजारी पडले" (fell ill), "बाहेर पडले" (went out) or "कमी पडले" (fell short).
  /(?<!(?:आजारी|बाहेर|कमी)\s*)पडल(े|ो|ी)/,
  /छातीत\s*दुख/,
  /श्वास\s*(घेता|लागत)/,
  /बेशुद्ध/,
];

export function isEmergency(text: string): boolean {
  return EMERGENCY_PATTERNS.some((re) => re.test(text));
}

/** Digits only, with India's country code added for 10-digit numbers. */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

/** Short code that links a parent's WhatsApp to a family, e.g. "CN-4821". */
export function makeLinkCode(): string {
  return `CN-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function findLinkCode(text: string): string | null {
  const m = text.toUpperCase().match(/\bCN-\d{4}\b/);
  return m ? m[0] : null;
}
