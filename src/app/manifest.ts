import type { MetadataRoute } from "next";

/** Lets shop owners "Add to Home Screen" so the app opens like a native one. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Price Assistant",
    short_name: "Price",
    description: "Check product price, stock and shelf location in seconds.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#1d4ed8",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
