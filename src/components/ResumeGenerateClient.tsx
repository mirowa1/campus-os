"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RESUME_TEMPLATES } from "@/lib/resume-templates";
import type { ResumeTemplateId } from "@/lib/types";

type Props = {
  resumeId: string;
  initialTemplate: ResumeTemplateId | null;
};

export function ResumeGenerateClient({ resumeId, initialTemplate }: Props) {
  const router = useRouter();
  const [choice, setChoice] = useState<ResumeTemplateId | null>(
    initialTemplate
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!choice) {
      setError("Select a template first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/resume/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateChoice: choice, resumeId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Resume generation failed, please try again");
        setLoading(false);
        return;
      }
      router.push("/resume/preview");
      router.refresh();
    } catch {
      setError("Resume generation failed, please try again");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl">Choose a template</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          We only use what you entered — nothing invented. Pick a layout, then
          generate a polished draft.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {RESUME_TEMPLATES.map((t) => {
          const active = choice === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setChoice(t.id)}
              className={`surface rounded-2xl p-5 text-left transition ${
                active ? "ring-2 ring-[var(--accent)]" : ""
              }`}
            >
              <p className="text-xs font-medium text-[var(--accent-cyan)]">
                Template {t.id}
              </p>
              <p className="mt-1 font-heading text-lg">{t.name}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">{t.blurb}</p>
            </button>
          );
        })}
      </div>

      {error && (
        <div
          className="rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3"
          role="alert"
        >
          <p className="text-sm text-[var(--danger)]">{error}</p>
          <button
            type="button"
            className="btn btn-ghost mt-3 text-xs"
            onClick={() => void generate()}
            disabled={loading || !choice}
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => router.push("/resume")}
          disabled={loading}
        >
          Back to intake
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void generate()}
          disabled={loading || !choice}
        >
          {loading ? "Generating…" : "Generate resume"}
        </button>
      </div>
    </div>
  );
}
