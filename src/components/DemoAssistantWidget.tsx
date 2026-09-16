"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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

type Props = {
  signupHref: string;
  userMessage: string;
  assistantMessage: string;
};

/**
 * Public-demo-only assistant shell. Visual twin of AssistantWidget CSS classes,
 * but zero network calls — scripted turns only.
 */
export function DemoAssistantWidget({
  signupHref,
  userMessage,
  assistantMessage,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const openTimer = window.setTimeout(() => setOpen(true), 400);
    return () => window.clearTimeout(openTimer);
  }, []);

  useEffect(() => {
    if (!open) {
      setShowAssistant(false);
      return;
    }
    setShowAssistant(false);
    const t = window.setTimeout(() => setShowAssistant(true), 700);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!showAssistant) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [showAssistant]);

  return (
    <>
      <button
        type="button"
        className={`assistant-fab${!open ? " assistant-fab-pulse" : ""}`}
        aria-label={
          open ? "Close demo Coursework assistant" : "Open demo Coursework assistant"
        }
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
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
          aria-labelledby="demo-assistant-title"
        >
          <div className="assistant-panel-header">
            <div>
              <h2
                id="demo-assistant-title"
                className="font-heading text-lg text-[var(--ink)]"
              >
                Coursework assistant
              </h2>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                Scripted demo — not live AI
              </p>
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
            <div className="assistant-bubble assistant-bubble-user">
              {userMessage}
            </div>
            {!showAssistant && (
              <p className="text-xs text-[var(--muted)]">Thinking…</p>
            )}
            {showAssistant && (
              <div className="assistant-bubble assistant-bubble-assistant">
                {assistantMessage}
              </div>
            )}
          </div>

          <div className="assistant-panel-footer">
            <Link
              href={signupHref}
              className="btn btn-primary w-full text-center text-sm"
            >
              Try it after signup →
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
