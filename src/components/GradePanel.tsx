"use client";

import { useMemo, useState } from "react";
import {
  computeGradeProjection,
  LETTER_OPTIONS,
  letterToPercent,
} from "@/lib/grades";
import type { AssessmentRow, ClassRow } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Props = {
  classRow: ClassRow;
  assessments: AssessmentRow[];
};

export function GradePanel({ classRow, assessments: initial }: Props) {
  const router = useRouter();
  const [assessments, setAssessments] = useState(initial);
  const [targetLetter, setTargetLetter] = useState(
    classRow.target_letter ?? "B+"
  );
  const [hasTarget, setHasTarget] = useState(
    classRow.target_percent != null || !!classRow.target_letter
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetPercent = letterToPercent(targetLetter);

  const projection = useMemo(
    () =>
      computeGradeProjection(assessments, hasTarget ? targetPercent : null),
    [assessments, hasTarget, targetPercent]
  );

  async function saveTarget() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const pct = letterToPercent(targetLetter);
    const { error: updError } = await supabase
      .from("classes")
      .update({ target_letter: targetLetter, target_percent: pct })
      .eq("id", classRow.id);
    setSaving(false);
    if (updError) {
      setError(updError.message);
      return;
    }
    setHasTarget(true);
    router.refresh();
  }

  async function saveScore(id: string, raw: string) {
    setError(null);
    const value = raw.trim() === "" ? null : Number(raw);
    if (value != null && Number.isNaN(value)) {
      setError("Score must be a number.");
      return;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Not signed in");
      return;
    }

    const before = assessments.find((a) => a.id === id);
    const averageBefore = computeGradeProjection(
      assessments,
      hasTarget ? targetPercent : null
    ).currentPercent;

    const { error: histError } = await supabase.from("score_history").insert({
      user_id: user.id,
      class_id: classRow.id,
      assessment_id: id,
      old_score: before?.score ?? null,
      new_score: value,
      class_average_before: averageBefore,
    });
    if (histError) {
      // Still allow score save if history table missing during rollout
      console.warn("score_history:", histError.message);
    }

    const { error: updError } = await supabase
      .from("assessments")
      .update({ score: value })
      .eq("id", id);
    if (updError) {
      setError(updError.message);
      return;
    }
    setAssessments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, score: value } : a))
    );
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="surface rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Current average
            </p>
            <p className="font-heading mt-1 text-4xl">
              {projection.currentPercent != null
                ? `${projection.currentPercent.toFixed(1)}%`
                : "—"}
            </p>
          </div>
          <StatusBadge status={projection.status} />
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">{projection.message}</p>

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="target">
              Target grade
            </label>
            <select
              id="target"
              className="input w-auto"
              value={targetLetter}
              onChange={(e) => setTargetLetter(e.target.value)}
            >
              {LETTER_OPTIONS.map((l) => (
                <option key={l} value={l}>
                  {l} (~{letterToPercent(l)}%)
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={saveTarget}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save target"}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      <div className="surface overflow-hidden rounded-2xl">
        <div className="border-b border-[var(--line)] px-5 py-3">
          <h2 className="text-sm font-medium">Assessments & weights</h2>
        </div>
        <ul className="divide-y divide-[var(--line)]">
          {assessments.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"
            >
              <div className="min-w-[10rem] flex-1">
                <p className="font-medium">{a.title}</p>
                <p className="text-xs capitalize text-[var(--muted)]">
                  {a.type}
                  {a.due_date ? ` · due ${a.due_date}` : ""}
                  {` · ${a.weight_percent}%`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  className="input w-24"
                  type="number"
                  min={0}
                  max={a.max_score}
                  step="0.1"
                  placeholder="Score"
                  defaultValue={a.score ?? ""}
                  onBlur={(e) => saveScore(a.id, e.target.value)}
                />
                <span className="text-xs text-[var(--muted)]">
                  / {a.max_score}
                </span>
              </div>
            </li>
          ))}
          {assessments.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-[var(--muted)]">
              No assessments yet.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
