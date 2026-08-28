"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewClassPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [term, setTerm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim() || undefined,
          term: term.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create class");
      }
      router.push(`/classes/${data.class.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create class");
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <Link
        href="/dashboard"
        className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
      >
        ← Back
      </Link>
      <h1 className="font-heading mt-4 text-4xl">Add class</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Create a class manually. Add assessments and grades on the class page,
        or upload a syllabus later to auto-parse deadlines.
      </p>

      <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-4">
        <div>
          <label className="label" htmlFor="class-name">
            Class name
          </label>
          <input
            id="class-name"
            className="input"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Introduction to Psychology"
          />
        </div>
        <div>
          <label className="label" htmlFor="class-code">
            Course code (optional)
          </label>
          <input
            id="class-code"
            className="input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="PSYC 1101"
          />
        </div>
        <div>
          <label className="label" htmlFor="class-term">
            Term (optional)
          </label>
          <input
            id="class-term"
            className="input"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Fall 2026"
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
          disabled={saving || !name.trim()}
        >
          {saving ? "Creating…" : "Create class"}
        </button>
      </form>
    </main>
  );
}
