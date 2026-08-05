"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

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

    if (data.session) {
      router.push("/onboarding/upload");
      router.refresh();
      return;
    }

    setInfo(
      "Check your email to confirm your account, then log in. (If email confirmation is disabled in Supabase, you’ll be signed in immediately.)"
    );
  }

  return (
    <main className="hero-blob-shell relative flex min-h-screen w-full flex-col justify-center px-6 py-12">
      <div className="hero-blob" aria-hidden />
      <div className="relative z-10 mx-auto w-full max-w-md">
        <div className="mb-10">
          <BrandMark href="/" size="md" />
        </div>
        <h1 className="font-heading text-4xl">Create your account</h1>
        <p className="mt-2 text-[var(--muted)]">
          School email preferred — but any email works for testing.
        </p>

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
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <p className="mt-6 text-sm text-[var(--muted)]">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--accent)] hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
