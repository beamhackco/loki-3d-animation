"use client";

import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { useEffect, useRef, type MouseEvent } from "react";
import { onPlayhead, pixelsAt, prefersReducedMotion, scroll, SHOT_END, TRACK, WAYPOINTS, windowed, type Waypoint } from "@/lib/scrollFilm";
import { useSceneStore } from "@/store/sceneStore";
import { TitleMark } from "./TitleMark";

gsap.registerPlugin(ScrollToPlugin);

interface Line {
  text: string;
  /** Track position where it starts and ends, and the length of each ramp. */
  window: [from: number, to: number, rampIn: number, rampOut: number];
  /** Corner or flank the line holds on wide screens; phones use the lower edge. */
  place: string;
}

/** One quote, spoken in pieces as the camera closes in and whole at the end. */
const QUOTE = "I know what kind of god I need to be.";
const SOURCE = "Loki, season 2 finale (2023)";

const LINES: readonly Line[] = [
  { text: "I know", window: [1.1, 2.0, 0.22, 0.22], place: "sm:bottom-28 sm:left-10" },
  { text: "what kind of god", window: [2.2, 3.25, 0.25, 0.25], place: "sm:left-auto sm:right-10 sm:bottom-auto sm:top-[30%] sm:text-right" },
  { text: "I need to be", window: [3.75, 4.85, 0.25, 0.25], place: "sm:bottom-16 sm:left-10" },
];

const HERO_WINDOW: Line["window"] = [-1, 0.85, 0, 0.45];
const QUOTE_WINDOW: Line["window"] = [SHOT_END + 2.1, TRACK + 1, 0.4, 0];

function travelTo(e: MouseEvent, w: Waypoint) {
  e.preventDefault();
  const distance = Math.abs(w.at - scroll.target);
  gsap.to(window, {
    scrollTo: { y: pixelsAt(w.at), autoKill: true },
    duration: prefersReducedMotion() ? 0 : Math.min(4.2, 0.9 + distance * 0.5),
    ease: "sine.inOut",
    overwrite: true,
  });
}

/** Words and waypoints in one fixed layer. Everything here is drawn off the playhead. */
export function WebsiteUI() {
  const live = useSceneStore((s) => s.live);
  const hero = useRef<HTMLDivElement>(null);
  const quote = useRef<HTMLElement>(null);
  const lines = useRef<(HTMLParagraphElement | null)[]>([]);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const fill = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const still = prefersReducedMotion();
    const place = (el: HTMLElement | null, t: number, [from, to, rampIn, rampOut]: Line["window"]) => {
      if (!el) return;
      const o = windowed(t, from, to, rampIn, rampOut);
      el.style.opacity = o.toFixed(3);
      if (still) return;
      // A few pixels of drift, so the words sit in the air and not on the glass.
      const k = Math.min(1, Math.max(0, (t - from) / (Math.min(to, TRACK) - from)));
      el.style.transform = `translate3d(0, ${((0.5 - k) * 3).toFixed(2)}vh, 0)`;
    };
    let active = -1;
    return onPlayhead((t) => {
      place(hero.current, t, HERO_WINDOW);
      place(quote.current, t, QUOTE_WINDOW);
      LINES.forEach((line, i) => place(lines.current[i], t, line.window));
      if (fill.current) fill.current.style.transform = `scaleX(${(t / TRACK).toFixed(4)})`;
      let now = 0;
      WAYPOINTS.forEach((w, i) => {
        if (t >= w.from) now = i;
      });
      if (now !== active) {
        active = now;
        links.current.forEach((a, i) => {
          if (i === now) a?.setAttribute("aria-current", "step");
          else a?.removeAttribute("aria-current");
        });
      }
    });
  }, []);

  return (
    <div className={`pointer-events-none fixed inset-0 z-10 transition-opacity duration-1000 ease-out ${live ? "opacity-100" : "opacity-0"}`}>
      {/* Phones set every line over the lower third, so only that third is darkened. */}
      <div className="absolute inset-x-0 bottom-0 h-[46svh] bg-gradient-to-t from-abyss/80 via-abyss/55 to-transparent sm:hidden" aria-hidden="true" />

      <div ref={hero} className="absolute bottom-28 left-6 sm:bottom-10 sm:left-10">
        <TitleMark live={live} />
      </div>

      {LINES.map((line, i) => (
        <p
          key={line.text}
          // The whole quote is read once, below.
          aria-hidden="true"
          ref={(el) => void (lines.current[i] = el)}
          style={{ opacity: 0 }}
          className={`line on-scene absolute bottom-28 left-6 text-[clamp(2rem,1.4rem+2.4vw,3.75rem)] leading-[1.1] ${line.place}`}
        >
          {line.text}
        </p>
      ))}

      <figure
        ref={quote}
        style={{ opacity: 0 }}
        className="line on-scene absolute bottom-28 left-6 max-w-[19rem] sm:inset-x-0 sm:bottom-10 sm:mx-auto sm:w-[min(40vh,24rem)] sm:max-w-none sm:text-center"
      >
        <blockquote className="text-[1.6rem] leading-[1.14] text-balance sm:text-[clamp(1.3rem,3.9vh,2.4rem)]">
          <p>&ldquo;{QUOTE}&rdquo;</p>
        </blockquote>
        <figcaption className="mt-3 text-[0.95rem] text-mist">{SOURCE}</figcaption>
      </figure>

      <nav aria-label="Scene" className="rail max-sm:before:hidden pointer-events-auto absolute inset-x-6 bottom-[max(1.25rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-10 sm:bottom-9 sm:w-[23rem]">
        <ol className="flex justify-between">
          {WAYPOINTS.map((w, i) => (
            <li key={w.id}>
              <a
                ref={(el) => void (links.current[i] = el)}
                href={`#${w.id}`}
                onClick={(e) => travelTo(e, w)}
                className="waypoint on-scene block rounded-sm py-3 text-[0.95rem] leading-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-mist"
              >
                {w.label}
              </a>
            </li>
          ))}
        </ol>
        <div className="h-px w-full overflow-hidden bg-mist/25" aria-hidden="true">
          <div ref={fill} className="h-full w-full origin-left bg-mist" style={{ transform: "scaleX(0)" }} />
        </div>
      </nav>
    </div>
  );
}
