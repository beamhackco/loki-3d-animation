import { TitleMark } from "./TitleMark";

/** Shown when WebGL 2 is missing or the context is lost. */
export function StaticFallback() {
  return (
    <div className="still relative min-h-svh" role="img" aria-label="A two-horned figure in a long coat, seen from behind, gripping fans of black cable in both fists against green light.">
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-6 sm:p-10">
        <TitleMark live={false} />
        <p className="on-scene max-w-xs text-sm leading-snug text-mist">This is a still image. The moving scene needs WebGL 2, which isn&rsquo;t available in this browser.</p>
      </div>
    </div>
  );
}
