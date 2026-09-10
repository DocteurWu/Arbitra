"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import {
  Scale,
  Shield,
  Swords,
  Copy,
  Check,
  ArrowRight,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Dispute } from "@/types/dispute";

export default function DisputeHubPage(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tokenA?: string; tokenB?: string; created?: string }>;
}) {
  const { id } = use(props.params);
  const searchParams = props.searchParams ? use(props.searchParams) : undefined;
  const tokenA = searchParams?.tokenA;
  const tokenB = searchParams?.tokenB;

  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedA, setCopiedA] = useState(false);
  const [copiedB, setCopiedB] = useState(false);

  const fetchDispute = useCallback(async () => {
    try {
      const res = await fetch(`/api/disputes/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDispute(data.dispute);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDispute();
    const interval = setInterval(fetchDispute, 3000);
    return () => clearInterval(interval);
  }, [fetchDispute]);

  const copyLink = (token: string, isA: boolean) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/d/${id}/party/${token}`;
    navigator.clipboard.writeText(url);
    if (isA) {
      setCopiedA(true);
      setTimeout(() => setCopiedA(false), 2000);
    } else {
      setCopiedB(true);
      setTimeout(() => setCopiedB(false), 2000);
    }
  };

  if (loading && !dispute) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">
        <RefreshCw className="h-6 w-6 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!dispute) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 p-4 text-center">
        <p className="text-lg font-semibold text-zinc-200">Litige introuvable</p>
        <Link
          href="/"
          className="mt-4 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-amber-400"
        >
          Créer un nouveau litige
        </Link>
      </div>
    );
  }

  const isResolved = dispute.status === "resolved" && dispute.verdict;
  const currentTokenA = tokenA || dispute.parties.A.token;
  const currentTokenB = tokenB || dispute.parties.B.token;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
      {/* Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md px-6 py-4 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-amber-400" />
            <span className="font-bold text-base tracking-tight text-zinc-200">
              L&apos;Arbitre
            </span>
          </Link>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
            Dossier #{id.slice(0, 8)}
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 w-full flex-1 space-y-6">
        {/* Dispute Summary Card */}
        <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Objet du litige
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-zinc-800/80 border border-zinc-700/50 text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              {dispute.status === "created" && "En attente des parties"}
              {dispute.status === "coaching" && "Coaching en cours"}
              {dispute.status === "rebuttal" && "Phase de réplique"}
              {dispute.status === "judging" && "Arbitrage en cours"}
              {dispute.status === "resolved" && "Verdict rendu"}
            </span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            &laquo; {dispute.topic} &raquo;
          </h1>
          <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
            <span>Gage officiel retenu :</span>
            <span className="font-semibold text-zinc-200">{dispute.gage}</span>
          </div>
        </div>

        {/* Big Alert if Verdict is Ready */}
        {isResolved && (
          <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/20 via-zinc-900 to-zinc-900 border border-amber-500/40 text-center space-y-4 shadow-xl">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-amber-500/20 text-amber-300 mx-auto">
              <Scale className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Le verdict a été rendu !</h2>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                L&apos;IA juge a analysé les arguments, tranché le différend et attribué le gage.
              </p>
            </div>
            <Link
              href={`/d/${id}/verdict`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition"
            >
              <span>Découvrir le verdict officiel</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* Private Access Links */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Accès privés individuels (à partager)
          </h2>

          {/* Party A Card */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-400" />
                <span className="font-semibold text-sm text-zinc-200">
                  {dispute.parties.A.name}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                  {dispute.parties.A.rebuttal
                    ? "Réplique validée"
                    : dispute.parties.A.plea
                    ? "Plaidoirie prête"
                    : "En coaching"}
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                Espace privé de préparation et de réplique
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => copyLink(currentTokenA, true)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 flex items-center gap-1.5 transition border border-zinc-700"
              >
                {copiedA ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Copié</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copier lien A</span>
                  </>
                )}
              </button>
              <Link
                href={`/d/${id}/party/${currentTokenA}`}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center gap-1.5 transition"
              >
                <span>Ouvrir</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Party B Card */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Swords className="h-4 w-4 text-amber-400" />
                <span className="font-semibold text-sm text-zinc-200">
                  {dispute.parties.B.name}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                  {dispute.parties.B.rebuttal
                    ? "Réplique validée"
                    : dispute.parties.B.plea
                    ? "Plaidoirie prête"
                    : "En attente"}
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                Lien à envoyer par message à l&apos;autre partie
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => copyLink(currentTokenB, false)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 flex items-center gap-1.5 transition border border-zinc-700"
              >
                {copiedB ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Copié</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copier lien B</span>
                  </>
                )}
              </button>
              <Link
                href={`/d/${id}/party/${currentTokenB}`}
                className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium flex items-center gap-1.5 transition"
              >
                <span>Ouvrir</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-900 py-4 text-center text-xs text-zinc-600">
        Actualisation automatique en temps réel
      </footer>
    </div>
  );
}
