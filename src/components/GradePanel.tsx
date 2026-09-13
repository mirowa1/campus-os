"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computeGradeProjection,
  LETTER_OPTIONS,
  letterToPercent,
} from "@/lib/grades";
import type { AssessmentRow, ClassRow } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { AssessmentEditForm } from "@/components/AssessmentEditForm";
import { DeleteAssessmentDialog } from "@/components/DeleteAssessmentDialog";
import {
  EMPTY_ASSESSMENT_FORM,
  createAssessment,
  deleteAssessment,
  patchAssessment,
  saveAssessmentScore,
  type AssessmentFormFields,
} from "@/lib/assessment-client";

type Props = {
  classRow: ClassRow;
  assessments: AssessmentRow[];
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
  useEffect(() => {
    setAssessments(initial);
  }, [initial]);
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
  const [form, setForm] = useState<AssessmentFormFields>(EMPTY_ASSESSMENT_FORM);
  const [deleteTarget, setDeleteTarget] = useState<AssessmentRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [editTarget, setEditTarget] = useState<AssessmentRow | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editForm, setEditForm] = useState<AssessmentFormFields>(
    EMPTY_ASSESSMENT_FORM
  );

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

  async function onSaveScore(id: string, raw: string) {
    setError(null);
    const result = await saveAssessmentScore({
      classId: classRow.id,
      assessmentId: id,
      rawScore: raw,
      assessments,
      targetPercent: hasTarget ? targetPercent : null,
    });
    if (result.error) {
      setError(result.error);
      return;
    }
    setAssessments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, score: result.score } : a))
    );
    router.refresh();
  }

  async function addAssessment() {
    setError(null);
    setCalendarWarning(null);
    setAddBusy(true);
    try {
      const result = await createAssessment(classRow.id, form);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.assessment) {
        setAssessments((prev) =>
          sortAssessments([...prev, result.assessment!])
        );
      }
      if (result.calendarSyncWarning) {
        showCalendarWarning(
          `Assessment saved, but Google Calendar sync failed: ${result.calendarSyncWarning}. Use Sync to Google Calendar to retry.`
        );
      }
      setForm(EMPTY_ASSESSMENT_FORM);
      setAddOpen(false);
      router.refresh();
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
      score: assessment.score != null ? String(assessment.score) : "",
      max_score: String(assessment.max_score),
    });
  }

  async function saveEdit() {
    if (!editTarget) return;
    setError(null);
    setCalendarWarning(null);
    setEditBusy(true);
    try {
      const result = await patchAssessment(classRow.id, editTarget.id, editForm);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.assessment) {
        setAssessments((prev) =>
          sortAssessments(
            prev.map((a) =>
              a.id === editTarget.id ? result.assessment! : a
            )
          )
        );
      }
      if (result.calendarSyncWarning) {
        showCalendarWarning(
          `Assessment saved, but Google Calendar sync failed: ${result.calendarSyncWarning}. Use Sync to Google Calendar to retry.`
        );
      }
      setEditTarget(null);
      router.refresh();
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
      const result = await deleteAssessment(classRow.id, deleteTarget.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setAssessments((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      if (result.calendarSyncWarning) {
        showCalendarWarning(
          `Assessment deleted, but Google Calendar cleanup failed: ${result.calendarSyncWarning}. You may need to remove the event manually or re-sync.`
        );
      }
      setDeleteTarget(null);
      router.refresh();
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
            disabled={saving}
            onClick={() => void saveTarget()}
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
            <AssessmentEditForm
              idPrefix="assessment-add"
              form={form}
              onChange={setForm}
              mode="create"
            />
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
                <div className="grid w-full gap-3">
                  <AssessmentEditForm
                    idPrefix={`edit-${a.id}`}
                    form={editForm}
                    onChange={setEditForm}
                    mode="edit"
                  />
                  <div className="flex flex-wrap gap-2">
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
                      onBlur={(e) => void onSaveScore(a.id, e.target.value)}
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
        <DeleteAssessmentDialog
          title={deleteTarget.title}
          busy={deleteBusy}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
