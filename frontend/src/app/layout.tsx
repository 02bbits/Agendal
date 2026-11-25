import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AppFrame } from "./AppFrame";
import "./globals.css";

// Graphite font, self-hosted at build time (no request to Google from the browser).
// Disable preload so unused subsets (e.g. latin-ext 84 KB) don't block 4G first-load JS (NF-4).
const sans = Inter({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
  preload: false,
});

// Inlined from public/theme.js so theme setup avoids a render-blocking HTTP roundtrip (AP-3, NF-4).
const THEME_SCRIPT = readFileSync(
  path.join(process.cwd(), "public/theme.js"),
  "utf8",
);

export const metadata: Metadata = {
  title: "Agendal",
  description: "Turn notes into tasks.",
};

// 100dvh layouts that reach under the phone's safe areas (NF-8)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // AppFrame sets data-theme on the client when Appearance isn't System
    <html lang="en" className={sans.variable} suppressHydrationWarning>
      <head>
        <meta name="darkreader-lock" />
        {/* Blocking on purpose: sets the theme before first paint (AP-3, T-AP-22) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
