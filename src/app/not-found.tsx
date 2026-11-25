import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="still grid min-h-svh place-items-end justify-items-start p-6 sm:p-10">
      <div>
        <h1 className="on-scene text-[clamp(1.8rem,1.3rem+2vw,3rem)] leading-tight">This page doesn&rsquo;t exist.</h1>
        <Link href="/" className="waypoint on-scene mt-3 inline-block py-2 text-[1.05rem] underline underline-offset-4">
          Go to the scene
        </Link>
      </div>
    </main>
  );
}
