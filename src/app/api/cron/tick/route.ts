import { timingSafeEqual } from "node:crypto";
import { tick } from "@/lib/bot/tick";

export const maxDuration = 60;

function authorised(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Called every 5 minutes by Supabase pg_cron. Sends due reminders and marks missed doses. */
export async function POST(request: Request) {
  if (!authorised(request.headers.get("authorization"))) return new Response("Unauthorised", { status: 401 });
  const result = await tick();
  return Response.json(result);
}
