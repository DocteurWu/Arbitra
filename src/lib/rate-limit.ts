import { NextResponse } from "next/server";

// Limiteur en mémoire (fenêtre glissante). Suffisant pour un seul serveur ;
// sur plusieurs instances, le remplacer par Upstash Redis ou équivalent.
const hits = new Map<string, number[]>();

/** Renvoie une réponse 429 si la limite est dépassée, sinon null. */
export function rateLimit(key: string, max: number, windowMs: number): NextResponse | null {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= max) {
    hits.set(key, recent);
    const retryAfter = Math.ceil((windowMs - (now - recent[0])) / 1000);
    return NextResponse.json(
      { error: "Trop de requêtes, réessaie dans un instant." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  recent.push(now);
  hits.set(key, recent);

  // Nettoyage opportuniste pour ne pas grossir indéfiniment
  if (hits.size > 5000) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }
  return null;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}
