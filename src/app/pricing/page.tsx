"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Ticket } from "lucide-react";
import { PLANS, PlanId, formatPrice } from "@/lib/plans";
import { postJson } from "@/lib/client";
import { AppHeader, ErrorBanner } from "@/components/ui";
import { useMe } from "@/components/account";

const ORDER: PlanId[] = ["single", "pack5", "pack15", "monthly"];

export default function PricingPage(props: { searchParams: Promise<{ paid?: string; canceled?: string }> }) {
  const params = use(props.searchParams);
  const router = useRouter();
  const { data: me, refresh } = useMe();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Après un paiement, le crédit arrive via le webhook Stripe : on recharge le solde quelques secondes
  useEffect(() => {
    if (!params.paid) return;
    const timers = [1500, 4000, 8000, 15000].map((ms) => setTimeout(() => void refresh(), ms));
    return () => timers.forEach(clearTimeout);
  }, [params.paid, refresh]);

  const go = async (key: string, url: string) => {
    setBusy(key);
    setError(null);
    try {
      const res = await postJson<{ url: string }>(url, key === "portal" ? {} : { plan: key });
      window.location.assign(res.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setBusy(null);
    }
  };

  const buy = (plan: PlanId) => {
    if (me?.authEnabled && !me.user) {
      router.push("/login?next=/pricing");
      return;
    }
    void go(plan, "/api/billing/checkout");
  };

  const disabled = me ? !me.authEnabled || !me.stripeEnabled : true;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-amber-500 selection:text-black">
      <AppHeader />
      <main className="max-w-3xl mx-auto px-4 py-10 w-full flex-1 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Des litiges, au prix d&apos;un café</h1>
          <p className="text-sm text-zinc-400 max-w-lg mx-auto">
            Tu paies, tu invites ton adversaire : il participe gratuitement avec son lien privé. Un crédit = un litige complet, de l&apos;avocate au verdict.
          </p>
        </div>

        {params.paid && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-700/50 text-emerald-300 text-xs font-medium">
            Merci ! Ton paiement est confirmé, tes crédits arrivent dans un instant.
          </div>
        )}
        {params.canceled && (
          <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs">Paiement annulé : rien n&apos;a été débité.</div>
        )}
        {error && <ErrorBanner message={error} />}
        {me && me.authEnabled && !me.stripeEnabled && <ErrorBanner message="Le paiement n'est pas encore activé sur ce serveur." />}
        {me && !me.authEnabled && <ErrorBanner message="Mode local : les comptes et le paiement ne sont pas configurés." />}

        {me?.user && (
          <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Ticket className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">
                  {me.credits ?? 0} litige{(me.credits ?? 0) > 1 ? "s" : ""} disponible{(me.credits ?? 0) > 1 ? "s" : ""}
                </p>
                <p className="text-[11px] text-zinc-500">{me.user.email}</p>
              </div>
            </div>
            <Link href="/" className="text-xs font-semibold text-amber-400 hover:text-amber-300">
              Ouvrir un litige →
            </Link>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          {ORDER.map((id) => {
            const plan = PLANS[id];
            const perDispute = plan.amountCents / plan.credits;
            return (
              <div
                key={id}
                className={`p-5 rounded-2xl border space-y-4 flex flex-col ${
                  plan.highlight ? "bg-gradient-to-br from-amber-500/10 to-zinc-900 border-amber-500/40" : "bg-zinc-900/60 border-zinc-800"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-white">{plan.name}</h2>
                    {plan.highlight && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-zinc-950">Populaire</span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400">{plan.description}</p>
                </div>
                <p className="text-3xl font-black text-white">
                  {formatPrice(plan.amountCents)}
                  {plan.kind === "subscription" && <span className="text-sm font-medium text-zinc-500"> /mois</span>}
                </p>
                <ul className="text-xs text-zinc-300 space-y-1.5 flex-1">
                  <li className="flex gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    {plan.credits} litige{plan.credits > 1 ? "s" : ""}
                    {plan.kind === "subscription" ? " par mois" : ""}
                    {plan.credits > 1 && ` · ${formatPrice(Math.round(perDispute))} le litige`}
                  </li>
                  <li className="flex gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    Adversaire invité gratuitement
                  </li>
                  <li className="flex gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    {plan.kind === "pack" ? "Crédits sans date d'expiration" : "Résiliable à tout moment"}
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={() => buy(id)}
                  disabled={disabled || busy !== null}
                  className="w-full py-2.5 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950 transition disabled:opacity-40"
                >
                  {busy === id ? "Redirection…" : plan.kind === "subscription" ? "S'abonner" : "Acheter"}
                </button>
              </div>
            );
          })}
        </div>

        {me?.user && me.stripeEnabled && (
          <p className="text-center text-xs text-zinc-500">
            Déjà abonné ?{" "}
            <button type="button" onClick={() => go("portal", "/api/billing/portal")} className="text-amber-400 hover:text-amber-300 underline">
              Gérer mon abonnement et mes factures
            </button>
          </p>
        )}
        <p className="text-center text-[11px] text-zinc-600">Paiement sécurisé par Stripe. Nous ne voyons jamais ta carte.</p>
      </main>
    </div>
  );
}
