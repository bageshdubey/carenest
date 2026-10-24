"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * The 26-second "how it works" video on the landing page. Muted, looping and inline, as phones
 * only autoplay muted video. It can be paused, and starts paused for people who ask for less motion.
 * Made from design/carenest_video_source.html.
 */
export function HeroVideo({ label, pauseLabel, playLabel, className = "" }: { label: string; pauseLabel: string; playLabel: string; className?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) video.current?.pause();
  }, []);

  return (
    <div className={`relative aspect-square w-full overflow-hidden rounded-3xl bg-brand-soft ${className}`}>
      <video
        ref={video}
        src="/video/how-it-works.mp4"
        poster="/video/how-it-works-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={label}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="size-full object-cover"
      />
      <button
        type="button"
        aria-label={playing ? pauseLabel : playLabel}
        title={playing ? pauseLabel : playLabel}
        onClick={() => (playing ? video.current?.pause() : video.current?.play())}
        className="absolute right-3 bottom-3 grid size-10 place-items-center rounded-full bg-card/90 text-foreground shadow-sm hover:bg-card"
      >
        {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
      </button>
    </div>
  );
}
