"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UploadDropzone } from "@/components/UploadDropzone";

export default function OnboardingUploadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      if (!res.ok) {
        throw new Error(data.error || "Failed to parse syllabus");
      }
      setStatus("Building your semester…");
      router.push(`/onboarding/review?classId=${data.class.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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
        <p className="mt-6 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
    </main>
  );
}
