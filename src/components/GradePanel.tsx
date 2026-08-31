"use client";

import { useMemo, useState } from "react";
import {
  computeGradeProjection,
  LETTER_OPTIONS,
  letterToPercent,
} from "@/lib/grades";
import type { AssessmentRow, AssessmentType, ClassRow } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Props = {
  classRow: ClassRow;
  assessments: AssessmentRow[];
};

const ASSESSMENT_TYPES: AssessmentType[] = [
  "assignment",
  "quiz",
  "exam",
  "other",
];

const EMPTY_FORM = {
  title: "",
  type: "assignment" as AssessmentType,
  due_date: "",
  weight_percent: "0",
  score: "",
  max_score: "100",
};

function sortAssessments(rows: AssessmentRow[]): AssessmentRow[] {
  return [...rows].sort((a, b) => {
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return a.title.localeCompare(b.title);
  });
}

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
  const [calendarWarning, setCalendarWarning] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<AssessmentRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [editTarget, setEditTarget] = useState<AssessmentRow | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    type: "assignment" as AssessmentType,
    due_date: "",
    weight_percent: "0",
  });

  const targetPercent = letterToPercent(targetLetter);

  const projection = useMemo(
    () =>
      computeGradeProjection(assessments, hasTarget ? targetPercent : null),
    [assessments, hasTarget, targetPercent]
  );

  function showCalendarWarning(message: string) {
    setCalendarWarning(message);
  }

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

  async function addAssessment() {
    setError(null);
    setCalendarWarning(null);
    const title = form.title.trim();
    if (!title) {
      setError("Title is required.");
      return;
    }

    setAddBusy(true);
    try {
      const res = await fetch(`/api/classes/${classRow.id}/assessments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          type: form.type,
          due_date: form.due_date || null,
          weight_percent: Number(form.weight_percent),
          score: form.score.trim() === "" ? null : Number(form.score),
          max_score: form.max_score.trim() === "" ? 100 : Number(form.max_score),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        assessment?: AssessmentRow;
        calendarSyncWarning?: string;
      };
      if (!res.ok) {
        setError(data.error || "Failed to add assessment");
        return;
      }
      if (data.assessment) {
        setAssessments((prev) => sortAssessments([...prev, data.assessment!]));
      }
      if (data.calendarSyncWarning) {
        showCalendarWarning(
          `Assessment saved, but Google Calendar sync failed: ${data.calendarSyncWarning}. Use Sync to Google Calendar to retry.`
        );
      }
      setForm(EMPTY_FORM);
      setAddOpen(false);
      router.refresh();
    } catch {
      setError("Failed to add assessment");
    } finally {
      setAddBusy(false);
    }
  }


  function startEdit(assessment: AssessmentRow) {
    setError(null);
    setEditTarget(assessment);
    setEditForm({
      title: assessment.title,
      type: assessment.type,
      due_date: assessment.due_date ?? "",
      weight_percent: String(assessment.weight_percent),
    });
  }

  async function saveEdit() {
    if (!editTarget) return;
    setError(null);
    setCalendarWarning(null);
    const title = editForm.title.trim();
    if (!title) {
      setError("Title is required.");
      return;
    }

    setEditBusy(true);
    try {
      const res = await fetch(
        `/api/classes/${classRow.id}/assessments/${editTarget.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            type: editForm.type,
            due_date: editForm.due_date || null,
            weight_percent: Number(editForm.weight_percent),
          }),
        }
      );
      const data = (await res.json()) as {
        error?: string;
        assessment?: AssessmentRow;
        calendarSyncWarning?: string;
      };
      if (!res.ok) {
        setError(data.error || "Failed to update assessment");
        return;
      }
      if (data.assessment) {
        setAssessments((prev) =>
          sortAssessments(
            prev.map((a) => (a.id === editTarget.id ? data.assessment! : a))
          )
        );
      }
      if (data.calendarSyncWarning) {
        showCalendarWarning(
          `Assessment saved, but Google Calendar sync failed: ${data.calendarSyncWarning}. Use Sync to Google Calendar to retry.`
        );
      }
      setEditTarget(null);
      router.refresh();
    } catch {
      setError("Failed to update assessment");
    } finally {
      setEditBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setError(null);
    setCalendarWarning(null);
    try {
      const res = await fetch(
        `/api/classes/${classRow.id}/assessments/${deleteTarget.id}`,
        { method: "DELETE" }
      );
      const data = (await res.json()) as {
        error?: string;
        calendarSyncWarning?: string;
      };
      if (!res.ok) {
        setError(data.error || "Failed to delete assessment");
        setDeleteBusy(false);
        return;
      }
      setAssessments((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      if (data.calendarSyncWarning) {
        showCalendarWarning(
          `Assessment deleted, but Google Calendar cleanup failed: ${data.calendarSyncWarning}. You may need to remove the event manually or re-sync.`
        );
      }
      setDeleteTarget(null);
      router.refresh();
    } catch {
      setError("Failed to delete assessment");
    } finally {
      setDeleteBusy(false);
    }
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

      {calendarWarning && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {calendarWarning}
        </p>
      )}

      <div className="surface overflow-hidden rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3">
          <h2 className="text-sm font-medium">Assessments & weights</h2>
          <button
            type="button"
            className="btn btn-ghost text-sm"
            onClick={() => {
              setError(null);
              setAddOpen((v) => !v);
            }}
          >
            {addOpen ? "Cancel" : "+ Add assessment"}
          </button>
        </div>

        {addOpen && (
          <div className="space-y-3 border-b border-[var(--line)] px-5 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="assessment-title">
                  Title
                </label>
                <input
                  id="assessment-title"
                  className="input w-full"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Midterm exam"
                />
              </div>
              <div>
                <label className="label" htmlFor="assessment-type">
                  Type
                </label>
                <select
                  id="assessment-type"
                  className="input w-full"
                  value={form.type}
                  onChange={(e) =>
                    setForm({ ...form, type: e.target.value as AssessmentType })
                  }
                >
                  {ASSESSMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="assessment-due">
                  Due date
                </label>
                <input
                  id="assessment-due"
                  className="input w-full"
                  type="date"
                  value={form.due_date}
                  onChange={(e) =>
                    setForm({ ...form, due_date: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor="assessment-weight">
                  Weight %
                </label>
                <input
                  id="assessment-weight"
                  className="input w-full"
                  type="number"
                  min={0}
                  step="0.1"
                  value={form.weight_percent}
                  onChange={(e) =>
                    setForm({ ...form, weight_percent: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor="assessment-max">
                  Max score
                </label>
                <input
                  id="assessment-max"
                  className="input w-full"
                  type="number"
                  min={1}
                  step="0.1"
                  value={form.max_score}
                  onChange={(e) =>
                    setForm({ ...form, max_score: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor="assessment-score">
                  Score (optional)
                </label>
                <input
                  id="assessment-score"
                  className="input w-full"
                  type="number"
                  min={0}
                  step="0.1"
                  value={form.score}
                  onChange={(e) => setForm({ ...form, score: e.target.value })}
                />
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary text-sm"
              disabled={addBusy}
              onClick={() => void addAssessment()}
            >
              {addBusy ? "Adding…" : "Add assessment"}
            </button>
          </div>
        )}

        <ul className="divide-y divide-[var(--line)]">
          {assessments.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"
            >
              {editTarget?.id === a.id ? (
                <div className="grid w-full gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="label" htmlFor={`edit-title-${a.id}`}>
                      Title
                    </label>
                    <input
                      id={`edit-title-${a.id}`}
                      className="input w-full"
                      value={editForm.title}
                      onChange={(e) =>
                        setEditForm({ ...editForm, title: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`edit-type-${a.id}`}>
                      Type
                    </label>
                    <select
                      id={`edit-type-${a.id}`}
                      className="input w-full"
                      value={editForm.type}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          type: e.target.value as AssessmentType,
                        })
                      }
                    >
                      {ASSESSMENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor={`edit-due-${a.id}`}>
                      Due date
                    </label>
                    <input
                      id={`edit-due-${a.id}`}
                      className="input w-full"
                      type="date"
                      value={editForm.due_date}
                      onChange={(e) =>
                        setEditForm({ ...editForm, due_date: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`edit-weight-${a.id}`}>
                      Weight %
                    </label>
                    <input
                      id={`edit-weight-${a.id}`}
                      className="input w-full"
                      type="number"
                      min={0}
                      step="0.1"
                      value={editForm.weight_percent}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          weight_percent: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <button
                      type="button"
                      className="btn btn-primary text-sm"
                      disabled={editBusy}
                      onClick={() => void saveEdit()}
                    >
                      {editBusy ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost text-sm"
                      disabled={editBusy}
                      onClick={() => setEditTarget(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
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
                    <button
                      type="button"
                      className="btn btn-ghost px-2 text-xs"
                      onClick={() => startEdit(a)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost px-2 text-xs text-[var(--danger)]"
                      aria-label={`Delete ${a.title}`}
                      onClick={() => {
                        setError(null);
                        setDeleteTarget(a);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
          {assessments.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-[var(--muted)]">
              No assessments yet.
            </li>
          )}
        </ul>
      </div>

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-assessment-title"
        >
          <div className="surface w-full max-w-md rounded-2xl p-6 shadow-xl">
            <h2 id="delete-assessment-title" className="font-heading text-2xl">
              Delete this assessment?
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              This permanently removes{" "}
              <span className="text-[var(--ink)]">{deleteTarget.title}</span>.
              This cannot be undone.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="btn btn-primary text-sm"
                style={{
                  background: "var(--danger)",
                  borderColor: "var(--danger)",
                }}
                disabled={deleteBusy}
                onClick={() => void confirmDelete()}
              >
                {deleteBusy ? "Deleting…" : "Delete assessment"}
              </button>
              <button
                type="button"
                className="btn btn-ghost text-sm"
                disabled={deleteBusy}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
