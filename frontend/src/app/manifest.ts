import type { MetadataRoute } from "next";

// AP-1: makes Agendal installable. Icons come from public/icons/icon.svg; the check sits inside
// the maskable safe zone, so the 512 icon serves both purposes.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Agendal",
    short_name: "Agendal",
    description: "Turn notes into tasks.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f2f2f2",
    theme_color: "#f2f2f2",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
