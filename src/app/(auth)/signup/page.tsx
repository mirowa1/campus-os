"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  GoogleAuthButton,
  LAST_AUTH_KEY,
} from "@/components/GoogleAuthButton";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { createClient } from "@/lib/supabase/client";

function EmailGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
      focusable="false"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);

  const isEdu = email.toLowerCase().endsWith(".edu");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: signError } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (signError) {
      setError(signError.message);
      return;
    }

    try {
      localStorage.setItem(LAST_AUTH_KEY, "email");
    } catch {
      /* ignore */
    }

    void fetch("/api/auth/welcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch((err) => {
      console.error("[welcome-email] request failed:", err);
    });

    if (data.session) {
      void fetch("/api/auth/attribution", { method: "POST" }).catch((err) => {
        console.error("[utm] attribution request failed:", err);
      });
      router.push("/onboarding/upload");
      router.refresh();
      return;
    }

    setInfo(
      "Check your email to confirm your account, then log in. (If email confirmation is disabled in Supabase, you’ll be signed in immediately.)"
    );
  }

  return (
    <main className="auth-screen hero-blob-shell relative flex min-h-screen w-full flex-col justify-center px-6 py-12">
      <div className="hero-blob" aria-hidden />
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <div className="relative z-10 mx-auto w-full max-w-sm">
        <div className="mb-10 flex justify-center">
          <Logo href="/" size="md" rotated withByline />
        </div>
        <h1 className="auth-heading font-heading">Create your account</h1>

        <div className="mt-10 space-y-3">
          <GoogleAuthButton nextPath="/onboarding/upload" />
          <button
            type="button"
            className="auth-pill"
            aria-expanded={emailOpen}
            onClick={() => setEmailOpen((v) => !v)}
          >
            <EmailGlyph className="auth-pill-icon" />
            Sign up with email
          </button>
        </div>

        {emailOpen && (
          <form onSubmit={onSubmit} className="auth-email-panel mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="input"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@university.edu"
              />
              {email && !isEdu && (
                <p className="mt-1.5 text-xs text-[var(--warn)]">
                  Tip: a .edu address works best for campus features later.
                </p>
              )}
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className="input"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
                {error}
              </p>
            )}
            {info && (
              <p className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-sm text-[var(--accent)]">
                {info}
              </p>
            )}
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
            >
              {loading ? "Creating account…" : "Sign up"}
            </button>
          </form>
        )}

        <p className="auth-footer-link">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </div>
    </main>
  );
}
