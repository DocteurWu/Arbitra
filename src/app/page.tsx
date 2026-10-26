"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Scale, Shield, Swords, Sparkles, ArrowRight, Check, FolderOpen, X } from "lucide-react";
import { forgetDispute, rememberDispute, useMyDisputes } from "@/lib/client";
import { AccountMenu, useMe } from "@/components/account";
import { GAGE_MAX_LENGTH, NAME_MAX_LENGTH, TOPIC_MAX_LENGTH } from "@/lib/limits";

function MyDisputesList() {
  const disputes = useMyDisputes();
  if (disputes.length === 0) return null;

  return (
    <section className="mt-8 space-y-3" aria-labelledby="my-disputes">
      <h2 id="my-disputes" className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
        <FolderOpen className="h-4 w-4 text-amber-400" />
        Mes litiges
      </h2>
      <ul className="space-y-2">
        {disputes.map((d) => {
          // Le créateur revient au hub (deux liens), une partie invitée à son espace privé
          const href = !d.tokenA && d.token ? `/d/${d.id}/party/${d.token}` : `/d/${d.id}`;
          return (
            <li key={d.id} className="group flex items-center gap-2 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition">
              <Link href={href} className="flex-1 min-w-0 px-4 py-3">
                <p className="text-sm text-zinc-200 truncate">&laquo; {d.topic} &raquo;</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {d.tokenA ? "Créé par toi" : d.side ? `Partie ${d.side}` : "Consulté"} ·{" "}
                  {new Date(d.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </p>
              </Link>
              <button
                type="button"
                onClick={() => forgetDispute(d.id)}
                aria-label="Retirer de la liste"
                title="Retirer de la liste (le litige n'est pas supprimé)"
                className="p-2 mr-2 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const PRESET_GAGES = [
  "🍽️ Fait la vaisselle pendant 3 jours",
  "☕ Paie le prochain café / verre",
  "🎬 Choisit le film sans négociation",
  "🛏️ Fait le lit toute la semaine",
  "👑 Accorde 1 droit de veto absolu",
];

export default function HomePage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [nameA, setNameA] = useState("");
  const [nameB, setNameB] = useState("");
  const [gage, setGage] = useState(PRESET_GAGES[0]);
  const [customGage, setCustomGage] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noCredits, setNoCredits] = useState(false);
  const { data: me } = useMe();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      setError("Veuillez décrire le sujet du litige.");
      return;
    }

    const selectedGage = isCustom ? customGage.trim() : gage;
    if (!selectedGage) {
      setError("Veuillez sélectionner ou saisir un gage.");
      return;
    }

    setLoading(true);
    setError(null);
    setNoCredits(false);

    try {
      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          gage: selectedGage,
          nameA: nameA.trim() || "Partie A",
          nameB: nameB.trim() || "Partie B",
        }),
      });

      const data = await res.json();
      if (res.status === 401) {
        router.push("/login?next=/");
        return;
      }
      if (res.status === 402) {
        setNoCredits(true);
      }
      if (!res.ok) {
        throw new Error(data.error || "Impossible de créer le litige.");
      }

      // Les liens privés restent dans ce navigateur, jamais dans l'URL du hub
      rememberDispute({
        id: data.dispute.id,
        topic: data.dispute.topic,
        createdAt: data.dispute.createdAt,
        tokenA: data.tokenA,
        tokenB: data.tokenB,
      });
      router.push(`/d/${data.dispute.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
      {/* Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md px-6 py-4 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Scale className="h-5 w-5" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
              L&apos;Arbitre
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs font-medium px-2.5 py-1 rounded-full bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">
              Protocole IA Impartial
            </span>
            <AccountMenu />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-2xl mx-auto px-4 py-10 w-full flex-1 flex flex-col justify-center">
        {/* Hero Section */}
        <div className="text-center mb-8 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-1">
            <Sparkles className="h-3.5 w-3.5" />
            Tranchez vos disputes sans perdre la face
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Qui a tort ? Qui a raison ?
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 max-w-lg mx-auto leading-relaxed">
            Chacun briefe son IA avocate. Les arguments sont confrontés. Le Juge IA rend son verdict officiel et attribue le gage.
          </p>
        </div>

        {/* 3 Pillars info */}
        <div className="grid grid-cols-3 gap-2.5 mb-8 text-center">
          <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <Shield className="h-4 w-4 text-emerald-400 mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-zinc-200">1. Coaching</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Avocate privée</p>
          </div>
          <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <Swords className="h-4 w-4 text-amber-400 mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-zinc-200">2. Échange</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">1 réplique unique</p>
          </div>
          <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <Scale className="h-4 w-4 text-indigo-400 mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-zinc-200">3. Verdict</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Jugement & gage</p>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div role="alert" className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs font-medium flex items-center justify-between gap-3">
                <span>{error}</span>
                {noCredits && (
                  <Link href="/pricing" className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500 text-zinc-950 font-bold">
                    Voir les offres
                  </Link>
                )}
              </div>
            )}
            {me?.authEnabled && (
              <p className="text-[11px] text-zinc-500 text-center -mb-2">
                {me.user
                  ? `Il te reste ${me.credits ?? 0} litige${(me.credits ?? 0) > 1 ? "s" : ""}. Ton adversaire participe gratuitement.`
                  : "Ton premier litige est offert : connecte-toi au moment de l'ouvrir."}
              </p>
            )}

            {/* Litige Topic */}
            <div className="space-y-2">
              <label htmlFor="topic" className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                L&apos;objet du litige
              </label>
              <textarea
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={2}
                maxLength={TOPIC_MAX_LENGTH}
                placeholder="Ex: Qui devait vider le lave-vaisselle hier soir après le dîner ?"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-sm transition"
                required
              />
            </div>

            {/* Noms des parties */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">
                  Ton prénom (Partie A)
                </label>
                <input
                  type="text"
                  value={nameA}
                  onChange={(e) => setNameA(e.target.value)}
                  maxLength={NAME_MAX_LENGTH}
                  placeholder="Toi"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">
                  Son prénom (Partie B)
                </label>
                <input
                  type="text"
                  value={nameB}
                  onChange={(e) => setNameB(e.target.value)}
                  maxLength={NAME_MAX_LENGTH}
                  placeholder="L'autre"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm"
                />
              </div>
            </div>

            {/* Gage pour le perdant */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  Gage officiel pour le perdant
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustom(!isCustom)}
                  className="text-xs text-amber-400 hover:text-amber-300 transition"
                >
                  {isCustom ? "Choisir un preset" : "Gage sur-mesure"}
                </button>
              </div>

              {!isCustom ? (
                <div className="grid grid-cols-1 gap-2">
                  {PRESET_GAGES.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setGage(preset)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs text-left transition ${
                        gage === preset
                          ? "bg-amber-500/10 border-amber-500/50 text-amber-300"
                          : "bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <span>{preset}</span>
                      {gage === preset && <Check className="h-4 w-4 text-amber-400" />}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type="text"
                  value={customGage}
                  onChange={(e) => setCustomGage(e.target.value)}
                  maxLength={GAGE_MAX_LENGTH}
                  placeholder="Ex: Inviter l'autre au restaurant japonais vendredi"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm"
                  required={isCustom}
                />
              )}
            </div>

            {/* CTA Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.99] transition disabled:opacity-50"
            >
              {loading ? (
                <span>Initialisation de l&apos;arbitrage...</span>
              ) : (
                <>
                  <span>Ouvrir le dossier d&apos;arbitrage</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <MyDisputesList />
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-4 text-center text-xs text-zinc-600">
        Arbitrage argumentatif par IA impartiale • Résolution sans humiliation
      </footer>
    </div>
  );
}
