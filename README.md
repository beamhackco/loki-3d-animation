# Loki

A personal fan piece. Loki, Doctor Doom and their logos belong to Marvel and Disney; the rival's artwork was supplied by the owner of this project. The title is a hand-drawn recreation of a title image supplied by the owner of this project.

A scroll-driven, real-time 3D scene built with Next.js, React Three Fiber and custom GLSL. Nothing in the scene is video or an imported model: the figure, the cables, the fog and the light are all procedural. The rival is sculpted the same way, with the supplied artwork (`public/rival-art.webp`) projected onto it from the front.

```
npm install
npm run dev      # http://localhost:3210
npm run preview  # production build in Cloudflare's local runtime, http://localhost:3212
```

## Deploy to Cloudflare Pages

The build is a static export: `npm run build` writes plain files to `out/`. There is no server code and no environment variables.

**From this computer.** The first run opens a browser to sign in to Cloudflare, and asks to create the project.

```
npx wrangler@4 login
npm run deploy
```

**From GitHub.** In the Cloudflare dashboard, create a Pages project from the repository with these settings:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `out` |
| Root directory | leave empty |

The Node version comes from `.node-version`. The project name is in `wrangler.toml`, caching is in `public/_headers`, and unknown addresses get `src/app/not-found.tsx`.

## How it matches the reference

- **Space.** Everything is authored in pixels of the reference's first frame and unprojected at a chosen depth (`src/lib/space.ts`), so it lands on the same pixel at shot time 0. The figure is traced separately, in pixels of the still reference image (`src/lib/characterGeometry.ts`).
- **Camera.** The dolly is a table measured from the footage, used directly as a GSAP ease (`src/hooks/useSceneAnimation.ts`). Scroll is the clock: one viewport of scroll is one second of the reference. `BRIEF.md` describes the scroll journey.
- **Color.** All fog and light pass through one ramp sampled from the still reference image (`ramp()` in `src/shaders/common.ts`).

## Where things live

| To change | Edit |
| --- | --- |
| Title, the rival's name at the end, waypoint links | `src/components/WebsiteUI.tsx`, name lettering in `src/app/globals.css` (`.doom-name`) |
| Title artwork | `artwork/loki-title.svg`, then export it at 1764 x 544 with transparency to `public/loki-title.webp` |
| Scroll length and waypoint positions | `src/lib/scrollFilm.ts` |
| Cable arrangement, pulse timing | `src/lib/tendrilPaths.ts` |
| Figure: horns, head, coat, arms, hands | `src/lib/characterGeometry.ts` |
| Rival at the end: hood, mask, armor, cloak; where he stands | `src/lib/rivalGeometry.ts` |
| Rival's look and motion: projected artwork, green rim light, steel glints, red eyes, wind, breath | `src/shaders/rivalShader.ts`, head turn and artwork loading in `src/components/Rival.tsx` |
| Light shafts, mist, halo | `src/shaders/fogShader.ts`, layers in `src/components/AtmosphericFog.tsx` |
| Energy look | `src/shaders/energyShader.ts`, `src/shaders/tendrilShader.ts` |
| What happens at each scroll position | `buildFilm()` in `src/hooks/useSceneAnimation.ts` |
| Device tiers | `src/hooks/useResponsiveQuality.ts` |

## Query parameters for development

- `?shot=2.5` freezes the film at that second, for comparing with the reference.
- `?quality=high|medium|low` forces a tier.
- `?nowebgl` shows the still fallback.

`public/fallback.webp` is a frame of the live scene. After visual changes, capture a new one at `?shot=1.25`.
