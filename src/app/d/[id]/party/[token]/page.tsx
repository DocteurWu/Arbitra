"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Lock,
  PenLine,
  Plus,
  RefreshCw,
  Scale,
  Send,
  Shield,
  Sparkles,
  Trash2,
} from "lucide-react";
import { ChatMessage, PartyView, Plea } from "@/types/dispute";
import { postJson, rememberDispute, usePolling } from "@/lib/client";
import { COACH_MESSAGE_MAX_LENGTH, REBUTTAL_MAX_LENGTH } from "@/lib/limits";
import { AppHeader, ErrorBanner, FullPageSpinner, PhaseStepper, SimulationBadge } from "@/components/ui";

type PartyData = PartyView & { provider: string };

const FINALIZE_MESSAGE = "Génère ma fiche de plaidoirie maintenant avec ce que je t'ai donné.";

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-sm leading-relaxed";

// --- Fiche de plaidoirie : lecture seule ---

function PleaCard({ plea, title, tone = "zinc" }: { plea: Plea; title: string; tone?: "zinc" | "amber" | "emerald" }) {
  const titleColor = tone === "amber" ? "text-amber-400" : tone === "emerald" ? "text-emerald-400" : "text-zinc-400";
  return (
    <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3 text-sm">
      <span className={`text-[11px] font-bold uppercase tracking-wider ${titleColor}`}>{title}</span>
      <p className="italic text-zinc-200 bg-zinc-950 p-3 rounded-xl border border-zinc-800/80">&laquo; {plea.summary} &raquo;</p>
      <div>
        <p className="font-semibold text-zinc-400 text-[11px] uppercase tracking-wide">Faits</p>
        <ul className="list-disc pl-5 text-zinc-300 space-y-1 mt-1">
          {plea.facts.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </div>
      <p>
        <span className="font-semibold text-zinc-400 text-[11px] uppercase tracking-wide">Demande · </span>
        <span className="text-zinc-200">{plea.demand}</span>
      </p>
      {plea.concession && (
        <p>
          <span className="font-semibold text-zinc-400 text-[11px] uppercase tracking-wide">Concession · </span>
          <span className="text-zinc-200">{plea.concession}</span>
        </p>
      )}
    </div>
  );
}

// --- Fiche de plaidoirie : édition avant dépôt ---

function PleaEditor({
  draft,
  onChange,
  onSubmit,
  submitting,
}: {
  draft: Plea;
  onChange: (plea: Plea) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const set = <K extends keyof Plea>(key: K, value: Plea[K]) => onChange({ ...draft, [key]: value });
  const setFact = (i: number, value: string) => set("facts", draft.facts.map((f, j) => (j === i ? value : f)));
  const filledFacts = draft.facts.filter((f) => f.trim());
  const isValid = draft.summary.trim().length >= 5 && filledFacts.length > 0 && draft.demand.trim().length >= 3;

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-950/30 to-zinc-900 border border-emerald-500/30 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
          <PenLine className="h-4 w-4" />
          Ta fiche de plaidoirie
        </span>
        <span className="text-[10px] text-zinc-400">Modifiable jusqu&apos;au dépôt</span>
      </div>

      <label className="block space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Résumé de ta position</span>
        <textarea value={draft.summary} onChange={(e) => set("summary", e.target.value)} rows={3} maxLength={800} className={inputClass} />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 mb-1.5">Faits vérifiables</legend>
        {draft.facts.map((fact, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={fact}
              onChange={(e) => setFact(i, e.target.value)}
              maxLength={300}
              placeholder={`Fait n°${i + 1} : date, action observable…`}
              aria-label={`Fait ${i + 1}`}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => set("facts", draft.facts.filter((_, j) => j !== i))}
              disabled={draft.facts.length <= 1}
              aria-label={`Supprimer le fait ${i + 1}`}
              className="px-2.5 rounded-xl border border-zinc-800 text-zinc-500 hover:text-red-300 hover:border-red-800/60 transition disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {draft.facts.length < 8 && (
          <button
            type="button"
            onClick={() => set("facts", [...draft.facts, ""])}
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter un fait
          </button>
        )}
      </fieldset>

      <label className="block space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Ta demande</span>
        <textarea value={draft.demand} onChange={(e) => set("demand", e.target.value)} rows={2} maxLength={400} className={inputClass} />
      </label>

      <label className="block space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
          Ce que tu es prêt(e) à concéder <span className="normal-case font-normal text-zinc-500">(le juge valorise la bonne foi)</span>
        </span>
        <textarea
          value={draft.concession ?? ""}
          onChange={(e) => set("concession", e.target.value)}
          rows={2}
          maxLength={400}
          className={inputClass}
        />
      </label>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={!isValid}
          className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm transition flex items-center justify-center gap-2 disabled:opacity-40"
        >
          Déposer cette plaidoirie
          <ArrowRight className="h-4 w-4" />
        </button>
      ) : (
        <div className="p-3 rounded-xl bg-zinc-950/80 border border-emerald-500/30 space-y-3">
          <p className="text-xs text-zinc-300 flex items-start gap-2">
            <Lock className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            Une fois déposée, ta plaidoirie est verrouillée et sera montrée à l&apos;autre partie quand elle aura déposé la sienne.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 text-xs font-semibold hover:bg-zinc-800 transition"
            >
              Relire encore
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Confirmer le dépôt"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Bulles de chat ---

function Bubble({ sender, children, pending }: { sender: ChatMessage["sender"]; children: React.ReactNode; pending?: boolean }) {
  const mine = sender === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          mine ? "bg-amber-500 text-zinc-950 rounded-br-md" : "bg-zinc-800 border border-zinc-700/60 text-zinc-200 rounded-bl-md"
        } ${pending ? "opacity-70" : ""}`}
      >
        {children}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start" aria-label="L'avocate rédige sa réponse">
      <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-zinc-800 border border-zinc-700/60 flex gap-1">
        {[0, 150, 300].map((delay) => (
          <span key={delay} className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
        ))}
      </div>
    </div>
  );
}

const emptyPlea = (): Plea => ({ summary: "", facts: ["", ""], demand: "", concession: "" });

export default function PartyWorkspacePage(props: { params: Promise<{ id: string; token: string }> }) {
  const router = useRouter();
  const { id, token } = use(props.params);
  const headers = useMemo(() => ({ "x-party-token": token }), [token]);

  const [resolved, setResolved] = useState(false);
  const { data, error: loadError, loading, refresh } = usePolling<PartyData>(`/api/disputes/${id}/party`, {
    headers,
    intervalMs: 3500,
    active: !resolved,
  });

  const [input, setInput] = useState("");
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<Plea | null>(null);
  const [rebuttal, setRebuttal] = useState("");
  const [confirmRebuttal, setConfirmRebuttal] = useState(false);
  const [busy, setBusy] = useState<"coach" | "plea" | "rebuttal" | "judge" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const dispute = data?.dispute;

  useEffect(() => {
    if (!data) return;
    rememberDispute({
      id: data.dispute.id,
      topic: data.dispute.topic,
      createdAt: data.dispute.createdAt,
      side: data.me.side,
      token,
    });
    if (data.dispute.status === "resolved") {
      const timer = setTimeout(() => setResolved(true), 0);
      router.replace(`/d/${id}/verdict`);
      return () => clearTimeout(timer);
    }
  }, [data, id, token, router]);

  const messageCount = data?.messages.length ?? 0;
  const hasDraft = draft !== null;
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messageCount, pendingMessage, hasDraft]);

  const sendToCoach = async (text: string, finalize = false) => {
    if (!text.trim() || busy) return;
    setBusy("coach");
    setError(null);
    setPendingMessage(text);
    setInput("");
    try {
      const res = await postJson<{ extractedPlea: Plea | null }>(`/api/disputes/${id}/coach`, {
        token,
        message: text,
        finalize,
      });
      if (res.extractedPlea) {
        setDraft({ ...res.extractedPlea, concession: res.extractedPlea.concession ?? "" });
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur, réessaie.");
      setInput(text);
    } finally {
      setPendingMessage(null);
      setBusy(null);
    }
  };

  const submitPlea = async () => {
    if (!draft || busy) return;
    setBusy("plea");
    setError(null);
    try {
      await postJson(`/api/disputes/${id}/plea`, { token, plea: draft });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur, réessaie.");
    } finally {
      setBusy(null);
    }
  };

  const submitRebuttal = async () => {
    if (!rebuttal.trim() || busy) return;
    setBusy("rebuttal");
    setError(null);
    try {
      const res = await postJson<{ verdictReady: boolean }>(`/api/disputes/${id}/rebuttal`, { token, rebuttal });
      if (res.verdictReady) {
        router.push(`/d/${id}/verdict`);
        return;
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur, réessaie.");
      setConfirmRebuttal(false);
    } finally {
      setBusy(null);
    }
  };

  const retryJudge = async () => {
    setBusy("judge");
    setError(null);
    try {
      await postJson(`/api/disputes/${id}/judge`, {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'arbitrage");
    } finally {
      await refresh();
      setBusy(null);
    }
  };

  if (loading && !data) return <FullPageSpinner />;

  if (!data || !dispute) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 p-4 text-center">
        <p className="text-lg font-semibold text-zinc-200">{loadError || "Espace introuvable"}</p>
        <p className="text-xs text-zinc-500 mt-1">Vérifie que tu utilises bien le lien privé complet.</p>
        <Link href="/" className="mt-4 text-amber-400 text-sm">
          Retour à l&apos;accueil
        </Link>
      </div>
    );
  }

  const { me, opponent, messages } = data;
  const hasPlea = !!me.plea;
  const hasRebuttal = me.rebuttal !== null;
  const userTurns = messages.filter((m) => m.sender === "user").length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-amber-500 selection:text-black">
      <AppHeader
        right={
          <div className="flex items-center gap-2">
            <SimulationBadge provider={data.provider} />
            <span className="text-xs text-zinc-400 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-emerald-400" />
              Espace de <span className="text-zinc-200 font-semibold">{me.name}</span>
            </span>
          </div>
        }
      />

      <main className="max-w-2xl mx-auto px-4 py-6 w-full flex-1 flex flex-col gap-5">
        <div className="space-y-3">
          <p className="text-xs text-zinc-400">
            Litige face à <span className="text-zinc-200 font-semibold">{opponent.name}</span> :{" "}
            <span className="text-zinc-200">&laquo; {dispute.topic} &raquo;</span>
          </p>
          <PhaseStepper status={dispute.status} />
        </div>

        {error && <ErrorBanner message={error} />}

        {/* PHASE 1 : COACHING + FICHE */}
        {!hasPlea && (
          <div className="flex-1 flex flex-col gap-4">
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 space-y-1">
              <p className="font-semibold text-zinc-200 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                Prépare ton dossier avec ton avocate IA
              </p>
              <p>
                Elle structure les faits et pointe tes faiblesses avant la confrontation. Personne d&apos;autre ne voit cette conversation.
              </p>
            </div>

            <div className="space-y-3 min-h-[240px] max-h-[50vh] overflow-y-auto p-3 rounded-2xl bg-zinc-900/40 border border-zinc-800/60" aria-live="polite">
              <Bubble sender="coach">
                Je défends tes intérêts face à {opponent.name}. Raconte-moi ce qui s&apos;est passé, de manière factuelle : quand, qui a fait quoi ?
              </Bubble>
              {messages.map((msg) => (
                <Bubble key={msg.id} sender={msg.sender}>
                  {msg.content}
                </Bubble>
              ))}
              {pendingMessage && (
                <>
                  <Bubble sender="user" pending>
                    {pendingMessage}
                  </Bubble>
                  <TypingBubble />
                </>
              )}
              <div ref={chatEndRef} />
            </div>

            {draft ? (
              <PleaEditor draft={draft} onChange={setDraft} onSubmit={submitPlea} submitting={busy === "plea"} />
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => sendToCoach(FINALIZE_MESSAGE, true)}
                  disabled={userTurns === 0 || !!busy}
                  title={userTurns === 0 ? "Explique d'abord ta version à ton avocate" : undefined}
                  className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20 transition flex items-center gap-1.5 disabled:opacity-40"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Générer ma fiche maintenant
                </button>
                <button
                  type="button"
                  onClick={() => setDraft(emptyPlea())}
                  className="px-3 py-2 rounded-xl border border-zinc-800 text-zinc-400 text-xs font-medium hover:text-zinc-200 hover:border-zinc-700 transition flex items-center gap-1.5"
                >
                  <PenLine className="h-3.5 w-3.5" />
                  Rédiger moi-même
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendToCoach(input);
              }}
              className="flex gap-2 items-end"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    sendToCoach(input);
                  }
                }}
                rows={2}
                maxLength={COACH_MESSAGE_MAX_LENGTH}
                aria-label="Message à ton avocate"
                placeholder={draft ? "Demande une modification à ton avocate…" : "Réponds à ton avocate… (Entrée pour envoyer)"}
                className={`${inputClass} resize-none`}
              />
              <button
                type="submit"
                disabled={!!busy || !input.trim()}
                aria-label="Envoyer"
                className="h-11 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold transition disabled:opacity-50 flex items-center"
              >
                {busy === "coach" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
          </div>
        )}

        {/* PHASE 2 : ATTENTE DE LA PLAIDOIRIE ADVERSE */}
        {hasPlea && !opponent.hasPlea && (
          <div className="space-y-5">
            <div className="p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-bold text-white">Ta plaidoirie est déposée</h2>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  En attente de celle de <span className="text-zinc-200 font-semibold">{opponent.name}</span>. La phase de réplique s&apos;ouvrira
                  automatiquement.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Synchronisation automatique…
              </div>
            </div>
            <PleaCard plea={me.plea!} title="Ta plaidoirie déposée" tone="emerald" />
          </div>
        )}

        {/* PHASE 3 : CONFRONTATION ET RÉPLIQUE UNIQUE */}
        {hasPlea && opponent.hasPlea && !hasRebuttal && opponent.plea && (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 space-y-1">
              <p className="font-semibold text-zinc-200 flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5 text-amber-400" />
                Confrontation : une seule réplique
              </p>
              <p>Lis la version de {opponent.name} et corrige précisément ses inexactitudes. Le juge sanctionne les attaques personnelles.</p>
            </div>

            <PleaCard plea={opponent.plea} title={`Plaidoirie de ${opponent.name}`} tone="amber" />

            <details className="group rounded-2xl border border-zinc-800 bg-zinc-900/40">
              <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-zinc-400 hover:text-zinc-200">
                Revoir ma propre plaidoirie
              </summary>
              <div className="px-2 pb-2">
                <PleaCard plea={me.plea!} title="Ma plaidoirie" tone="emerald" />
              </div>
            </details>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label htmlFor="rebuttal" className="font-semibold text-zinc-300">
                  Ta réplique unique
                </label>
                <span className={rebuttal.length > REBUTTAL_MAX_LENGTH * 0.9 ? "text-amber-400" : "text-zinc-500"}>
                  {rebuttal.length}/{REBUTTAL_MAX_LENGTH}
                </span>
              </div>
              <textarea
                id="rebuttal"
                value={rebuttal}
                onChange={(e) => setRebuttal(e.target.value)}
                maxLength={REBUTTAL_MAX_LENGTH}
                rows={5}
                placeholder="Ex : « Le message de 19h ne parlait pas des poubelles, seulement d'un retard. »"
                className={inputClass}
              />
            </div>

            {!confirmRebuttal ? (
              <button
                type="button"
                onClick={() => setConfirmRebuttal(true)}
                disabled={!rebuttal.trim()}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                Soumettre ma réplique au juge
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-zinc-900 border border-amber-500/30 space-y-3">
                <p className="text-xs text-zinc-300">C&apos;est ta seule réplique : elle ne pourra plus être modifiée.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmRebuttal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 text-xs font-semibold hover:bg-zinc-800 transition"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={submitRebuttal}
                    disabled={busy === "rebuttal"}
                    className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {busy === "rebuttal" ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        {opponent.hasRebuttal ? "Le juge délibère…" : "Envoi…"}
                      </>
                    ) : (
                      "Confirmer l'envoi"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {dispute.status === "resolved" && (
          <Link
            href={`/d/${id}/verdict`}
            className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-center text-sm font-semibold text-amber-300 flex items-center justify-center gap-2"
          >
            Le verdict est rendu
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}

        {/* PHASE 4 : EN ATTENTE DU VERDICT */}
        {hasRebuttal && dispute.status !== "resolved" && (
          <div className="p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto animate-pulse">
              <Scale className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white">Réplique transmise</h2>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                {!opponent.hasRebuttal
                  ? `En attente de la réplique de ${opponent.name}…`
                  : dispute.verdictError
                    ? "L'arbitre a rencontré un problème."
                    : "L'arbitre délibère en toute impartialité. Le verdict arrive dans un instant."}
              </p>
            </div>
            {dispute.verdictError ? (
              <div className="space-y-2 text-left">
                <ErrorBanner message={dispute.verdictError} />
                <button
                  type="button"
                  onClick={retryJudge}
                  disabled={busy === "judge"}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${busy === "judge" ? "animate-spin" : ""}`} />
                  Relancer l&apos;arbitrage
                </button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 text-xs text-amber-400/80">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Synchronisation automatique…
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-900 py-3 text-center text-xs text-zinc-600">
        Espace privé · ne partage pas ce lien
      </footer>
    </div>
  );
}
