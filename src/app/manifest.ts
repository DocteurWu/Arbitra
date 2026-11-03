import type { MetadataRoute } from "next";

// Rend le site installable (Chrome/Edge/Android) : icône, plein écran, couleurs de la marque
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "L'Arbitre — Le Juge IA de disputes privées",
    short_name: "L'Arbitre",
    description: "Tranchez vos disputes de couple, d'amis et de coloc sans perdre la face grâce à un arbitrage IA impartial.",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#09090b",
    theme_color: "#09090b",
    categories: ["lifestyle", "social", "entertainment"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
