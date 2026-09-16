"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  ASSESSMENT_STATUS_COLORS,
  ASSESSMENT_STATUS_LABELS,
  compareAssessmentsByTriage,
  getAssessmentStatus,
  type AssessmentStatus,
} from "@/lib/assessment-status";
import type { AssessmentRow, ClassRow } from "@/lib/types";

export type AssessmentsPanelItem = {
  assessment: AssessmentRow;
  classLabel: string;
  classId: string;
};

type FilterKey = Exclude<AssessmentStatus, "undated">;

const FILTER_KEYS: FilterKey[] = [
  "completed",
  "overdue",
  "due_soon",
  "upcoming",
];

type Props = {
  items: AssessmentsPanelItem[];
  classes: Pick<ClassRow, "id" | "name" | "code">[];
  /** Hide add/edit/delete and skip API mutations (public demo). */
  readOnly?: boolean;
  /** Fired when a status filter chip is toggled (demo CTA trigger). */
  onFilterInteraction?: () => void;
};

export function AssessmentsPanel({
  items: initial,
  classes,
  readOnly = false,
  onFilterInteraction,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const skipPropSyncUntil = useRef(0);
  useEffect(() => {
    // Avoid clobbering optimistic upserts with a briefly-stale RSC payload after refresh.
    if (Date.now() < skipPropSyncUntil.current) return;
    setItems(initial);
  }, [initial]);
  const [filters, setFilters] = useState<Record<FilterKey, boolean>>({
    completed: true,
    overdue: true,
    due_soon: true,
    upcoming: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [calendarWarning, setCalendarWarning] = useState<string | null>(null);
  const [filterHint, setFilterHint] = useState<string | null>(null);
  const [scrollToId, setScrollToId] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addClassId, setAddClassId] = useState(classes[0]?.id ?? "");
  const [addForm, setAddForm] = useState<AssessmentFormFields>(
    EMPTY_ASSESSMENT_FORM
  );

  const [editItem, setEditItem] = useState<AssessmentsPanelItem | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editForm, setEditForm] = useState<AssessmentFormFields>(
    EMPTY_ASSESSMENT_FORM
  );
  const [editScore, setEditScore] = useState("");

  const [deleteItem, setDeleteItem] = useState<AssessmentsPanelItem | null>(
    null
  );
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (!scrollToId) return;
    const id = `assessment-card-${scrollToId}`;
    const frame = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
      setScrollToId(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollToId, items, filters]);

  const visible = useMemo(() => {
    const today = new Date();
    const active = FILTER_KEYS.filter((k) => filters[k]);
    const effective: Set<AssessmentStatus> =
      active.length === 0 ? new Set(FILTER_KEYS) : new Set(active);
    const showNonCompleted =
      active.length === 0 ||
      filters.overdue ||
      filters.due_soon ||
      filters.upcoming;
    return [...items]
      .filter((row) => {
        const status = getAssessmentStatus(
          row.assessment.due_date,
          row.assessment.score,
          today
        );
        if (status === "undated") return showNonCompleted;
        return effective.has(status);
      })
      .sort((a, b) =>
        compareAssessmentsByTriage(a.assessment, b.assessment, today)
      );
  }, [items, filters]);

  function toggleFilter(key: FilterKey) {
    setFilterHint(null);
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
    onFilterInteraction?.();
  }

  function classLabelFor(classId: string) {
    const c = classes.find((x) => x.id === classId);
    if (!c) return "Unknown class";
    return c.code ? `${c.code} — ${c.name}` : c.name;
  }

  function upsertItem(assessment: AssessmentRow, classId: string) {
    skipPropSyncUntil.current = Date.now() + 2500;
    setItems((prev) => {
      const next = prev.filter((x) => x.assessment.id !== assessment.id);
      next.push({
        assessment,
        classId,
        classLabel: classLabelFor(classId),
      });
      return next;
    });
  }

  /** Keep edited row visible: enable its status filter if off, then scroll to it. */
  function revealAfterEdit(assessment: AssessmentRow) {
    const status = getAssessmentStatus(assessment.due_date, assessment.score);
    if (status !== "undated" && !filters[status]) {
      setFilters((prev) => ({ ...prev, [status]: true }));
      setFilterHint(
        `Showing ${ASSESSMENT_STATUS_LABELS[status]} so your update stays visible.`
      );
    } else {
      setFilterHint(null);
    }
    setScrollToId(assessment.id);
  }

  function scoreChanged(assessment: AssessmentRow, raw: string): boolean {
    const next =
      raw.trim() === "" ? null : Number(raw.trim());
    if (next != null && Number.isNaN(next)) return true;
    return next !== assessment.score;
  }

  async function onAdd() {
    if (!addClassId) {
      setError("Pick a class.");
      return;
    }
    setError(null);
    setCalendarWarning(null);
    setAddBusy(true);
    try {
      const result = await createAssessment(addClassId, addForm);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.assessment) {
        upsertItem(result.assessment, addClassId);
      }
      if (result.calendarSyncWarning) {
        setCalendarWarning(
          `Assessment saved, but Google Calendar sync failed: ${result.calendarSyncWarning}. Use Sync to Google Calendar to retry.`
        );
      }
      setAddForm(EMPTY_ASSESSMENT_FORM);
      setAddOpen(false);
      router.refresh();
    } finally {
      setAddBusy(false);
    }
  }

  function startEdit(row: AssessmentsPanelItem) {
    setError(null);
    setEditItem(row);
    setEditForm({
      title: row.assessment.title,
      type: row.assessment.type,
      due_date: row.assessment.due_date ?? "",
      weight_percent: String(row.assessment.weight_percent),
      score:
        row.assessment.score != null ? String(row.assessment.score) : "",
      max_score: String(row.assessment.max_score),
    });
    setEditScore(
      row.assessment.score != null ? String(row.assessment.score) : ""
    );
  }

  async function saveEdit() {
    if (!editItem) return;
    setError(null);
    setCalendarWarning(null);
    setEditBusy(true);
    try {
      const result = await patchAssessment(
        editItem.classId,
        editItem.assessment.id,
        editForm
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      let next = result.assessment ?? {
        ...editItem.assessment,
        title: editForm.title.trim(),
        type: editForm.type,
        due_date: editForm.due_date || null,
        weight_percent: Number(editForm.weight_percent),
      };

      if (scoreChanged(editItem.assessment, editScore)) {
        const scoreResult = await saveAssessmentScore({
          classId: editItem.classId,
          assessmentId: editItem.assessment.id,
          rawScore: editScore,
          assessments: items
            .filter((i) => i.classId === editItem.classId)
            .map((i) =>
              i.assessment.id === editItem.assessment.id
                ? next
                : i.assessment
            ),
          targetPercent: null,
        });
        if (scoreResult.error) {
          setError(scoreResult.error);
          return;
        }
        next = { ...next, score: scoreResult.score };
      }

      upsertItem(next, editItem.classId);
      revealAfterEdit(next);
      if (result.calendarSyncWarning) {
        setCalendarWarning(
          `Assessment saved, but Google Calendar sync failed: ${result.calendarSyncWarning}. Use Sync to Google Calendar to retry.`
        );
      }
      setEditItem(null);
      router.refresh();
    } finally {
      setEditBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteItem) return;
    setDeleteBusy(true);
    setError(null);
    setCalendarWarning(null);
    try {
      const result = await deleteAssessment(
        deleteItem.classId,
        deleteItem.assessment.id
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setItems((prev) =>
        prev.filter((x) => x.assessment.id !== deleteItem.assessment.id)
      );
      skipPropSyncUntil.current = Date.now() + 2500;
      if (result.calendarSyncWarning) {
        setCalendarWarning(
          `Assessment deleted, but Google Calendar cleanup failed: ${result.calendarSyncWarning}. You may need to remove the event manually or re-sync.`
        );
      }
      setDeleteItem(null);
      setEditItem(null);
      router.refresh();
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Status filters">
          {FILTER_KEYS.map((key) => {
            const on = filters[key];
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => toggleFilter(key)}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition"
                style={{
                  background: on
                    ? ASSESSMENT_STATUS_COLORS[key]
                    : "transparent",
                  color: on ? "#111" : "var(--muted)",
                  border: on
                    ? "1px solid transparent"
                    : "1px solid var(--line)",
                }}
              >
                {ASSESSMENT_STATUS_LABELS[key]}
              </button>
            );
          })}
        </div>
        {!readOnly && (
          <button
            type="button"
            className="btn btn-ghost text-sm"
            onClick={() => {
              setError(null);
              setAddOpen((v) => !v);
            }}
            disabled={classes.length === 0}
          >
            {addOpen ? "Cancel" : "+ Add assessment"}
          </button>
        )}
      </div>

      {filterHint && (
        <p className="text-sm text-[var(--muted)]">{filterHint}</p>
      )}
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

      {!readOnly && addOpen && (
        <div className="surface space-y-3 rounded-2xl p-5">
          <div>
            <label className="label" htmlFor="assessments-add-class">
              Class
            </label>
            <select
              id="assessments-add-class"
              className="input w-full"
              value={addClassId}
              onChange={(e) => setAddClassId(e.target.value)}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `${c.code} — ${c.name}` : c.name}
                </option>
              ))}
            </select>
          </div>
          <AssessmentEditForm
            idPrefix="assessments-add"
            form={addForm}
            onChange={setAddForm}
            mode="create"
          />
          <button
            type="button"
            className="btn btn-primary text-sm"
            disabled={addBusy || !addClassId}
            onClick={() => void onAdd()}
          >
            {addBusy ? "Adding…" : "Add assessment"}
          </button>
        </div>
      )}

      <ul className="space-y-3">
        {visible.map((row) => {
          const status = getAssessmentStatus(
            row.assessment.due_date,
            row.assessment.score
          );
          const bg =
            status === "undated"
              ? undefined
              : ASSESSMENT_STATUS_COLORS[status];
          const cardClass =
            "w-full rounded-xl border border-black/10 px-3.5 py-3 text-left transition";
          const cardStyle = {
            background: bg ?? "var(--bg-soft)",
            color: bg ? "#111" : "var(--ink)",
          } as const;
          const body = (
            <>
              <p className="text-[15px] font-bold leading-snug">
                {row.assessment.title}
              </p>
              <p className="mt-1 text-xs opacity-80">{row.classLabel}</p>
              <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
                <div>
                  <dt className="text-[10px] uppercase tracking-wide opacity-60">
                    Type
                  </dt>
                  <dd className="font-semibold capitalize">
                    {row.assessment.type}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide opacity-60">
                    Due
                  </dt>
                  <dd className="font-semibold">
                    {row.assessment.due_date ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide opacity-60">
                    Weight
                  </dt>
                  <dd className="font-semibold">
                    {row.assessment.weight_percent}%
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide opacity-60">
                    Score
                  </dt>
                  <dd className="font-semibold">
                    {row.assessment.score != null
                      ? `${row.assessment.score}/${row.assessment.max_score}`
                      : "—"}
                  </dd>
                </div>
              </dl>
            </>
          );
          return (
            <li key={row.assessment.id}>
              {readOnly ? (
                <div
                  id={`assessment-card-${row.assessment.id}`}
                  className={cardClass}
                  style={cardStyle}
                >
                  {body}
                </div>
              ) : (
                <button
                  type="button"
                  id={`assessment-card-${row.assessment.id}`}
                  onClick={() => startEdit(row)}
                  className={`${cardClass} hover:brightness-95`}
                  style={cardStyle}
                >
                  {body}
                </button>
              )}
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="py-10 text-center text-sm text-[var(--muted)]">
            No assessments match these filters.
          </li>
        )}
      </ul>

      {!readOnly && editItem && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-assessment-sheet-title"
        >
          <div className="surface max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl p-5 sm:rounded-2xl sm:p-6">
            <h2
              id="edit-assessment-sheet-title"
              className="font-heading text-2xl"
            >
              Edit assessment
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {editItem.classLabel}
            </p>
            <div className="mt-4 space-y-3">
              <AssessmentEditForm
                idPrefix="assessments-edit"
                form={editForm}
                onChange={setEditForm}
                mode="edit"
              />
              <div>
                <label className="label" htmlFor="assessments-edit-score">
                  Score
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="assessments-edit-score"
                    className="input w-28"
                    type="number"
                    min={0}
                    max={editItem.assessment.max_score}
                    step="0.1"
                    value={editScore}
                    onChange={(e) => setEditScore(e.target.value)}
                    placeholder="—"
                  />
                  <span className="text-xs text-[var(--muted)]">
                    / {editItem.assessment.max_score}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
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
                  onClick={() => setEditItem(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-ghost text-sm text-[var(--danger)]"
                  disabled={editBusy}
                  onClick={() => setDeleteItem(editItem)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!readOnly && deleteItem && (
        <DeleteAssessmentDialog
          title={deleteItem.assessment.title}
          busy={deleteBusy}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteItem(null)}
        />
      )}
    </div>
  );
}
