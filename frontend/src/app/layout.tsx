import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AppFrame } from "./AppFrame";
import "./globals.css";

// Graphite font, self-hosted at build time (no request to Google from the browser)
const sans = Inter({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

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
        {/* Blocking on purpose: sets the theme before first paint (AP-3, T-AP-22) */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme.js" />
      </head>
      <body>
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
