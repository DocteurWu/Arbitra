"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PartySide } from "@/types/dispute";

// --- "Mes litiges" : mémorisés dans le navigateur, jamais côté serveur ---

export interface MyDispute {
  id: string;
  topic: string;
  createdAt: string;
  // Présents pour le créateur (accès aux deux liens privés)
  tokenA?: string;
  tokenB?: string;
  // Présents pour une partie qui a ouvert son lien privé
  side?: PartySide;
  token?: string;
}

const STORAGE_KEY = "arbitre:disputes";

export function listMyDisputes(): MyDispute[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as MyDispute[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function getMyDispute(id: string): MyDispute | undefined {
  return listMyDisputes().find((d) => d.id === id);
}

/** Ajoute ou complète un litige mémorisé (les champs existants sont conservés). */
export function rememberDispute(entry: MyDispute): void {
  try {
    const list = listMyDisputes();
    const existing = list.find((d) => d.id === entry.id);
    const merged = { ...existing, ...entry };
    const next = [merged, ...list.filter((d) => d.id !== entry.id)].slice(0, 30);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    notify();
  } catch {
    // Stockage indisponible (navigation privée) : on continue sans mémoriser
  }
}

export function forgetDispute(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(listMyDisputes().filter((d) => d.id !== id)));
    notify();
  } catch {
    // ignore
  }
}

// Abonnement réactif à la liste (useSyncExternalStore évite tout décalage d'hydratation)
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedList: MyDispute[] = [];
const EMPTY: MyDispute[] = [];

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot(): MyDispute[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedList = listMyDisputes();
  }
  return cachedList;
}

export function useMyDisputes(): MyDispute[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

export function partyLink(id: string, token: string): string {
  return `${window.location.origin}/d/${id}/party/${token}`;
}

// --- Chargement + rafraîchissement périodique d'une ressource JSON ---

export interface Polled<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Charge `url` puis la recharge toutes les `intervalMs` tant que `active` est vrai.
 * Les setState ont lieu dans des callbacks asynchrones (jamais en direct dans l'effet).
 */
export function usePolling<T>(
  url: string | null,
  { intervalMs = 3000, active = true, headers }: { intervalMs?: number; active?: boolean; headers?: Record<string, string> } = {}
): Polled<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const headersRef = useRef(headers);

  useEffect(() => {
    headersRef.current = headers;
  });

  const load = useCallback(async () => {
    if (!url) return;
    try {
      const res = await fetch(url, { headers: headersRef.current, cache: "no-store" });
      const json = await res.json();
      if (res.ok) {
        setData(json);
        setError(null);
      } else {
        setError(json.error || "Erreur de chargement");
      }
    } catch {
      setError("Connexion impossible");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const tick = () => {
      if (!cancelled) void load();
    };
    const first = setTimeout(tick, 0);
    const interval = active ? setInterval(tick, intervalMs) : undefined;
    return () => {
      cancelled = true;
      clearTimeout(first);
      if (interval) clearInterval(interval);
    };
  }, [url, active, intervalMs, load]);

  return { data, error, loading, refresh: load };
}

/** POST JSON qui lève une Error lisible si la réponse n'est pas ok. */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Une erreur est survenue, réessaie.");
  return json as T;
}

export const STATUS_LABELS: Record<string, string> = {
  created: "En attente des parties",
  coaching: "Préparation des dossiers",
  rebuttal: "Phase de réplique",
  judging: "Délibéré en cours",
  resolved: "Verdict rendu",
};
