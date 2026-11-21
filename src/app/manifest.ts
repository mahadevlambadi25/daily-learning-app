import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/config";

/** Installable PWA metadata (PRD P1). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME}: Daily Learning`,
    short_name: APP_NAME,
    description: "Short, useful lessons to read or listen to every day.",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf7f2",
    theme_color: "#c2410c",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
