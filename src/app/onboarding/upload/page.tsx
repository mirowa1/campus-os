"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PaywallModal } from "@/components/PaywallModal";
import { UploadDropzone } from "@/components/UploadDropzone";

const PARSE_FAILED_MESSAGE =
  "We couldn't read that syllabus — try a different file, or add your class manually.";

export default function OnboardingUploadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  async function onFile(file: File) {
    setError(null);
    setLoading(true);
    setStatus("Reading your syllabus…");

    const form = new FormData();
    form.append("file", file);

    try {
      setStatus("AI is extracting assignments, exams, and weights…");
      const res = await fetch("/api/parse-syllabus", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (res.status === 402 || data.error === "PAYWALL_REQUIRED") {
        setPaywallOpen(true);
        setLoading(false);
        setStatus(null);
        return;
      }
      if (!res.ok) {
        setError(PARSE_FAILED_MESSAGE);
        setLoading(false);
        setStatus(null);
        return;
      }
      setStatus("Building your semester…");
      router.push(`/onboarding/review?classId=${data.class.id}`);
      router.refresh();
    } catch {
      setError(PARSE_FAILED_MESSAGE);
      setLoading(false);
      setStatus(null);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
        Get started
      </p>
      <h1 className="font-heading mt-3 text-4xl md:text-5xl">
        Upload a syllabus
      </h1>
      <p className="mt-3 text-[var(--muted)]">
        Drop a syllabus and we&apos;ll plan your semester in under a minute — or
        skip and add classes manually.
      </p>

      <div className="mt-10">
        <UploadDropzone onFile={onFile} disabled={loading} />
      </div>

      <button
        type="button"
        className="btn btn-ghost mt-6 w-full"
        disabled={loading}
        onClick={() => router.push("/dashboard")}
      >
        Skip for now
      </button>

      {status && (
        <p className="mt-6 text-center text-sm text-[var(--accent)]">{status}</p>
      )}
      {error && (
        <div className="mt-6 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-3 text-sm text-[var(--danger)]">
          <p>{error}</p>
          <Link href="/classes/new" className="btn btn-ghost mt-3 w-full">
            Add class manually
          </Link>
        </div>
      )}

      <PaywallModal
        open={paywallOpen}
        feature="syllabus"
        onClose={() => setPaywallOpen(false)}
      />
    </main>
  );
}
