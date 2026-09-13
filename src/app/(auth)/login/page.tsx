"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
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

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetSuccess = searchParams.get("reset") === "success";
  const authError = searchParams.get("error") === "auth";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailOpen, setEmailOpen] = useState(resetSuccess || authError);
  const [lastMethod, setLastMethod] = useState<string | null>(null);

  useEffect(() => {
    try {
      setLastMethod(localStorage.getItem(LAST_AUTH_KEY));
    } catch {
      /* ignore */
    }
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({
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

    void fetch("/api/auth/attribution", { method: "POST" }).catch((err) => {
      console.error("[utm] attribution request failed:", err);
    });

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <>
      <h1 className="auth-heading font-heading">Log into your account</h1>

      {resetSuccess && (
        <p className="mt-6 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-sm text-[var(--accent)]">
          Password updated. You can log in with your new password.
        </p>
      )}
      {authError && (
        <p className="mt-6 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          Google sign-in failed. Try again or use email.
        </p>
      )}

      <div className="mt-10 space-y-3">
        <GoogleAuthButton nextPath="/dashboard" />
        <button
          type="button"
          className="auth-pill"
          aria-expanded={emailOpen}
          onClick={() => setEmailOpen((v) => !v)}
        >
          <EmailGlyph className="auth-pill-icon" />
          Log in with email
        </button>
      </div>

      {lastMethod === "google" && (
        <p className="auth-last-hint">
          <span className="auth-last-hint-dot" aria-hidden />
          You last logged in with Google.
        </p>
      )}

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
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label className="label mb-0" htmlFor="password">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-[var(--accent)] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              className="input"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>
      )}

      <p className="auth-footer-link">
        Don&apos;t have an account?{" "}
        <Link href="/signup">Sign up</Link>
      </p>
    </>
  );
}

export default function LoginPage() {
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
        <Suspense
          fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}
        >
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
