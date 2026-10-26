import "server-only";

/** Serper's Google Images search. Free key from serper.dev, in SERPERAPI_KEY. */
const SERPER_IMAGES = "https://google.serper.dev/images";
/** A slow search must never hold up reading a prescription. */
const TIMEOUT_MS = 5000;

export type SamplePhoto = { url: string; source: string };

type SerperImage = { imageUrl?: string; domain?: string; link?: string };

/** The first result WhatsApp and the browser can load (https), with the site it came from for the credit. */
export function pickSample(images: SerperImage[]): SamplePhoto | null {
  for (const img of images) {
    if (!img.imageUrl?.startsWith("https://")) continue;
    const source = img.domain || hostOf(img.link) || hostOf(img.imageUrl);
    if (source) return { url: img.imageUrl, source: source.replace(/^www\./, "") };
  }
  return null;
}

function hostOf(url: string | undefined): string | null {
  try {
    return url ? new URL(url).hostname : null;
  } catch {
    return null;
  }
}

/**
 * Looks up a sample photo of the medicine's strip on the web, e.g. "Telma 40 tablet strip".
 * Null when there is no key, no result, or the search fails: the medicine then shows its name only.
 */
export async function findSamplePhoto(name: string, strength: string): Promise<SamplePhoto | null> {
  const key = process.env.SERPERAPI_KEY;
  const q = `${name} ${strength}`.trim();
  if (!key || !q) return null;
  try {
    const res = await fetch(SERPER_IMAGES, {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q: `${q} tablet strip`, gl: "in", num: 10 }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`Sample photo search failed: HTTP ${res.status}`);
      return null;
    }
    const json = (await res.json()) as { images?: SerperImage[] };
    return pickSample(json.images ?? []);
  } catch (e) {
    console.error("Sample photo search failed", e);
    return null;
  }
}
