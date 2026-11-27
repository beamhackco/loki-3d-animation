"use client";

import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { useEffect, useRef, type MouseEvent } from "react";
import { onPlayhead, pixelsAt, prefersReducedMotion, RIVAL_START, scroll, TRACK, WAYPOINTS, windowed, type Waypoint } from "@/lib/scrollFilm";
import { useSceneStore } from "@/store/sceneStore";
import { TitleMark } from "./TitleMark";

gsap.registerPlugin(ScrollToPlugin);

/** Track position where something starts and ends, and the length of each ramp. */
type Showing = [from: number, to: number, rampIn: number, rampOut: number];

const HERO_WINDOW: Showing = [-1, 0.85, 0, 0.45];
/** His name, once his eyes have lit, held to the end of the track. */
const NAME_WINDOW: Showing = [RIVAL_START + 2.7, TRACK + 1, 0.55, 0];

/** The trip in progress, if any: a new click while it runs keeps the film moving. */
let travel: gsap.core.Tween | null = null;

function travelTo(e: MouseEvent, w: Waypoint) {
  e.preventDefault();
  const distance = Math.abs(w.at - scroll.target);
  const moving = travel?.isActive() ?? false;
  travel = gsap.to(window, {
    scrollTo: { y: pixelsAt(w.at), autoKill: true },
    duration: prefersReducedMotion() ? 0 : Math.min(4.2, 0.9 + distance * 0.5),
    // From rest the film eases in; replacing a trip in progress it leaves at speed.
    ease: moving ? "power2.out" : "sine.inOut",
    overwrite: true,
  });
}

/** Words and waypoints in one fixed layer. Everything here is drawn off the playhead. */
export function WebsiteUI() {
  const live = useSceneStore((s) => s.live);
  const hero = useRef<HTMLDivElement>(null);
  const name = useRef<HTMLHeadingElement>(null);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const fill = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    let still = query.matches;
    const onChange = () => {
      still = query.matches;
    };
    query.addEventListener("change", onChange);
    const place = (el: HTMLElement | null, t: number, [from, to, rampIn, rampOut]: Showing) => {
      if (!el) return;
      const o = windowed(t, from, to, rampIn, rampOut);
      el.style.opacity = o.toFixed(3);
      // Reduced motion keeps the fade and drops the drift, even if it changes mid-visit.
      if (still) {
        el.style.transform = "";
        return;
      }
      // A few pixels of drift, so the words sit in the air and not on the glass.
      const k = Math.min(1, Math.max(0, (t - from) / (Math.min(to, TRACK) - from)));
      el.style.transform = `translate3d(0, ${((0.5 - k) * 3).toFixed(2)}vh, 0)`;
    };
    let active = -1;
    const stop = onPlayhead((t) => {
      place(hero.current, t, HERO_WINDOW);
      place(name.current, t, NAME_WINDOW);
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
    return () => {
      stop();
      query.removeEventListener("change", onChange);
    };
  }, []);

  return (
    <div className={`pointer-events-none fixed inset-0 z-10 transition-opacity duration-1000 ease-out ${live ? "opacity-100" : "opacity-0"}`}>
      {/* Phones set the title and the name over the lower third, so only that third is darkened. */}
      <div className="absolute inset-x-0 bottom-0 h-[46svh] bg-gradient-to-t from-abyss/80 via-abyss/55 to-transparent sm:hidden" aria-hidden="true" />

      {/* Centred over the lower edge of the frame, where the rival's name lands at the end. */}
      <div ref={hero} className="absolute inset-x-0 bottom-[5.25rem] flex justify-center sm:bottom-24">
        <TitleMark live={live} />
      </div>

      {/* Phones break the name over two lines; wider screens hold it on one. */}
      <h2 ref={name} style={{ opacity: 0 }} className="doom-name absolute inset-x-0 bottom-[5.25rem] text-center sm:bottom-24">
        <span className="doom-name__mark">
          <span className="doom-name__word">Victor Von</span> <span className="doom-name__word">Doom</span>
        </span>
      </h2>

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
