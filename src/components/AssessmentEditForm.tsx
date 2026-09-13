"use client";

import type { AssessmentType } from "@/lib/types";
import type { AssessmentFormFields } from "@/lib/assessment-client";

const ASSESSMENT_TYPES: AssessmentType[] = [
  "assignment",
  "quiz",
  "exam",
  "other",
];

type Props = {
  idPrefix: string;
  form: AssessmentFormFields;
  onChange: (next: AssessmentFormFields) => void;
  /** When true, show max_score + optional score (create flow). */
  includeScoreAndMax?: boolean;
  /** Omit score/max fields even if includeScoreAndMax — edit mode default. */
  mode?: "create" | "edit";
};

export function AssessmentEditForm({
  idPrefix,
  form,
  onChange,
  includeScoreAndMax = false,
  mode = "edit",
}: Props) {
  const showScoreFields = mode === "create" || includeScoreAndMax;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="label" htmlFor={`${idPrefix}-title`}>
          Title
        </label>
        <input
          id={`${idPrefix}-title`}
          className="input w-full"
          value={form.title}
          onChange={(e) => onChange({ ...form, title: e.target.value })}
          placeholder="Midterm exam"
        />
      </div>
      <div>
        <label className="label" htmlFor={`${idPrefix}-type`}>
          Type
        </label>
        <select
          id={`${idPrefix}-type`}
          className="input w-full"
          value={form.type}
          onChange={(e) =>
            onChange({ ...form, type: e.target.value as AssessmentType })
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
        <label className="label" htmlFor={`${idPrefix}-due`}>
          Due date
        </label>
        <input
          id={`${idPrefix}-due`}
          className="input w-full"
          type="date"
          value={form.due_date}
          onChange={(e) => onChange({ ...form, due_date: e.target.value })}
        />
      </div>
      <div>
        <label className="label" htmlFor={`${idPrefix}-weight`}>
          Weight %
        </label>
        <input
          id={`${idPrefix}-weight`}
          className="input w-full"
          type="number"
          min={0}
          step="0.1"
          value={form.weight_percent}
          onChange={(e) =>
            onChange({ ...form, weight_percent: e.target.value })
          }
        />
      </div>
      {showScoreFields && (
        <>
          <div>
            <label className="label" htmlFor={`${idPrefix}-max`}>
              Max score
            </label>
            <input
              id={`${idPrefix}-max`}
              className="input w-full"
              type="number"
              min={1}
              step="0.1"
              value={form.max_score}
              onChange={(e) =>
                onChange({ ...form, max_score: e.target.value })
              }
            />
          </div>
          <div>
            <label className="label" htmlFor={`${idPrefix}-score`}>
              Score (optional)
            </label>
            <input
              id={`${idPrefix}-score`}
              className="input w-full"
              type="number"
              min={0}
              step="0.1"
              value={form.score}
              onChange={(e) => onChange({ ...form, score: e.target.value })}
            />
          </div>
        </>
      )}
    </div>
  );
}
