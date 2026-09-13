"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { PaywallModal } from "@/components/PaywallModal";
import { createClient } from "@/lib/supabase/client";

type ChatTurn = { role: "user" | "assistant"; content: string };

type Meta = {
  classNames: string[];
  messagesRemaining: number | null;
  freeLimit: number;
  isPro: boolean;
};

const STORAGE_KEY = "cm_assistant_chat_v1";
const HINT_KEY = "cm_assistant_hint_seen";
const MAX_STORED_TURNS = 50;

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H9l-4 3.5V6.5Z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function loadStoredMessages(): ChatTurn[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (m): m is ChatTurn =>
          !!m &&
          typeof m === "object" &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          !!m.content.trim()
      )
      .slice(-MAX_STORED_TURNS);
  } catch {
    return [];
  }
}

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(loadStoredMessages());
    try {
      if (!localStorage.getItem(HINT_KEY)) setShowHint(true);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(messages.slice(-MAX_STORED_TURNS))
      );
    } catch {
      /* ignore quota */
    }
  }, [messages, hydrated]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/assistant/meta");
        if (!res.ok) return;
        const data = (await res.json()) as Meta;
        if (!cancelled) setMeta(data);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, open, busy]);

  function dismissHint() {
    setShowHint(false);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  function toggleOpen() {
    setOpen((v) => {
      const next = !v;
      if (next) dismissHint();
      return next;
    });
  }

  const suggestions = (() => {
    const classHint = meta?.classNames?.[0];
    return [
      "What's due tomorrow?",
      "What's due this week?",
      "Which assignments am I missing a score for?",
      classHint
        ? `How's my grade in ${classHint}?`
        : "How's my grade looking?",
      "What should I study for my next exam?",
    ];
  })();

  async function ensureSession(): Promise<boolean> {
    try {
      const supabase = createClient();
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session) {
        const refreshed = await supabase.auth.refreshSession();
        return !!refreshed.data.session;
      }
      // Proactively refresh if access token is near expiry (< 2 min)
      const expiresAt = data.session.expires_at ?? 0;
      if (expiresAt * 1000 < Date.now() + 120_000) {
        const refreshed = await supabase.auth.refreshSession();
        return !!refreshed.data.session;
      }
      return true;
    } catch {
      return false;
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setError(null);
    setBusy(true);
    const history = messages;
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");

    try {
      const okSession = await ensureSession();
      if (!okSession) {
        setError("Your session expired. Refresh the page or sign in again.");
        setBusy(false);
        return;
      }

      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ message: trimmed, history }),
      });
      const data = (await res.json()) as {
        reply?: string;
        messagesRemaining?: number | null;
        error?: string;
        message?: string;
        feature?: string;
      };

      if (res.status === 402 || data.error === "PAYWALL_REQUIRED") {
        setPaywallOpen(true);
        setBusy(false);
        return;
      }

      if (res.status === 401 || data.error === "SESSION_EXPIRED") {
        setError(
          data.message ||
            "Your session expired. Refresh the page or sign in again."
        );
        setBusy(false);
        return;
      }

      if (!res.ok || !data.reply) {
        const msg = data.message || data.error || "Something went wrong";
        // Never surface a bare "Unauthorized" string
        setError(
          /unauthorized/i.test(msg)
            ? "Your session expired. Refresh the page or sign in again."
            : msg
        );
        setBusy(false);
        return;
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply! },
      ]);
      if (meta) {
        setMeta({
          ...meta,
          messagesRemaining:
            data.messagesRemaining === undefined
              ? meta.messagesRemaining
              : data.messagesRemaining,
        });
      }
    } catch {
      setError("Could not reach the assistant");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  const remainingLabel =
    meta && !meta.isPro && meta.messagesRemaining != null
      ? `${meta.messagesRemaining} of ${meta.freeLimit} free messages left`
      : meta?.isPro
        ? "Unlimited with Pro"
        : null;

  return (
    <>
      {showHint && !open && (
        <div className="assistant-hint" role="status">
          <p>Ask me anything about your coursework</p>
          <button type="button" className="assistant-hint-dismiss" onClick={dismissHint}>
            Got it
          </button>
        </div>
      )}

      <button
        type="button"
        className={`assistant-fab${showHint && !open ? " assistant-fab-pulse" : ""}`}
        aria-label={open ? "Close Coursework assistant" : "Open Coursework assistant"}
        aria-expanded={open}
        onClick={toggleOpen}
      >
        {open ? (
          <CloseIcon className="h-6 w-6" />
        ) : (
          <ChatIcon className="h-6 w-6" />
        )}
      </button>

      {open && (
        <div
          className="assistant-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="assistant-title"
        >
          <div className="assistant-panel-header">
            <div>
              <h2
                id="assistant-title"
                className="font-heading text-lg text-[var(--ink)]"
              >
                Coursework assistant
              </h2>
              {remainingLabel && (
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {remainingLabel}
                </p>
              )}
            </div>
            <button
              type="button"
              className="btn btn-ghost text-xs"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>

          <div ref={listRef} className="assistant-panel-body">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted)]">
                  Ask about due dates, grades, and what to study — answers use
                  your Coursework data.
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="assistant-suggestion"
                      disabled={busy}
                      onClick={() => void sendMessage(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={
                  m.role === "user"
                    ? "assistant-bubble assistant-bubble-user"
                    : "assistant-bubble assistant-bubble-assistant"
                }
              >
                {m.content}
              </div>
            ))}

            {busy && (
              <p className="text-xs text-[var(--muted)]">Thinking…</p>
            )}
            {error && (
              <p className="assistant-error" role="alert">
                {error}
              </p>
            )}
          </div>

          <form onSubmit={onSubmit} className="assistant-panel-footer">
            <input
              className="input flex-1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your coursework…"
              disabled={busy}
              maxLength={2000}
              aria-label="Message"
            />
            <button
              type="submit"
              className="btn btn-primary shrink-0"
              disabled={busy || !input.trim()}
            >
              Send
            </button>
          </form>
        </div>
      )}

      <PaywallModal
        open={paywallOpen}
        feature="assistant"
        onClose={() => setPaywallOpen(false)}
      />
    </>
  );
}
