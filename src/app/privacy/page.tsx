import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/app/back-link";
import { LogoMark } from "@/components/app/illustrations";
import { ThemeToggle } from "@/components/app/theme-toggle";

export const metadata: Metadata = {
  title: "Privacy policy · CareNest",
  description: "What CareNest stores, who sees it, and how to have it deleted.",
};

const CONTACT = "bagesh.dubey1996@gmail.com";
const UPDATED = "24 October 2026";

/**
 * The public privacy policy. Google's sign-in setup links here. Every line must match what the
 * app really does: change this page whenever what is stored, or who processes it, changes.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pb-12">
      <header className="flex items-center justify-between py-4">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark />
          <span className="font-heading text-lg font-bold">CareNest</span>
        </Link>
        <ThemeToggle label="Light or dark mode" />
      </header>

      <article className="flex flex-col gap-6 text-[16px] leading-relaxed [&_h2]:mt-2 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
        <div className="flex flex-col gap-2">
          <BackLink href="/" label="Back" />
          <h1 className="text-3xl font-bold">Privacy policy</h1>
          <p className="text-sm text-muted-foreground">Last updated {UPDATED}</p>
        </div>

        <p>
          CareNest helps a son or daughter (&quot;you&quot;) set up WhatsApp medicine reminders for a parent. You use this website; your parent only uses WhatsApp. This page says what we store, why, who
          processes it, and how to have it deleted.
        </p>

        <section className="flex flex-col gap-3">
          <h2>CareNest analyses, it never advises</h2>
          <p>
            CareNest reads prescriptions and lab reports and compares results with the ranges printed on them. It does not give medical advice, a diagnosis or dose changes. Always follow the
            prescription and the doctor.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>What we store</h2>
          <ul>
            <li>About you: the name, email address and profile picture your Google account shares when you sign in, and your name as you enter it.</li>
            <li>About your parent: what you call them, their WhatsApp number, their language and meal times.</li>
            <li>Prescription and lab report photos or PDFs, and what is read from them: medicines, doses, meal times, test results and printed ranges.</li>
            <li>The medicine list you approve, and which reminders were marked taken.</li>
            <li>WhatsApp messages between your parent and CareNest, including what was heard in voice notes.</li>
            <li>Alerts shown on your dashboard, and doctor visit dates.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Why we use it</h2>
          <p>Only to run CareNest: to read the prescription, send meal reminders and replies to your parent, and show you their doses, reports and alerts. We do not sell it or use it for advertising.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Who sees it</h2>
          <ul>
            <li>You, when signed in. Each account sees only its own family.</li>
            <li>Your parent, on WhatsApp, sees the messages sent to them.</li>
            <li>The small CareNest team, only when needed to run or fix the service.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2>How it is protected</h2>
          <ul>
            <li>Everything travels over a secure (HTTPS) connection.</li>
            <li>The database and photos are stored encrypted, in Mumbai, India. Photos are in private storage, not on any public link.</li>
            <li>Access keys stay on our server, never in the app or in messages.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Services that process it for us</h2>
          <ul>
            <li>Supabase: database, sign-in and photo storage, in Mumbai, India.</li>
            <li>Vercel: hosts this website, in Mumbai, India.</li>
            <li>Google Gemini (paid API): reads photos and messages to find medicines, results and what was asked.</li>
            <li>Sarvam AI: turns replies into voice notes in your parent&apos;s language.</li>
            <li>Meta WhatsApp: carries messages to and from your parent.</li>
            <li>Google: lets you sign in with your Google account.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Deleting your data</h2>
          <p>
            Email{" "}
            <a href={`mailto:${CONTACT}`} className="font-bold text-primary underline">
              {CONTACT}
            </a>{" "}
            from the Google account you use for CareNest, and we will delete your account and everything stored for your family, photos included. Your parent can also ask by email. Messages already on
            your parent&apos;s phone stay in their WhatsApp.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2>Contact</h2>
          <p>
            Questions about this policy:{" "}
            <a href={`mailto:${CONTACT}`} className="font-bold text-primary underline">
              {CONTACT}
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
