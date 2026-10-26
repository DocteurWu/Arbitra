"use client";

import { use, useState } from "react";
import { Mail, ShieldCheck } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { AppHeader, ErrorBanner } from "@/components/ui";
import { useMe } from "@/components/account";

export default function LoginPage(props: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = use(props.searchParams);
  const next = params.next && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "/";
  const { data: me } = useMe();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(params.error ? "Le lien de connexion a expiré. Demande-en un nouveau." : null);

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    const { error: err } = await createBrowserSupabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo() },
    });
    setSending(false);
    if (err) setError("Impossible d'envoyer le lien : " + err.message);
    else setSent(true);
  };

  const withGoogle = async () => {
    const { error: err } = await createBrowserSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (err) setError(err.message);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-amber-500 selection:text-black">
      <AppHeader />
      <main className="max-w-md mx-auto px-4 py-12 w-full flex-1 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Connexion</h1>
          <p className="text-sm text-zinc-400">
            Ton premier litige est offert. Pas de mot de passe : on t&apos;envoie un lien de connexion par email.
          </p>
        </div>

        {me && !me.authEnabled && (
          <ErrorBanner message="Les comptes ne sont pas configurés sur ce serveur (mode local : tout est ouvert)." />
        )}
        {error && <ErrorBanner message={error} />}

        {sent ? (
          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-emerald-500/30 text-center space-y-2">
            <ShieldCheck className="h-8 w-8 text-emerald-400 mx-auto" />
            <p className="font-semibold text-white">Vérifie ta boîte mail</p>
            <p className="text-xs text-zinc-400">
              Un lien de connexion a été envoyé à <span className="text-zinc-200">{email}</span>. Pense à regarder les spams.
            </p>
          </div>
        ) : (
          <form onSubmit={sendLink} className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Ton email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="toi@exemple.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={sending || !email.trim()}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 flex items-center justify-center gap-2 disabled:opacity-50 transition"
            >
              <Mail className="h-4 w-4" />
              {sending ? "Envoi…" : "Recevoir mon lien de connexion"}
            </button>

            {process.env.NEXT_PUBLIC_GOOGLE_AUTH === "1" && (
              <>
                <div className="flex items-center gap-3 text-[11px] text-zinc-600">
                  <span className="h-px flex-1 bg-zinc-800" />
                  ou
                  <span className="h-px flex-1 bg-zinc-800" />
                </div>
                <button
                  type="button"
                  onClick={withGoogle}
                  className="w-full py-3 rounded-xl border border-zinc-700 text-sm font-medium text-zinc-200 hover:bg-zinc-800 transition"
                >
                  Continuer avec Google
                </button>
              </>
            )}
          </form>
        )}

        <p className="text-[11px] text-zinc-600 text-center">
          Ton adversaire n&apos;a pas besoin de compte : il participe avec son lien privé.
        </p>
      </main>
    </div>
  );
}
