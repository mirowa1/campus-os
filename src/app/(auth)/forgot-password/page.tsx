"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { createClient } from "@/lib/supabase/client";

const RESET_REDIRECT = "https://www.coremaxsystems.com/reset-password";

const GENERIC_SENT =
  "If an account exists for that email, a reset link has been sent.";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    // Always show the same confirmation — do not reveal whether the email exists.
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: RESET_REDIRECT,
    });

    setLoading(false);
    setSent(true);
  }

  return (
    <main className="hero-blob-shell relative flex min-h-screen w-full flex-col justify-center px-6 py-12">
      <div className="hero-blob" aria-hidden />
      <div className="relative z-10 mx-auto w-full max-w-md">
        <div className="mb-10">
          <BrandMark href="/" size="md" />
        </div>
        <h1 className="font-heading text-4xl">Forgot password</h1>
        <p className="mt-2 text-[var(--muted)]">
          Enter your email and we&apos;ll send a reset link.
        </p>

        {sent ? (
          <div className="mt-8 space-y-4">
            <p className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-sm text-[var(--accent)]">
              {GENERIC_SENT}
            </p>
            <p className="text-sm text-[var(--muted)]">
              <Link href="/login" className="text-[var(--accent)] hover:underline">
                Back to log in
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
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
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        {!sent && (
          <p className="mt-6 text-sm text-[var(--muted)]">
            <Link href="/login" className="text-[var(--accent)] hover:underline">
              Back to log in
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
