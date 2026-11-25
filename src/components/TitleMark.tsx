/**
 * The title, drawn in artwork/loki-title.svg and baked to public/loki-title.webp
 * so its textures cost nothing while the page scrolls. `live` runs one pass of
 * light across the metal as the title appears.
 */
export function TitleMark({ live }: { live: boolean }) {
  return (
    <h1 className="relative w-[min(14.5rem,calc(100vw-3rem))] sm:w-[clamp(16rem,23vw,28rem)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/loki-title.webp" alt="Loki" width={1764} height={544} decoding="async" draggable={false} className="block h-auto w-full select-none" />
      <span aria-hidden="true" className="title-glint">
        <span className={live ? "title-glint__light is-live" : "title-glint__light"} />
      </span>
    </h1>
  );
}
