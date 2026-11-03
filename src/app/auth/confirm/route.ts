import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { publicOrigin } from "@/lib/origin";

// Connexion par lien magique « maison » : le lien porte un token_hash (généré côté serveur
// via l'API admin Supabase) au lieu de passer par l'URL de vérification Supabase — qui dépend
// du Site URL du projet et retombait sur http://localhost:3000 en production.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = publicOrigin(request);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") ?? "magiclink";
  const rawNext = searchParams.get("next") ?? "/";
  // Redirection interne uniquement (évite les open redirects)
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (tokenHash && (type === "magiclink" || type === "email" || type === "recovery" || type === "invite")) {
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=1`);
}
