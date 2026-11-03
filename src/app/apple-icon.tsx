import { brandIcon } from "@/lib/brand-icon";

// Icône d'écran d'accueil iPhone / iPad / Safari sur Mac
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return brandIcon(180);
}
