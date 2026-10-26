"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Scale, Shield, Swords, ArrowRight, ExternalLink, Share2, RefreshCw } from "lucide-react";
import { PublicDispute, PublicParty } from "@/types/dispute";
import { getMyDispute, partyLink, postJson, rememberDispute, STATUS_LABELS, usePolling } from "@/lib/client";
import { AppHeader, CopyButton, ErrorBanner, FullPageSpinner, PhaseStepper, SimulationBadge } from "@/components/ui";

type HubData = { dispute: PublicDispute; provider: string };

function partyStatus(party: PublicParty): string {
  if (party.hasRebuttal) return "Réplique déposée";
  if (party.hasPlea) return "Plaidoirie déposée";
  return "En préparation";
}

function PartyCard({
  disputeId,
  party,
  token,
  topic,
  accent,
}: {
  disputeId: string;
  party: PublicParty;
  token?: string;
  topic: string;
  accent: "emerald" | "amber";
}) {
  const Icon = party.side === "A" ? Shield : Swords;
  const iconColor = accent === "emerald" ? "text-emerald-400" : "text-amber-400";
  const openClass =
    accent === "emerald"
      ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
      : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30";

  const share = async () => {
    if (!token) return;
    const url = partyLink(disputeId, token);
    if (!navigator.share) {
      window.location.href = `mailto:?subject=${encodeURIComponent("L'Arbitre — ton espace privé")}&body=${encodeURIComponent(url)}`;
      return;
    }
    {
      try {
        await navigator.share({
          title: "L'Arbitre — ton espace privé",
          text: `${party.name}, un litige t'attend sur L'Arbitre : « ${topic} ». Voici ton lien privé :`,
          url,
        });
      } catch {
        // partage annulé
      }
    }
  };

  return (
    <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <span className="font-semibold text-sm text-zinc-200">{party.name}</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded border ${
              party.hasPlea ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" : "bg-zinc-800 text-zinc-400 border-zinc-700/50"
            }`}
          >
            {partyStatus(party)}
          </span>
        </div>
        <p className="text-xs text-zinc-500">
          {token
            ? party.side === "A"
              ? "Ton espace privé de préparation"
              : `Lien privé à envoyer à ${party.name}`
            : "Accès réservé à cette partie"}
        </p>
      </div>
      {token && (
        <div className="flex items-center gap-2 flex-wrap">
          <CopyButton text={partyLink(disputeId, token)} label="Copier le lien" />
          {party.side === "B" && (
            <button
              type="button"
              onClick={share}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 flex items-center gap-1.5 transition border border-zinc-700"
            >
              <Share2 className="h-3.5 w-3.5" />
              Envoyer
            </button>
          )}
          <Link
            href={`/d/${disputeId}/party/${token}`}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition ${openClass}`}
          >
            Ouvrir
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

export default function DisputeHubPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const [resolved, setResolved] = useState(false);
  const { data, error, loading, refresh } = usePolling<HubData>(`/api/disputes/${id}`, { active: !resolved });
  const [tokens, setTokens] = useState<{ A?: string; B?: string }>({});
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const dispute = data?.dispute;

  // Liens privés : uniquement pour le navigateur qui a créé le litige
  useEffect(() => {
    const timer = setTimeout(() => {
      const mine = getMyDispute(id);
      setTokens({ A: mine?.tokenA, B: mine?.tokenB });
    }, 0);
    return () => clearTimeout(timer);
  }, [id]);

  useEffect(() => {
    if (!dispute) return;
    rememberDispute({ id: dispute.id, topic: dispute.topic, createdAt: dispute.createdAt });
    if (dispute.status === "resolved") {
      const timer = setTimeout(() => setResolved(true), 0);
      return () => clearTimeout(timer);
    }
  }, [dispute]);

  const retryJudge = async () => {
    setRetrying(true);
    setRetryError(null);
    try {
      await postJson(`/api/disputes/${id}/judge`, {});
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : "Échec de l'arbitrage");
    } finally {
      await refresh();
      setRetrying(false);
    }
  };

  if (loading && !dispute) return <FullPageSpinner />;

  if (!dispute) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 p-4 text-center">
        <p className="text-lg font-semibold text-zinc-200">{error || "Litige introuvable"}</p>
        <Link href="/" className="mt-4 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-amber-400">
          Créer un nouveau litige
        </Link>
      </div>
    );
  }

  const isCreator = !!(tokens.A && tokens.B);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-amber-500 selection:text-black">
      <AppHeader
        right={
          <div className="flex items-center gap-2">
            <SimulationBadge provider={data?.provider} />
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
              #{id.slice(0, 8)}
            </span>
          </div>
        }
      />

      <main className="max-w-2xl mx-auto px-4 py-8 w-full flex-1 space-y-6">
        <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Objet du litige</span>
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-zinc-800/80 border border-zinc-700/50 text-zinc-300">
              <span className={`h-1.5 w-1.5 rounded-full bg-amber-400 ${dispute.status !== "resolved" ? "animate-pulse" : ""}`} />
              {STATUS_LABELS[dispute.status]}
            </span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">&laquo; {dispute.topic} &raquo;</h1>
          <PhaseStepper status={dispute.status} />
          <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between gap-4 text-xs text-zinc-400">
            <span>Gage pour le perdant</span>
            <span className="font-semibold text-zinc-200 text-right">{dispute.gage}</span>
          </div>
        </div>

        {dispute.verdictError && !dispute.verdict && (
          <div className="space-y-2">
            <ErrorBanner message={`L'arbitre a rencontré une erreur : ${dispute.verdictError}`} />
            <button
              type="button"
              onClick={retryJudge}
              disabled={retrying}
              className="w-full py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
              Relancer l&apos;arbitrage
            </button>
            {retryError && <ErrorBanner message={retryError} />}
          </div>
        )}

        {dispute.verdict && (
          <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/20 via-zinc-900 to-zinc-900 border border-amber-500/40 text-center space-y-4 shadow-xl">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-amber-500/20 text-amber-300 mx-auto">
              <Scale className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Le verdict a été rendu !</h2>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                L&apos;arbitre a analysé les arguments, tranché le différend et attribué le gage.
              </p>
            </div>
            <Link
              href={`/d/${id}/verdict`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition"
            >
              Découvrir le verdict
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {isCreator ? "Accès privés (à partager)" : "Les parties"}
          </h2>
          <PartyCard disputeId={id} party={dispute.parties.A} token={tokens.A} topic={dispute.topic} accent="emerald" />
          <PartyCard disputeId={id} party={dispute.parties.B} token={tokens.B} topic={dispute.topic} accent="amber" />
          {!isCreator && (
            <p className="text-xs text-zinc-500 text-center pt-1">
              Pour participer, ouvre le lien privé qui t&apos;a été envoyé.
            </p>
          )}
          {isCreator && !dispute.parties.B.hasPlea && (
            <p className="text-xs text-zinc-500 text-center pt-1">
              Chaque lien donne accès à un espace privé : ne l&apos;envoie qu&apos;à la bonne personne.
            </p>
          )}
        </section>
      </main>

      <footer className="border-t border-zinc-900 py-4 text-center text-xs text-zinc-600">
        {dispute.status === "resolved" ? "Dossier clos" : "Actualisation automatique"}
      </footer>
    </div>
  );
}
