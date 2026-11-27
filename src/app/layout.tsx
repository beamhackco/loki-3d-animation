import type { Metadata, Viewport } from "next";
import { Orbitron, Tenor_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const tenor = Tenor_Sans({ weight: "400", subsets: ["latin"], variable: "--font-tenor", display: "swap" });
/** Wide techno capitals for the rival's name. */
const orbitron = Orbitron({ weight: "800", subsets: ["latin"], variable: "--font-orbitron", display: "swap" });

export const metadata: Metadata = {
  title: "Loki",
  description: "A two-horned figure strides through black water, holding a hundred living cables in its fists. A real-time 3D scene.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#020803",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${tenor.variable} ${orbitron.variable}`}>
      <body>{children}</body>
    </html>
  );
}
