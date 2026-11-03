"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, Share, X } from "lucide-react";

// Événement Chrome/Edge/Android : permet de déclencher la fenêtre d'installation
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Hint = "inapp" | "ios" | "mac-safari" | null;

const DISMISS_KEY = "arbitre:install-dismissed";

// Navigateurs intégrés des réseaux sociaux : impossible d'y installer une app
const IN_APP_BROWSER = /TikTok|musical_ly|Instagram|FBAN|FBAV|Snapchat|Line\/|Twitter/i;

function detectHint(): Hint {
  const ua = navigator.userAgent;
  if (IN_APP_BROWSER.test(ua)) return "inapp";
  const isIos = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg/.test(ua);
  if (isIos) return "ios";
  if (isSafari && /Macintosh/.test(ua)) return "mac-safari";
  return null;
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Invite à installer l'app : bouton natif (Android, Chrome, Edge) ou explication courte (iPhone, Safari, TikTok). */
export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [hint, setHint] = useState<Hint>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setEvent(null);
      setHidden(true);
    };

    // Détection du navigateur après le premier rendu (évite tout décalage d'hydratation)
    const timer = setTimeout(() => {
      let dismissed = false;
      try {
        dismissed = localStorage.getItem(DISMISS_KEY) === "1";
      } catch {
        // stockage indisponible : on affiche quand même
      }
      setHint(detectHint());
      setHidden(dismissed || isStandalone());
    }, 0);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  };

  const install = async () => {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    setEvent(null);
    if (outcome === "accepted") setHidden(true);
  };

  if (hidden || (!event && !hint)) return null;

  return (
    <div className="mb-6 p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-start gap-3 text-xs">
      <span className="mt-0.5 shrink-0 h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
        {hint === "inapp" ? <ExternalLink className="h-4 w-4" /> : hint === "ios" || hint === "mac-safari" ? <Share className="h-4 w-4" /> : <Download className="h-4 w-4" />}
      </span>

      <div className="flex-1 min-w-0 space-y-1.5">
        {hint === "inapp" ? (
          <>
            <p className="font-semibold text-zinc-200">Installe L&apos;Arbitre sur ton téléphone</p>
            <p className="text-zinc-400">
              Tu es dans le navigateur intégré à l&apos;application que tu utilises : appuie sur <strong>•••</strong> (ou sur l&apos;icône de partage) puis sur{" "}
              <strong>« Ouvrir dans le navigateur »</strong>, et l&apos;installation sera proposée.
            </p>
          </>
        ) : event ? (
          <>
            <p className="font-semibold text-zinc-200">Installe L&apos;Arbitre comme une vraie app</p>
            <p className="text-zinc-400">Une icône sur ton écran, plein écran, accès en un tap. Gratuit, sans magasin d&apos;applications.</p>
            <button
              type="button"
              onClick={install}
              className="mt-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold transition"
            >
              Installer l&apos;app
            </button>
          </>
        ) : hint === "ios" ? (
          <>
            <p className="font-semibold text-zinc-200">Installe L&apos;Arbitre sur ton iPhone</p>
            <p className="text-zinc-400">
              Dans Safari, appuie sur <strong>Partager</strong>, puis sur <strong>« Sur l&apos;écran d&apos;accueil »</strong>.
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold text-zinc-200">Installe L&apos;Arbitre sur ton Mac</p>
            <p className="text-zinc-400">
              Dans Safari : menu <strong>Fichier</strong> puis <strong>« Ajouter au Dock »</strong>.
            </p>
          </>
        )}
      </div>

      <button type="button" onClick={dismiss} aria-label="Masquer" className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
