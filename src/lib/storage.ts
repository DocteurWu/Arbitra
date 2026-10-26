import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import {
  Dispute,
  Party,
  PartySide,
  PartyView,
  Plea,
  ChatMessage,
  PublicDispute,
  PublicParty,
  Verdict,
} from "@/types/dispute";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "disputes.json");

// Erreur métier : message affichable tel quel, avec un code HTTP associé
export class DisputeError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// In-memory cache for fast access
let memoryCache: Record<string, Dispute> | null = null;
let initPromise: Promise<void> | null = null;

// File d'attente : toutes les mutations sont sérialisées pour éviter
// les écritures concurrentes (deux répliques simultanées, par ex.)
let writeQueue: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(fn, fn);
  writeQueue = run.catch(() => undefined);
  return run;
}

async function ensureStorageInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const content = await fs.readFile(DATA_FILE, "utf-8");
        memoryCache = JSON.parse(content);
      } catch {
        memoryCache = {};
      }
    })();
  }
  await initPromise;
}

async function persistToDisk(): Promise<void> {
  if (!memoryCache) return;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tempFile = `${DATA_FILE}.tmp.${process.pid}.${Date.now()}`;
    await fs.writeFile(tempFile, JSON.stringify(memoryCache, null, 2), "utf-8");
    await fs.rename(tempFile, DATA_FILE);
  } catch (err) {
    console.error("Storage persistence error:", err);
  }
}

function generateToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

function requireDispute(id: string): Dispute {
  const dispute = memoryCache![id];
  if (!dispute) throw new DisputeError("Litige introuvable", 404);
  return dispute;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

/** Retrouve le camp correspondant à un token, ou null si le token est invalide. */
export function sideForToken(dispute: Dispute, token: string | null | undefined): PartySide | null {
  if (!token) return null;
  if (safeEqual(dispute.parties.A.token, token)) return "A";
  if (safeEqual(dispute.parties.B.token, token)) return "B";
  return null;
}

export async function createDispute(
  topic: string,
  gage: string,
  nameA = "Partie A",
  nameB = "Partie B"
): Promise<{ dispute: Dispute; tokenA: string; tokenB: string }> {
  await ensureStorageInitialized();

  return withLock(async () => {
    const id = crypto.randomUUID();
    const tokenA = generateToken();
    const tokenB = generateToken();

    const makeParty = (side: PartySide, name: string, token: string): Party => ({
      side,
      name,
      token,
      plea: null,
      rebuttal: null,
      readyForRebuttal: false,
    });

    const dispute: Dispute = {
      id,
      topic,
      gage,
      status: "created",
      createdAt: new Date().toISOString(),
      parties: {
        A: makeParty("A", nameA, tokenA),
        B: makeParty("B", nameB, tokenB),
      },
      messages: [],
      verdict: null,
      verdictError: null,
    };

    memoryCache![id] = dispute;
    await persistToDisk();

    return { dispute, tokenA, tokenB };
  });
}

export async function getDispute(id: string): Promise<Dispute | null> {
  await ensureStorageInitialized();
  return memoryCache![id] || null;
}

/** Résout un litige et le camp associé au token, ou lève une DisputeError. */
export async function authenticateParty(
  id: string,
  token: string | null | undefined
): Promise<{ dispute: Dispute; side: PartySide }> {
  await ensureStorageInitialized();
  const dispute = requireDispute(id);
  const side = sideForToken(dispute, token);
  if (!side) throw new DisputeError("Lien d'accès invalide", 403);
  return { dispute, side };
}

export async function addMessage(
  disputeId: string,
  partySide: PartySide,
  sender: "user" | "coach",
  content: string
): Promise<ChatMessage> {
  await ensureStorageInitialized();

  return withLock(async () => {
    const dispute = requireDispute(disputeId);
    if (dispute.parties[partySide].plea) {
      throw new DisputeError("Ta plaidoirie est déjà verrouillée.", 409);
    }

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      partySide,
      sender,
      content,
      createdAt: new Date().toISOString(),
    };

    dispute.messages.push(message);

    if (dispute.status === "created") {
      dispute.status = "coaching";
    }

    await persistToDisk();
    return message;
  });
}

export async function getMessagesForParty(
  disputeId: string,
  partySide: PartySide
): Promise<ChatMessage[]> {
  await ensureStorageInitialized();
  const dispute = memoryCache![disputeId];
  if (!dispute) return [];
  return dispute.messages.filter((m) => m.partySide === partySide);
}

export async function savePlea(
  disputeId: string,
  partySide: PartySide,
  plea: Plea
): Promise<Dispute> {
  await ensureStorageInitialized();

  return withLock(async () => {
    const dispute = requireDispute(disputeId);
    if (dispute.parties[partySide].plea) {
      throw new DisputeError("Ta plaidoirie a déjà été déposée.", 409);
    }

    dispute.parties[partySide].plea = {
      summary: plea.summary.trim(),
      facts: plea.facts.map((f) => f.trim()).filter(Boolean),
      demand: plea.demand.trim(),
      concession: plea.concession?.trim() || undefined,
      submittedAt: new Date().toISOString(),
    };
    dispute.parties[partySide].readyForRebuttal = true;

    if (dispute.status === "created") dispute.status = "coaching";

    // Si les deux parties ont soumis leur plaidoirie, on bascule en 'rebuttal'
    if (dispute.parties.A.plea && dispute.parties.B.plea) {
      dispute.status = "rebuttal";
    }

    await persistToDisk();
    return dispute;
  });
}

export async function saveRebuttal(
  disputeId: string,
  partySide: PartySide,
  rebuttalText: string
): Promise<Dispute> {
  await ensureStorageInitialized();

  return withLock(async () => {
    const dispute = requireDispute(disputeId);
    if (dispute.status !== "rebuttal") {
      throw new DisputeError("La phase de réplique n'est pas ouverte.", 409);
    }
    if (dispute.parties[partySide].rebuttal !== null) {
      throw new DisputeError("Tu as déjà utilisé ta réplique unique.", 409);
    }

    dispute.parties[partySide].rebuttal = rebuttalText.trim();

    // Si les deux ont répondu, on passe à 'judging'
    if (dispute.parties.A.rebuttal !== null && dispute.parties.B.rebuttal !== null) {
      dispute.status = "judging";
    }

    await persistToDisk();
    return dispute;
  });
}

export async function saveVerdict(disputeId: string, verdict: Verdict): Promise<Dispute> {
  await ensureStorageInitialized();

  return withLock(async () => {
    const dispute = requireDispute(disputeId);
    dispute.verdict = verdict;
    dispute.verdictError = null;
    dispute.status = "resolved";
    await persistToDisk();
    return dispute;
  });
}

export async function saveVerdictError(disputeId: string, message: string): Promise<Dispute> {
  await ensureStorageInitialized();

  return withLock(async () => {
    const dispute = requireDispute(disputeId);
    dispute.verdictError = message;
    await persistToDisk();
    return dispute;
  });
}

// --- Projections publiques ---

const REVEALED_STATUSES = new Set(["rebuttal", "judging", "resolved"]);

function toPublicParty(dispute: Dispute, side: PartySide): PublicParty {
  const party = dispute.parties[side];
  return {
    side,
    name: party.name,
    hasPlea: !!party.plea,
    hasRebuttal: party.rebuttal !== null,
    plea: REVEALED_STATUSES.has(dispute.status) ? party.plea : null,
    rebuttal: dispute.status === "resolved" ? party.rebuttal : null,
  };
}

/** Vue sûre d'un litige : ni tokens, ni échanges privés avec les avocates. */
export function toPublicDispute(dispute: Dispute): PublicDispute {
  return {
    id: dispute.id,
    topic: dispute.topic,
    gage: dispute.gage,
    status: dispute.status,
    createdAt: dispute.createdAt,
    parties: {
      A: toPublicParty(dispute, "A"),
      B: toPublicParty(dispute, "B"),
    },
    verdict: dispute.verdict,
    verdictError: dispute.verdictError ?? null,
  };
}

/** Vue d'une partie : son propre dossier complet + la vue publique de l'adversaire. */
export function toPartyView(dispute: Dispute, side: PartySide): PartyView {
  const me = dispute.parties[side];
  return {
    dispute: toPublicDispute(dispute),
    me: {
      side,
      name: me.name,
      plea: me.plea,
      rebuttal: me.rebuttal,
    },
    opponent: toPublicParty(dispute, side === "A" ? "B" : "A"),
    messages: dispute.messages.filter((m) => m.partySide === side),
  };
}
