/**
 * Small line drawings for the landing page, setup and empty states. Decorative only: the text
 * next to each says the same thing. Colours come from the theme, so they follow dark mode.
 */

const INK = "stroke-foreground";
const SUN = "#f2b84b";
const HEART = "#e0715f";

function Heart({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 8c0-5 7-6 8-1 1-5 8-4 8 1 0 6-8 10-8 10S0 14 0 8Z" fill={HEART} />;
}

/** Landing: a phone with a prescription photo and a reply by meal, between two tablets. */
export function HeroIllo() {
  return (
    <svg viewBox="0 0 350 196" className="h-full w-full max-w-[350px]" fill="none" aria-hidden="true">
      <circle cx="292" cy="40" r="58" className="fill-primary/10" />
      <circle cx="40" cy="176" r="46" className="fill-primary/10" />
      <rect x="118" y="22" width="114" height="196" rx="20" className={`fill-card ${INK}`} strokeWidth="2.5" />
      <rect x="158" y="30" width="34" height="6" rx="3" className="fill-foreground" />
      <rect x="160" y="50" width="62" height="44" rx="10" className="fill-primary" />
      <rect x="168" y="58" width="30" height="4" rx="2" className="fill-card" />
      <rect x="168" y="66" width="44" height="4" rx="2" className="fill-card" opacity=".7" />
      <rect x="168" y="74" width="38" height="4" rx="2" className="fill-card" opacity=".7" />
      <rect x="168" y="82" width="24" height="4" rx="2" className="fill-card" opacity=".7" />
      <rect x="128" y="104" width="78" height="52" rx="10" className="fill-background" />
      <rect x="136" y="113" width="40" height="4" rx="2" className="fill-muted-foreground" />
      <rect x="136" y="123" width="58" height="4" rx="2" className="fill-foreground" />
      <rect x="136" y="133" width="50" height="4" rx="2" className="fill-foreground" />
      <rect x="136" y="143" width="34" height="4" rx="2" className="fill-foreground" />
      <g transform="rotate(-28 66 70)">
        <rect x="40" y="58" width="56" height="24" rx="12" className={`fill-card ${INK}`} strokeWidth="2.5" />
        <path d="M68 58v24" className={INK} strokeWidth="2.5" />
        <path d="M70 58h14a12 12 0 0 1 0 24H70Z" fill={SUN} />
      </g>
      <g transform="rotate(18 286 128)">
        <rect x="262" y="116" width="48" height="22" rx="11" className={`fill-card ${INK}`} strokeWidth="2.5" />
        <path d="M286 116v22" className={INK} strokeWidth="2.5" />
        <path d="M262 127a11 11 0 0 1 11-11h13v22h-13a11 11 0 0 1-11-11Z" className="fill-primary" />
      </g>
      <Heart x={262} y={56} s={1.4} />
    </svg>
  );
}

/** Setup, your name: a parent and a child. */
export function FamilyIllo() {
  return (
    <svg viewBox="0 0 200 120" className="h-full" fill="none" aria-hidden="true">
      <circle cx="72" cy="40" r="18" className={`fill-card ${INK}`} strokeWidth="2.5" />
      <path d="M42 110c0-22 13-38 30-38s30 16 30 38" className={`fill-primary ${INK}`} strokeWidth="2.5" />
      <path d="M58 30c4-10 24-10 28 0" className={INK} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="66" cy="42" r="1.8" className="fill-foreground" />
      <circle cx="78" cy="42" r="1.8" className="fill-foreground" />
      <path d="M68 49c2 2 6 2 8 0" className={INK} strokeWidth="2" strokeLinecap="round" />
      <circle cx="134" cy="52" r="14" className={`fill-card ${INK}`} strokeWidth="2.5" />
      <path d="M112 110c0-18 10-30 22-30s22 12 22 30" fill={SUN} className={INK} strokeWidth="2.5" />
      <circle cx="129" cy="53" r="1.6" className="fill-foreground" />
      <circle cx="139" cy="53" r="1.6" className="fill-foreground" />
      <path d="M130 59c2 1.6 5 1.6 7 0" className={INK} strokeWidth="2" strokeLinecap="round" />
      <Heart x={100} y={22} />
    </svg>
  );
}

/** Setup, the number: a phone with chat bubbles. */
export function PhoneIllo() {
  return (
    <svg viewBox="0 0 200 120" className="h-full" fill="none" aria-hidden="true">
      <rect x="70" y="8" width="60" height="104" rx="13" className={`fill-card ${INK}`} strokeWidth="2.5" />
      <rect x="88" y="14" width="24" height="5" rx="2.5" className="fill-foreground" />
      <rect x="78" y="34" width="38" height="16" rx="7" className="fill-primary" />
      <rect x="84" y="56" width="38" height="16" rx="7" className={`fill-background ${INK}`} strokeWidth="1.5" />
      <path d="M140 38c10 6 10 26 0 32M150 30c16 10 16 38 0 48" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Setup, meal times: a clock beside a plate. */
export function ClockIllo() {
  return (
    <svg viewBox="0 0 200 120" className="h-full" fill="none" aria-hidden="true">
      <circle cx="78" cy="60" r="40" className={`fill-card ${INK}`} strokeWidth="2.5" />
      <path d="M78 36v24l16 10" className="stroke-primary" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="148" cy="82" rx="32" ry="10" className={`fill-card ${INK}`} strokeWidth="2.5" />
      <path d="M128 78c6-14 34-14 40 0" fill={SUN} className={INK} strokeWidth="2.5" />
    </svg>
  );
}

/** Prescription photo: a page and a camera. */
export function RxIllo() {
  return (
    <svg viewBox="0 0 200 120" className="h-full" fill="none" aria-hidden="true">
      <rect x="40" y="10" width="76" height="100" rx="6" className={`fill-card ${INK}`} strokeWidth="2.5" />
      <path d="M52 26h30" className={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M52 44h50M52 58h44M52 72h48" className="stroke-muted-foreground" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M84 92c6-4 12 4 20-2" className={INK} strokeWidth="2" strokeLinecap="round" />
      <rect x="112" y="52" width="58" height="42" rx="9" className={`fill-primary ${INK}`} strokeWidth="2.5" />
      <circle cx="141" cy="73" r="11" className={`fill-card ${INK}`} strokeWidth="2.5" />
      <rect x="128" y="44" width="18" height="10" rx="3" className={`fill-primary ${INK}`} strokeWidth="2.5" />
    </svg>
  );
}

/** Sending the link: a message going from one phone to the other. */
export function SendIllo() {
  return (
    <svg viewBox="0 0 260 120" className="h-full" fill="none" aria-hidden="true">
      <rect x="14" y="16" width="56" height="92" rx="12" className={`fill-card ${INK}`} strokeWidth="2.5" />
      <rect x="24" y="40" width="36" height="16" rx="6" className="fill-primary" />
      <rect x="190" y="16" width="56" height="92" rx="12" className={`fill-card ${INK}`} strokeWidth="2.5" />
      <rect x="200" y="56" width="36" height="16" rx="6" className={`fill-background ${INK}`} strokeWidth="1.5" />
      <path d="M78 58c30-30 74-30 104 0" className="stroke-primary" strokeWidth="2.5" strokeDasharray="5 6" strokeLinecap="round" />
      <g transform="translate(116 22)">
        <path d="M0 14 28 2l-8 28-6-11Z" className={`fill-card ${INK}`} strokeWidth="2.2" strokeLinejoin="round" />
        <path d="m14 19 6-9" className={INK} strokeWidth="2" />
      </g>
      <Heart x={210} y={22} />
    </svg>
  );
}

/** Connected: two phones joined by a tick. */
export function JoinedIllo() {
  return (
    <svg viewBox="0 0 260 190" className="h-full" fill="none" aria-hidden="true">
      <circle cx="130" cy="95" r="78" className="fill-primary/10" />
      <rect x="40" y="40" width="60" height="104" rx="13" className={`fill-card ${INK}`} strokeWidth="2.5" />
      <rect x="160" y="40" width="60" height="104" rx="13" className={`fill-card ${INK}`} strokeWidth="2.5" />
      <path d="M100 92h60" className="stroke-primary" strokeWidth="3" strokeLinecap="round" />
      <g className="origin-[130px_92px] animate-[pop_0.5s_ease-out_both] motion-reduce:animate-none">
        <circle cx="130" cy="92" r="26" className="fill-primary" />
        <path d="m118 92 8 8 16-16" className="stroke-card" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <rect x="50" y="62" width="40" height="8" rx="4" className="fill-brand-soft" />
      <rect x="50" y="76" width="30" height="8" rx="4" className="fill-brand-soft" />
      <rect x="170" y="62" width="40" height="8" rx="4" className="fill-background" />
      <rect x="170" y="76" width="34" height="8" rx="4" className="fill-background" />
      <Heart x={58} y={14} />
      <Heart x={188} y={150} s={0.8} />
    </svg>
  );
}

/** CareNest's mark: a house with a heart. */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="8" className="fill-primary" />
      <path d="M7 14.5 14 8.5l7 6V21a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-6.5Z" className="stroke-primary-foreground" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 19.2s-2.6-1.5-2.6-3.3a1.4 1.4 0 0 1 2.6-.7 1.4 1.4 0 0 1 2.6.7c0 1.8-2.6 3.3-2.6 3.3Z" className="fill-primary-foreground" />
    </svg>
  );
}

/** The soft green panel the drawings sit on. */
export function IlloPanel({ children, className = "h-36" }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid shrink-0 place-items-center overflow-hidden rounded-3xl bg-brand-soft p-3 ${className}`}>{children}</div>;
}
