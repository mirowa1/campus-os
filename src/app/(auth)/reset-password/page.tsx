"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function ensureRecoverySession() {
      // Give the client a moment to exchange ?code= / hash tokens from the email link.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      if (session) {
        setReady(true);
        setChecking(false);
        return;
      }

      // One short retry — PKCE exchange can lag slightly after landing.
      await new Promise((r) => setTimeout(r, 800));
      if (cancelled) return;

      const {
        data: { session: again },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      setReady(!!again);
      setChecking(false);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        setReady(true);
        setChecking(false);
      }
    });

    void ensureRecoverySession();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push("/login?reset=success");
    router.refresh();
  }

  return (
    <main className="hero-blob-shell relative flex min-h-screen w-full flex-col justify-center px-6 py-12">
      <div className="hero-blob" aria-hidden />
      <div className="relative z-10 mx-auto w-full max-w-md">
        <div className="mb-10">
          <BrandMark href="/" size="md" />
        </div>
        <h1 className="font-heading text-4xl">Set a new password</h1>
        <p className="mt-2 text-[var(--muted)]">
          Choose a new password for your account.
        </p>

        {checking ? (
          <p className="mt-8 text-sm text-[var(--muted)]">Verifying reset link…</p>
        ) : !ready ? (
          <div className="mt-8 space-y-4">
            <p className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              This reset link is invalid or has expired. Request a new one to
              continue.
            </p>
            <Link href="/forgot-password" className="btn btn-primary inline-flex">
              Request a new reset link
            </Link>
            <p className="text-sm text-[var(--muted)]">
              <Link href="/login" className="text-[var(--accent)] hover:underline">
                Back to log in
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="label" htmlFor="password">
                New password
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
            <div>
              <label className="label" htmlFor="confirm">
                Confirm password
              </label>
              <input
                id="confirm"
                className="input"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
              {loading ? "Saving…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
