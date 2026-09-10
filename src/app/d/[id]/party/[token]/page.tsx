"use client";

import { useEffect, useState, use, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Scale,
  Shield,
  Send,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Dispute, Party, Plea, ChatMessage } from "@/types/dispute";

export default function PartyWorkspacePage(props: {
  params: Promise<{ id: string; token: string }>;
}) {
  const router = useRouter();
  const { id, token } = use(props.params);

  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [inputMessage, setInputMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [activePlea, setActivePlea] = useState<Plea | null>(null);
  const [rebuttalInput, setRebuttalInput] = useState("");
  const [submittingRebuttal, setSubmittingRebuttal] = useState(false);
  const [submittingPlea, setSubmittingPlea] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchDispute = useCallback(async () => {
    try {
      const res = await fetch(`/api/disputes/${id}`);
      if (res.ok) {
        const data = await res.json();
        const d: Dispute = data.dispute;
        setDispute(d);

        // Déterminer la partie
        const currentParty = d.parties.A.token === token ? d.parties.A : d.parties.B.token === token ? d.parties.B : null;
        if (currentParty?.plea && !activePlea) {
          setActivePlea(currentParty.plea);
        }

        // Si résolu, redirection possible vers le verdict
        if (d.status === "resolved") {
          router.push(`/d/${id}/verdict`);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, token, activePlea, router]);

  useEffect(() => {
    fetchDispute();
    const interval = setInterval(fetchDispute, 3500);
    return () => clearInterval(interval);
  }, [fetchDispute]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dispute?.messages]);

  // Envoi d'un message au coach
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || sendingMessage) return;

    const userText = inputMessage.trim();
    setInputMessage("");
    setSendingMessage(true);

    try {
      const res = await fetch(`/api/disputes/${id}/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, message: userText }),
      });

      const data = await res.json();
      if (res.ok) {
        if (data.extractedPlea) {
          setActivePlea(data.extractedPlea);
        }
        await fetchDispute();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSendingMessage(false);
    }
  };

  // Validation de la plaidoirie
  const handleValidatePlea = async () => {
    if (!activePlea || submittingPlea) return;
    setSubmittingPlea(true);

    try {
      const res = await fetch(`/api/disputes/${id}/plea`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, plea: activePlea }),
      });

      if (res.ok) {
        await fetchDispute();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingPlea(false);
    }
  };

  // Soumission de la réplique
  const handleSendRebuttal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rebuttalInput.trim() || submittingRebuttal) return;
    setSubmittingRebuttal(true);

    try {
      const res = await fetch(`/api/disputes/${id}/rebuttal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, rebuttal: rebuttalInput.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        if (data.verdictReady || data.dispute?.status === "resolved") {
          router.push(`/d/${id}/verdict`);
        } else {
          await fetchDispute();
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingRebuttal(false);
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
        <p className="text-lg font-semibold text-zinc-200">Session introuvable</p>
        <Link href="/" className="mt-4 text-amber-400 text-sm">
          Retour à l&apos;accueil
        </Link>
      </div>
    );
  }

  const isA = dispute.parties.A.token === token;
  const myParty: Party = isA ? dispute.parties.A : dispute.parties.B;
  const opponentParty: Party = isA ? dispute.parties.B : dispute.parties.A;
  const myMessages = dispute.messages.filter((m) => m.partySide === myParty.side);

  const hasSubmittedPlea = !!myParty.plea;
  const opponentSubmittedPlea = !!opponentParty.plea;
  const hasSubmittedRebuttal = !!myParty.rebuttal;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
      {/* Top Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md px-4 sm:px-6 py-3.5 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-200">
                Espace {myParty.name}
              </p>
              <p className="text-[10px] text-zinc-500">IA Avocate dédiée</p>
            </div>
          </div>
          <Link
            href={`/d/${id}`}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition"
          >
            Vue Hub
          </Link>
        </div>
      </header>

      {/* Litige reminder banner */}
      <div className="bg-zinc-900/40 border-b border-zinc-800/40 px-4 py-2 text-center">
        <p className="text-xs text-zinc-400 truncate max-w-xl mx-auto">
          Litige : <span className="text-zinc-200 font-medium">&laquo; {dispute.topic} &raquo;</span>
        </p>
      </div>

      {/* Content Body */}
      <main className="max-w-2xl mx-auto px-4 py-6 w-full flex-1 flex flex-col space-y-6">
        {/* PHASE 1: COACHING CHAT & PLEA DRAFT */}
        {!hasSubmittedPlea && (
          <div className="flex-1 flex flex-col space-y-4">
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 space-y-1">
              <p className="font-semibold text-zinc-200 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                Phase 1 : Cadrage avec ton IA avocate
              </p>
              <p>
                Elle va t&apos;aider à structurer les faits et pointer tes faiblesses avant la confrontation. 3 tours rapides suffisent.
              </p>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 space-y-3 min-h-[260px] max-h-[380px] overflow-y-auto p-3 rounded-2xl bg-zinc-900/40 border border-zinc-800/60">
              {myMessages.length === 0 ? (
                <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300 space-y-2">
                  <p className="font-semibold text-amber-400">
                    Ton avocate personnelle :
                  </p>
                  <p>
                    &laquo; Je suis là pour défendre tes intérêts et monter un dossier solide. Raconte-moi exactement ce qui s&apos;est passé selon toi, de manière factuelle. &raquo;
                  </p>
                </div>
              ) : (
                myMessages.map((msg: ChatMessage) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.sender === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                        msg.sender === "user"
                          ? "bg-amber-500 text-zinc-950 font-medium"
                          : "bg-zinc-800 border border-zinc-700/60 text-zinc-200"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Editable Plea Preview if drafted */}
            {activePlea && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/30 to-zinc-900 border border-emerald-500/30 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Plaidoirie synthétisée par ton avocate
                  </span>
                  <span className="text-[10px] text-zinc-400">À valider</span>
                </div>
                <div className="text-xs space-y-2 text-zinc-300">
                  <p className="italic bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/80">
                    &laquo; {activePlea.summary} &raquo;
                  </p>
                  <div>
                    <span className="font-semibold text-zinc-400 text-[11px]">Faits retenus :</span>
                    <ul className="list-disc list-inside text-zinc-300 space-y-0.5 mt-1">
                      {activePlea.facts.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-400 text-[11px]">Demande concrète :</span>
                    <p className="text-zinc-200 font-medium">{activePlea.demand}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleValidatePlea}
                  disabled={submittingPlea}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs transition flex items-center justify-center gap-2"
                >
                  {submittingPlea ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>Valider cette plaidoirie pour le Juge</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Réponds à ton avocate..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder:text-zinc-500 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
              <button
                type="submit"
                disabled={sendingMessage || !inputMessage.trim()}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {sendingMessage ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            </form>
          </div>
        )}

        {/* PHASE 2: WAITING FOR OPPONENT'S PLEA */}
        {hasSubmittedPlea && !opponentSubmittedPlea && (
          <div className="p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center space-y-4 my-auto">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white">
                Ta plaidoirie est verrouillée
              </h2>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                En attente que <span className="text-zinc-200 font-semibold">{opponentParty.name}</span> termine son coaching. Dès que sa plaidoirie sera prête, la phase de réplique s&apos;ouvrira.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 text-xs text-zinc-500 animate-pulse">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Synchronisation automatique...
            </div>
          </div>
        )}

        {/* PHASE 3: CONFRONTATION & SINGLE REBUTTAL */}
        {hasSubmittedPlea && opponentSubmittedPlea && !hasSubmittedRebuttal && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 space-y-1">
              <p className="font-semibold text-zinc-200 flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5 text-amber-400" />
                Phase 2 : Confrontation & Réplique unique
              </p>
              <p>
                Lis la version officielle de <span className="text-zinc-200 font-medium">{opponentParty.name}</span>. Tu as droit à <strong>UNE seule réplique</strong> pour corriger les inexactitudes factuelles.
              </p>
            </div>

            {/* Opponent's Plea Card */}
            <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                Plaidoirie adverse de {opponentParty.name}
              </span>
              <p className="text-xs italic text-zinc-200 bg-zinc-950 p-3 rounded-xl border border-zinc-800/80">
                &laquo; {opponentParty.plea?.summary} &raquo;
              </p>
              <div className="text-xs space-y-1">
                <p className="font-semibold text-zinc-400 text-[11px]">Faits déclarés :</p>
                <ul className="list-disc list-inside text-zinc-300 space-y-0.5">
                  {opponentParty.plea?.facts.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
              <div className="text-xs pt-1">
                <span className="font-semibold text-zinc-400 text-[11px]">Sa demande : </span>
                <span className="text-zinc-200">{opponentParty.plea?.demand}</span>
              </div>
            </div>

            {/* Rebuttal Input Form */}
            <form onSubmit={handleSendRebuttal} className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-zinc-300">
                    Ta réplique officielle unique
                  </label>
                  <span
                    className={`text-[11px] ${
                      rebuttalInput.length > 500 ? "text-red-400" : "text-zinc-500"
                    }`}
                  >
                    {rebuttalInput.length}/500 caractères
                  </span>
                </div>
                <textarea
                  value={rebuttalInput}
                  onChange={(e) => setRebuttalInput(e.target.value.slice(0, 550))}
                  rows={4}
                  placeholder="Corrige précisément les erreurs de faits. Évite les attaques personnelles, le juge sanctionne la mauvaise foi."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-xs leading-relaxed"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submittingRebuttal || !rebuttalInput.trim()}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submittingRebuttal ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <span>Soumettre ma réplique finale au Juge</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* PHASE 4: REBUTTAL SUBMITTED, WAITING FOR VERDICT */}
        {hasSubmittedRebuttal && dispute.status !== "resolved" && (
          <div className="p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center space-y-4 my-auto">
            <div className="h-12 w-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto animate-pulse">
              <Scale className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white">
                Réplique transmise au Juge
              </h2>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                {!opponentParty.rebuttal
                  ? `En attente de la réplique finale de ${opponentParty.name}...`
                  : "Le Juge IA délibère en toute impartialité. Le verdict sera rendu dans un instant."}
              </p>
            </div>
            <div className="inline-flex items-center gap-2 text-xs text-amber-400/80 animate-pulse">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Délibéré en cours...
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-900 py-3 text-center text-xs text-zinc-600">
        Session privée sécurisée • Aucune fuite d&apos;informations confidentielles
      </footer>
    </div>
  );
}
