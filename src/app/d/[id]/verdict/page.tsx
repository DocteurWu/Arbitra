"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import {
  Scale,
  Award,
  CheckCircle2,
  Share2,
  Copy,
  Check,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { Dispute, PointRuling } from "@/types/dispute";

export default function VerdictPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(props.params);

  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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
  }, [fetchDispute]);

  const copyVerdictLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleShare = async () => {
    if (typeof window !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Verdict de l'Arbitre IA",
          text: `Le Juge IA a tranché le litige : "${dispute?.topic}" !`,
          url: window.location.href,
        });
      } catch {
        copyVerdictLink();
      }
    } else {
      copyVerdictLink();
    }
  };

  if (loading && !dispute) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">
        <RefreshCw className="h-6 w-6 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!dispute || !dispute.verdict) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 p-4 text-center">
        <Scale className="h-8 w-8 text-zinc-600 mb-3" />
        <p className="text-base font-bold text-zinc-200">Verdict en attente</p>
        <p className="text-xs text-zinc-500 mt-1 max-w-sm">
          Les deux parties n&apos;ont pas encore complété l&apos;ensemble de la procédure.
        </p>
        <Link
          href={`/d/${id}`}
          className="mt-4 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-amber-400"
        >
          Retour au Hub
        </Link>
      </div>
    );
  }

  const { verdict } = dispute;
  const winnerName =
    verdict.winner === "A"
      ? dispute.parties.A.name
      : verdict.winner === "B"
      ? dispute.parties.B.name
      : "Égalité parfaite (50-50)";

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
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-300 flex items-center gap-1.5 transition"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Copié</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Partager</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-2xl mx-auto px-4 py-8 w-full flex-1 space-y-6">
        {/* Proclamation Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-amber-500/20 via-zinc-900 to-zinc-950 border border-amber-500/40 text-center space-y-4 shadow-2xl relative overflow-hidden">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Award className="h-4 w-4" />
            Verdict Officiel
          </div>

          <div className="space-y-1">
            <p className="text-xs uppercase tracking-widest text-zinc-400">
              Gagnant désigné
            </p>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {winnerName}
            </h1>
          </div>

          <p className="text-sm font-medium text-zinc-300 italic max-w-md mx-auto">
            &laquo; {verdict.headline} &raquo;
          </p>

          {/* Penalty box */}
          <div className="pt-4 border-t border-zinc-800/80 mt-4">
            <div className="p-4 rounded-2xl bg-zinc-950/80 border border-amber-500/20 text-xs space-y-1">
              <span className="font-bold text-amber-400 uppercase tracking-wider text-[11px] block">
                Exécution du gage
              </span>
              <p className="text-sm font-semibold text-zinc-100">
                {verdict.loserPenalty}
              </p>
            </div>
          </div>
        </div>

        {/* Dispute Details recap */}
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-xs flex justify-between items-center text-zinc-400">
          <div>
            <span className="block text-[10px] uppercase font-bold text-zinc-500">
              Litige initial
            </span>
            <span className="text-zinc-200 font-medium">{dispute.topic}</span>
          </div>
          <div className="text-right">
            <span className="block text-[10px] uppercase font-bold text-zinc-500">
              Date
            </span>
            <span>{new Date(verdict.generatedAt).toLocaleDateString("fr-FR")}</span>
          </div>
        </div>

        {/* Point-by-point Analysis */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <Scale className="h-4 w-4 text-amber-400" />
            Analyse détaillée des arguments
          </h2>

          <div className="space-y-3">
            {verdict.pointsAnalysis.map((point: PointRuling, index: number) => {
              const pointWinnerName =
                point.rulingFor === "A"
                  ? dispute.parties.A.name
                  : point.rulingFor === "B"
                  ? dispute.parties.B.name
                  : "Partagé";

              return (
                <div
                  key={index}
                  className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-200">
                      Point #{index + 1} : {point.issue}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        point.rulingFor === "A"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : point.rulingFor === "B"
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                          : "bg-zinc-800 border-zinc-700 text-zinc-300"
                      }`}
                    >
                      Avantage {pointWinnerName}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {point.reasoning}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Closure Advice */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/20 to-zinc-900 border border-indigo-500/30 space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
            <CheckCircle2 className="h-4 w-4" />
            Clause de sortie & Paix des ménages
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            {verdict.closureAdvice}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleShare}
            className="flex-1 py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 font-semibold text-xs transition flex items-center justify-center gap-2"
          >
            <Copy className="h-4 w-4" />
            <span>Copier le lien du verdict</span>
          </button>
          <Link
            href="/"
            className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
          >
            <span>Trancher un autre litige</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>

      <footer className="border-t border-zinc-900 py-4 text-center text-xs text-zinc-600">
        Arbitrage argumentatif officiel rendu sans parti pris • Décision définitive
      </footer>
    </div>
  );
}
