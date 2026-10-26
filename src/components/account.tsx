"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Ticket } from "lucide-react";
import { usePolling } from "@/lib/client";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { MeResponse } from "@/app/api/me/route";

/** État du compte courant (chargé une fois ; rappeler `refresh` après un achat). */
export function useMe() {
  return usePolling<MeResponse>("/api/me", { active: false });
}

/** Connexion / solde de crédits / déconnexion. Invisible en mode ouvert (sans comptes). */
export function AccountMenu() {
  const router = useRouter();
  const { data: me } = useMe();
  if (!me || !me.authEnabled) return null;

  if (!me.user) {
    return (
      <Link
        href="/login"
        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-200 transition"
      >
        Se connecter
      </Link>
    );
  }

  const signOut = async () => {
    await createBrowserSupabase().auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/pricing"
        title="Acheter des litiges"
        className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-semibold text-amber-300 flex items-center gap-1.5 transition"
      >
        <Ticket className="h-3.5 w-3.5" />
        {me.credits ?? 0} litige{(me.credits ?? 0) > 1 ? "s" : ""}
      </Link>
      <button
        type="button"
        onClick={signOut}
        aria-label={`Se déconnecter (${me.user.email})`}
        title={`Se déconnecter (${me.user.email})`}
        className="p-2 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
