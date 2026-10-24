import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Bricolage_Grotesque, IBM_Plex_Mono, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

// Atkinson Hyperlegible was designed for low-vision readers.
const body = Atkinson_Hyperlegible({ variable: "--font-body", subsets: ["latin"], weight: ["400", "700"] });
const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"], weight: ["500", "700"] });
const mono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });
const deva = Noto_Sans_Devanagari({ variable: "--font-deva", subsets: ["devanagari"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "CareNest",
  description: "Your parent's medicines on WhatsApp. You see everything here.",
};

// Runs before the page paints, so it never flashes the wrong theme: the saved choice, else the device's.
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}`;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme script changes the class before React loads, so React must not warn about it.
    <html lang="en" suppressHydrationWarning className={`${body.variable} ${display.variable} ${mono.variable} ${deva.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
