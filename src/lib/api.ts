import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DisputeError } from "@/lib/storage";

export const PARTY_TOKEN_HEADER = "x-party-token";

/** Convertit n'importe quelle erreur en réponse JSON { error } avec le bon code HTTP. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof DisputeError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const message = err.issues[0]?.message ?? "Requête invalide";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  if (err instanceof SyntaxError) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  console.error(err);
  const message = err instanceof Error ? err.message : "Erreur interne";
  return NextResponse.json({ error: message }, { status: 500 });
}
