"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowRight, Award, CheckCircle2, FolderOpen, Scale, Share2 } from "lucide-react";
import { Plea, PublicDispute, PublicParty, Verdict } from "@/types/dispute";
import { usePolling } from "@/lib/client";
import { AppHeader, CopyButton, FullPageSpinner, SimulationBadge } from "@/components/ui";

type VerdictData = { dispute: PublicDispute; provider: string };

function ScoreBoard({ verdict, a, b }: { verdict: Verdict; a: PublicParty; b: PublicParty }) {
  const pointsA = verdict.pointsAnalysis.filter((p) => p.rulingFor === "A").length;
  const pointsB = verdict.pointsAnalysis.filter((p) => p.rulingFor === "B").length;
  const pointsEqual = verdict.pointsAnalysis.length - pointsA - pointsB;
  const hasScores = verdict.scoreA !== undefined && verdict.scoreB !== undefined;
  const total = (verdict.scoreA ?? 0) + (verdict.scoreB ?? 0) || 1;
  const shareA = hasScores ? Math.round(((verdict.scoreA ?? 0) / total) * 100) : 50;

  return (
    <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
      <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Rapport de force</h2>
      <div className="grid grid-cols-2 gap-3">
        {[
          { party: a, score: verdict.scoreA, points: pointsA, color: "text-emerald-400", align: "text-left" },
          { party: b, score: verdict.scoreB, points: pointsB, color: "text-amber-400", align: "text-right" },
        ].map(({ party, score, points, color, align }) => (
          <div key={party.side} className={align}>
            <p className="text-sm font-semibold text-zinc-200 truncate">{party.name}</p>
            {score !== undefined && (
              <p className={`text-3xl font-black tabular-nums ${color}`}>
                {score}
                <span className="text-sm font-semibold text-zinc-500">/100</span>
              </p>
            )}
            <p className="text-[11px] text-zinc-500">
              {points} point{points > 1 ? "s" : ""} gagné{points > 1 ? "s" : ""}
            </p>
          </div>
        ))}
      </div>
      {hasScores && (
        <div className="h-2.5 rounded-full bg-zinc-800 overflow-hidden flex" role="img" aria-label={`${a.name} ${verdict.scoreA}, ${b.name} ${verdict.scoreB}`}>
          <div className="bg-emerald-500 transition-all duration-700" style={{ width: `${shareA}%` }} />
          <div className="bg-amber-500 flex-1" />
        </div>
      )}
      {pointsEqual > 0 && (
        <p className="text-[11px] text-zinc-500 text-center">
          {pointsEqual} point{pointsEqual > 1 ? "s" : ""} jugé{pointsEqual > 1 ? "s" : ""} à égalité
        </p>
      )}
    </div>
  );
}

function DossierParty({ party, tone }: { party: PublicParty; tone: "emerald" | "amber" }) {
  const plea: Plea | null = party.plea;
  const titleColor = tone === "emerald" ? "text-emerald-400" : "text-amber-400";
  if (!plea) return null;
  return (
    <div className="space-y-2 text-sm">
      <p className={`text-[11px] font-bold uppercase tracking-wider ${titleColor}`}>Partie {party.side} · {party.name}</p>
      <p className="italic text-zinc-300">&laquo; {plea.summary} &raquo;</p>
      <ul className="list-disc pl-5 text-zinc-400 space-y-0.5">
        {plea.facts.map((f, i) => (
          <li key={i}>{f}</li>
        ))}
      </ul>
      <p className="text-zinc-400">
        <span className="text-zinc-500">Demande :</span> {plea.demand}
      </p>
      {plea.concession && (
        <p className="text-zinc-400">
          <span className="text-zinc-500">Concession :</span> {plea.concession}
        </p>
      )}
      {party.rebuttal && (
        <p className="text-zinc-300 bg-zinc-950 border border-zinc-800 rounded-xl p-3">
          <span className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Réplique</span>
          {party.rebuttal}
        </p>
      )}
    </div>
  );
}

export default function VerdictPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const [shareFallback, setShareFallback] = useState(false);
  // On continue d'interroger le serveur tant que le verdict n'est pas rendu
  const [done, setDone] = useState(false);
  const { data, loading } = usePolling<VerdictData>(`/api/disputes/${id}`, { active: !done, intervalMs: 4000 });

  const dispute = data?.dispute;
  if (dispute?.verdict && !done) setDone(true);

  const handleShare = async () => {
    if (!dispute) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Verdict de L'Arbitre",
          text: `L'arbitre a tranché : « ${dispute.topic} » !`,
          url: window.location.href,
        });
        return;
      } catch {
        // partage annulé
      }
    }
    setShareFallback(true);
  };

  if (loading && !dispute) return <FullPageSpinner />;

  if (!dispute || !dispute.verdict) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 p-4 text-center">
        <Scale className="h-8 w-8 text-zinc-600 mb-3 animate-pulse" />
        <p className="text-base font-bold text-zinc-200">Verdict en attente</p>
        <p className="text-xs text-zinc-500 mt-1 max-w-sm">
          Les deux parties n&apos;ont pas encore terminé la procédure. Cette page se mettra à jour automatiquement.
        </p>
        <Link href={`/d/${id}`} className="mt-4 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-amber-400">
          Voir l&apos;avancement
        </Link>
      </div>
    );
  }

  const { verdict, parties } = dispute;
  const winnerName = verdict.winner === "A" ? parties.A.name : verdict.winner === "B" ? parties.B.name : "Égalité parfaite";
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-amber-500 selection:text-black">
      <AppHeader
        right={
          <div className="flex items-center gap-2">
            {(verdict.simulated || data?.provider === "simulation") && <SimulationBadge provider="simulation" />}
            <button
              type="button"
              onClick={handleShare}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-300 flex items-center gap-1.5 transition"
            >
              <Share2 className="h-3.5 w-3.5" />
              Partager
            </button>
          </div>
        }
      />

      <main className="max-w-2xl mx-auto px-4 py-8 w-full flex-1 space-y-6">
        {shareFallback && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
            <span className="truncate">{pageUrl}</span>
            <CopyButton text={pageUrl} label="Copier" />
          </div>
        )}

        {/* Proclamation */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-amber-500/20 via-zinc-900 to-zinc-950 border border-amber-500/40 text-center space-y-4 shadow-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Award className="h-4 w-4" />
            Verdict officiel
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-widest text-zinc-400">{verdict.winner === "50-50" ? "Décision" : "Gagnant"}</p>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">{winnerName}</h1>
          </div>
          <p className="text-sm font-medium text-zinc-300 italic max-w-md mx-auto">&laquo; {verdict.headline} &raquo;</p>
          <div className="pt-4 border-t border-zinc-800/80">
            <div className="p-4 rounded-2xl bg-zinc-950/80 border border-amber-500/20 space-y-1">
              <span className="font-bold text-amber-400 uppercase tracking-wider text-[11px] block">Exécution du gage</span>
              <p className="text-sm font-semibold text-zinc-100">{verdict.loserPenalty}</p>
            </div>
          </div>
        </div>

        <ScoreBoard verdict={verdict} a={parties.A} b={parties.B} />

        {/* Analyse point par point */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <Scale className="h-4 w-4 text-amber-400" />
            Analyse des arguments
          </h2>
          {verdict.pointsAnalysis.map((point, index) => {
            const label = point.rulingFor === "A" ? parties.A.name : point.rulingFor === "B" ? parties.B.name : "Égalité";
            return (
              <div key={index} className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-bold text-zinc-200">
                    {index + 1}. {point.issue}
                  </span>
                  <span
                    className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      point.rulingFor === "A"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : point.rulingFor === "B"
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                          : "bg-zinc-800 border-zinc-700 text-zinc-300"
                    }`}
                  >
                    {point.rulingFor === "EQUAL" ? label : `Avantage ${label}`}
                  </span>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed">{point.reasoning}</p>
              </div>
            );
          })}
        </section>

        {/* Conseil de clôture */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/20 to-zinc-900 border border-indigo-500/30 space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
            <CheckCircle2 className="h-4 w-4" />
            Pour tourner la page
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed">{verdict.closureAdvice}</p>
        </div>

        {/* Dossier complet */}
        <details className="rounded-2xl border border-zinc-800 bg-zinc-900/40 group">
          <summary className="cursor-pointer px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-zinc-200 flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-amber-400" />
            Consulter le dossier complet
          </summary>
          <div className="px-5 pb-5 space-y-6">
            <p className="text-xs text-zinc-500">
              Objet : &laquo; {dispute.topic} &raquo; · Gage : {dispute.gage} · Rendu le{" "}
              {new Date(verdict.generatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </p>
            <DossierParty party={parties.A} tone="emerald" />
            <div className="border-t border-zinc-800" />
            <DossierParty party={parties.B} tone="amber" />
          </div>
        </details>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <CopyButton text={pageUrl} label="Copier le lien du verdict" className="flex-1 justify-center py-3 rounded-xl" />
          <Link
            href="/"
            className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
          >
            Trancher un autre litige
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>

      <footer className="border-t border-zinc-900 py-4 text-center text-xs text-zinc-600">
        Arbitrage argumentatif rendu sans parti pris
      </footer>
    </div>
  );
}
