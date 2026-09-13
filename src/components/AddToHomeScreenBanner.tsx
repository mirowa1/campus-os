"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "coursework_a2hs_dismissed";
const MOBILE_MQ = "(max-width: 1024px)";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true
  );
}

function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\//.test(ua);
  return iOS && webkit && !otherBrowser;
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Safari-style share: square with upward arrow (not a refresh glyph). */
function SafariShareIcon() {
  return (
    <svg
      className="a2hs-share-icon"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M12 3.2a.9.9 0 0 1 .9.9v8.2a.9.9 0 1 1-1.8 0V4.1a.9.9 0 0 1 .9-.9Z"
      />
      <path
        fill="currentColor"
        d="M8.1 6.35a.9.9 0 0 1 1.27-.05L12 8.75l2.63-2.45a.9.9 0 1 1 1.22 1.32l-3.24 3.02a.9.9 0 0 1-1.22 0L8.15 7.62a.9.9 0 0 1-.05-1.27Z"
      />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M6.5 10.2a.9.9 0 0 1 .9.9v6.4c0 .55.45 1 1 1h7.2c.55 0 1-.45 1-1v-6.4a.9.9 0 1 1 1.8 0v6.4a2.8 2.8 0 0 1-2.8 2.8H8.4a2.8 2.8 0 0 1-2.8-2.8v-6.4a.9.9 0 0 1 .9-.9Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function AddToHomeScreenBanner() {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<"bip" | "ios" | null>(null);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
  const shownRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone() || wasDismissed()) return;
    if (!window.matchMedia(MOBILE_MQ).matches) return;

    const showOnce = (next: "bip" | "ios") => {
      if (shownRef.current) return;
      shownRef.current = true;
      setMode(next);
      setVisible(true);
    };

    const onBip = (e: Event) => {
      e.preventDefault();
      deferredRef.current = e as BeforeInstallPromptEvent;
      showOnce("bip");
    };
    window.addEventListener("beforeinstallprompt", onBip);

    const t = window.setTimeout(() => {
      if (isIosSafari()) showOnce("ios");
    }, 500);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.clearTimeout(t);
    };
  }, []);

  if (!visible || !mode) return null;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  async function onInstallTap() {
    const deferred = deferredRef.current;
    if (mode === "bip" && deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      dismiss();
    }
  }

  return (
    <div className="a2hs-root" role="dialog" aria-labelledby="a2hs-title">
      <div className="a2hs-sheet" data-a2hs-mode={mode}>
        <button
          type="button"
          className="a2hs-dismiss"
          onClick={dismiss}
          aria-label="Dismiss"
        >
          ×
        </button>
        <p className="a2hs-eyebrow">Coursework</p>
        <h2 id="a2hs-title" className="a2hs-title">
          Add to Home Screen
        </h2>
        <p className="a2hs-body">
          Open Coursework from your home screen — no browser tab.
        </p>

        {mode === "bip" ? (
          <div className="a2hs-cta-block">
            <button
              type="button"
              className="btn btn-primary a2hs-cta"
              onClick={onInstallTap}
            >
              Add Coursework
            </button>
            <p className="a2hs-cta-hint">Confirm in the prompt that follows.</p>
          </div>
        ) : (
          <ol className="a2hs-steps">
            <li>
              Tap the <strong>Share</strong> <SafariShareIcon /> icon at the{" "}
              <strong>bottom of the screen</strong> in Safari
            </li>
            <li>
              Tap <strong>Add to Home Screen</strong>
            </li>
            <li>
              Tap <strong>Add</strong>
            </li>
          </ol>
        )}
      </div>
    </div>
  );
}
