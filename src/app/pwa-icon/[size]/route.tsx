import { brandIcon } from "@/lib/brand-icon";

const ALLOWED = new Set([192, 512]);

// /pwa-icon/192 et /pwa-icon/512 : icônes référencées par le manifest
export async function GET(_req: Request, props: { params: Promise<{ size: string }> }) {
  const size = Number((await props.params).size);
  if (!ALLOWED.has(size)) return new Response("Not found", { status: 404 });

  const image = brandIcon(size);
  image.headers.set("Cache-Control", "public, max-age=604800, immutable");
  return image;
}
