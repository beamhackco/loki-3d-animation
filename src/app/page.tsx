import { Experience } from "@/components/Experience";

export default function Page() {
  return (
    <main className="relative min-h-svh w-full bg-abyss">
      <Experience />
      <noscript>
        <div className="still fixed inset-0 z-30" />
      </noscript>
    </main>
  );
}
