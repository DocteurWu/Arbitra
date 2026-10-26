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
import { adminClient, isAuthEnabled } from "@/lib/supabase/server";
import { COACH_MESSAGES_PER_PARTY } from "@/lib/limits";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "disputes.json");

// Erreur métier : message affichable tel quel, avec un code HTTP associé
export class DisputeError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// --- Backends : fichier JSON (dev local) ou Postgres via Supabase (production) ---

interface Backend {
  get(id: string): Promise<Dispute | null>;
  insert(dispute: Dispute): Promise<void>;
  /** Applique `fn` de façon atomique et renvoie le litige modifié. `fn` peut lever une DisputeError. */
  mutate(id: string, fn: (dispute: Dispute) => void): Promise<Dispute>;
  listByOwner(ownerId: string): Promise<Dispute[]>;
}

// Cache mémoire + fichier, écritures sérialisées
function createFileBackend(): Backend {
  let memoryCache: Record<string, Dispute> | null = null;
  let initPromise: Promise<void> | null = null;
  let writeQueue: Promise<unknown> = Promise.resolve();

  const withLock = <T,>(fn: () => Promise<T>): Promise<T> => {
    const run = writeQueue.then(fn, fn);
    writeQueue = run.catch(() => undefined);
    return run;
  };

  const init = async () => {
    if (!initPromise) {
      initPromise = (async () => {
        try {
          await fs.mkdir(DATA_DIR, { recursive: true });
          memoryCache = JSON.parse(await fs.readFile(DATA_FILE, "utf-8"));
        } catch {
          memoryCache = {};
        }
      })();
    }
    await initPromise;
  };

  const persist = async () => {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const tempFile = `${DATA_FILE}.tmp.${process.pid}.${Date.now()}`;
      await fs.writeFile(tempFile, JSON.stringify(memoryCache, null, 2), "utf-8");
      await fs.rename(tempFile, DATA_FILE);
    } catch (err) {
      console.error("Storage persistence error:", err);
    }
  };

  return {
    async get(id) {
      await init();
      return memoryCache![id] || null;
    },
    async insert(dispute) {
      await init();
      return withLock(async () => {
        memoryCache![dispute.id] = dispute;
        await persist();
      });
    },
    async mutate(id, fn) {
      await init();
      return withLock(async () => {
        const dispute = memoryCache![id];
        if (!dispute) throw new DisputeError("Litige introuvable", 404);
        fn(dispute);
        await persist();
        return dispute;
      });
    },
    async listByOwner(ownerId) {
      await init();
      return Object.values(memoryCache!).filter((d) => d.ownerId === ownerId);
    },
  };
}

// Postgres : un litige = une ligne JSONB, avec verrou optimiste sur `version`
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createSupabaseBackend(): Backend {
  const table = () => adminClient().from("disputes");

  return {
    async get(id) {
      // Un identifiant mal formé ne peut pas exister (et ferait échouer la requête Postgres)
      if (!UUID_RE.test(id)) return null;
      const { data, error } = await table().select("data").eq("id", id).maybeSingle();
      if (error) throw new Error(`Lecture du litige impossible : ${error.message}`);
      return (data?.data as Dispute) ?? null;
    },
    async insert(dispute) {
      const { error } = await table().insert({ id: dispute.id, owner_id: dispute.ownerId ?? null, data: dispute });
      if (error) throw new Error(`Création du litige impossible : ${error.message}`);
    },
    async mutate(id, fn) {
      if (!UUID_RE.test(id)) throw new DisputeError("Litige introuvable", 404);
      for (let attempt = 0; attempt < 6; attempt++) {
        const { data, error } = await table().select("data, version").eq("id", id).maybeSingle();
        if (error) throw new Error(`Lecture du litige impossible : ${error.message}`);
        if (!data) throw new DisputeError("Litige introuvable", 404);

        const dispute = data.data as Dispute;
        fn(dispute);

        const { data: updated, error: updateError } = await table()
          .update({ data: dispute, version: data.version + 1 })
          .eq("id", id)
          .eq("version", data.version)
          .select("id");
        if (updateError) throw new Error(`Écriture du litige impossible : ${updateError.message}`);
        if (updated && updated.length > 0) return dispute;
        // Quelqu'un a écrit entre-temps : on relit et on réapplique
      }
      throw new DisputeError("Le litige est très sollicité, réessaie dans un instant.", 409);
    },
    async listByOwner(ownerId) {
      const { data, error } = await table().select("data").eq("owner_id", ownerId).order("created_at", { ascending: false });
      if (error) throw new Error(`Lecture des litiges impossible : ${error.message}`);
      return (data ?? []).map((row) => row.data as Dispute);
    },
  };
}

let backend: Backend | null = null;
function store(): Backend {
  if (!backend) backend = isAuthEnabled() ? createSupabaseBackend() : createFileBackend();
  return backend;
}

// --- Litiges ---

function generateToken(): string {
  return crypto.randomBytes(16).toString("hex");
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
  nameB = "Partie B",
  ownerId: string | null = null,
  id: string = crypto.randomUUID()
): Promise<{ dispute: Dispute; tokenA: string; tokenB: string }> {
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
    ownerId,
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

  await store().insert(dispute);
  return { dispute, tokenA, tokenB };
}

export async function getDispute(id: string): Promise<Dispute | null> {
  return store().get(id);
}

export async function listDisputesByOwner(ownerId: string): Promise<Dispute[]> {
  return store().listByOwner(ownerId);
}

/** Résout un litige et le camp associé au token, ou lève une DisputeError. */
export async function authenticateParty(
  id: string,
  token: string | null | undefined
): Promise<{ dispute: Dispute; side: PartySide }> {
  const dispute = await store().get(id);
  if (!dispute) throw new DisputeError("Litige introuvable", 404);
  const side = sideForToken(dispute, token);
  if (!side) throw new DisputeError("Lien d'accès invalide", 403);
  return { dispute, side };
}

export function messagesLeft(dispute: Dispute, side: PartySide): number {
  const used = dispute.messages.filter((m) => m.partySide === side && m.sender === "user").length;
  return Math.max(0, COACH_MESSAGES_PER_PARTY - used);
}

/** Enregistre l'échange (message de l'utilisateur + réponse de l'avocate) en une seule écriture. */
export async function addExchange(
  disputeId: string,
  partySide: PartySide,
  userContent: string,
  coachContent: string
): Promise<Dispute> {
  return store().mutate(disputeId, (dispute) => {
    if (dispute.parties[partySide].plea) {
      throw new DisputeError("Ta plaidoirie est déjà verrouillée.", 409);
    }
    if (messagesLeft(dispute, partySide) <= 0) {
      throw new DisputeError("Tu as utilisé tous tes messages pour ce litige. Dépose ta plaidoirie.", 429);
    }
    const now = new Date().toISOString();
    dispute.messages.push(
      { id: crypto.randomUUID(), partySide, sender: "user", content: userContent, createdAt: now },
      { id: crypto.randomUUID(), partySide, sender: "coach", content: coachContent, createdAt: now }
    );
    if (dispute.status === "created") dispute.status = "coaching";
  });
}

export async function getMessagesForParty(disputeId: string, partySide: PartySide): Promise<ChatMessage[]> {
  const dispute = await store().get(disputeId);
  if (!dispute) return [];
  return dispute.messages.filter((m) => m.partySide === partySide);
}

export async function savePlea(disputeId: string, partySide: PartySide, plea: Plea): Promise<Dispute> {
  return store().mutate(disputeId, (dispute) => {
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
  });
}

export async function saveRebuttal(disputeId: string, partySide: PartySide, rebuttalText: string): Promise<Dispute> {
  return store().mutate(disputeId, (dispute) => {
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
  });
}

export async function saveVerdict(disputeId: string, verdict: Verdict): Promise<Dispute> {
  return store().mutate(disputeId, (dispute) => {
    dispute.verdict = verdict;
    dispute.verdictError = null;
    dispute.status = "resolved";
  });
}

export async function saveVerdictError(disputeId: string, message: string): Promise<Dispute> {
  return store().mutate(disputeId, (dispute) => {
    dispute.verdictError = message;
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
      messagesLeft: messagesLeft(dispute, side),
    },
    opponent: toPublicParty(dispute, side === "A" ? "B" : "A"),
    messages: dispute.messages.filter((m) => m.partySide === side),
  };
}
