import type { Metadata, Viewport } from "next";
import { AppFrame } from "./AppFrame";
import "./globals.css";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // AppFrame sets data-theme on the client when Appearance isn't System
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
