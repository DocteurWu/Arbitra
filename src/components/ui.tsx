"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, RefreshCw, Scale } from "lucide-react";
import { DisputeStatus } from "@/types/dispute";

export function AppHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="border-b border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md px-4 sm:px-6 py-3.5 sticky top-0 z-50">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="h-8 w-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Scale className="h-4 w-4" />
          </span>
          <span className="font-bold text-base tracking-tight text-zinc-100">L&apos;Arbitre</span>
        </Link>
        {right}
      </div>
    </header>
  );
}

export function FullPageSpinner() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <RefreshCw className="h-6 w-6 animate-spin text-amber-500" aria-label="Chargement" />
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs font-medium flex items-center justify-between gap-3">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="shrink-0 px-2.5 py-1 rounded-lg bg-red-500/20 border border-red-500/40 text-red-200 hover:bg-red-500/30 transition">
          Réessayer
        </button>
      )}
    </div>
  );
}

export function CopyButton({ text, label, className = "" }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copie ce lien :", text);
        }
      }}
      className={`px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 flex items-center gap-1.5 transition border border-zinc-700 ${className}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      <span>{copied ? "Copié" : label}</span>
    </button>
  );
}

const STEPS: { key: DisputeStatus[]; label: string }[] = [
  { key: ["created", "coaching"], label: "Plaidoiries" },
  { key: ["rebuttal"], label: "Répliques" },
  { key: ["judging"], label: "Délibéré" },
  { key: ["resolved"], label: "Verdict" },
];

/** Frise des 4 étapes du litige. */
export function PhaseStepper({ status }: { status: DisputeStatus }) {
  const current = STEPS.findIndex((s) => s.key.includes(status));
  return (
    <ol className="flex items-center gap-1.5" aria-label="Étapes du litige">
      {STEPS.map((step, i) => {
        const done = i < current || status === "resolved";
        const active = i === current && status !== "resolved";
        return (
          <li key={step.label} className="flex-1 flex flex-col gap-1.5" aria-current={active ? "step" : undefined}>
            <span
              className={`h-1.5 rounded-full transition-colors ${
                done ? "bg-amber-500" : active ? "bg-amber-500/50 animate-pulse" : "bg-zinc-800"
              }`}
            />
            <span className={`text-[10px] font-medium ${done || active ? "text-zinc-300" : "text-zinc-600"}`}>
              {i + 1}. {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function SimulationBadge({ provider }: { provider?: string }) {
  if (provider !== "simulation") return null;
  return (
    <span
      title="Aucune clé API configurée : les réponses viennent du simulateur local"
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300"
    >
      Mode simulation
    </span>
  );
}
