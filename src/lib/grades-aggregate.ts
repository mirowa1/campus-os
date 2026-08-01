import { computeGradeProjection, type GradeProjection } from "@/lib/grades";
import type { AssessmentRow, ClassRow, RiskStatus } from "@/lib/types";

export type TrendDirection = "up" | "down" | "flat" | null;

export type ClassGradeSummary = {
  classRow: ClassRow;
  projection: GradeProjection;
  nextDueDate: string | null;
  gapToTarget: number | null;
  urgencyScore: number;
  trend: TrendDirection;
  trendDelta: number | null;
};

export type FocusThisWeek = {
  classId: string;
  classLabel: string;
  assessmentTitle: string;
  dueDate: string | null;
  line: string;
} | null;

function statusUrgency(status: RiskStatus): number {
  switch (status) {
    case "failing_risk":
      return 3;
    case "at_risk":
      return 2;
    case "on_track":
      return 0;
    default:
      return 1;
  }
}

function daysUntil(due: string | null, todayIso: string): number {
  if (!due) return 9999;
  const a = Date.parse(due + "T00:00:00");
  const b = Date.parse(todayIso + "T00:00:00");
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}

/**
 * Aggregate per-class grade projections for the Grades tab.
 * Reuses computeGradeProjection — no new grade math.
 */
export function buildClassGradeSummaries(input: {
  classes: ClassRow[];
  assessmentsByClass: Map<string, AssessmentRow[]>;
  /** Latest class_average_before from score_history per class_id */
  previousAverageByClass: Map<string, number | null>;
  todayIso?: string;
}): ClassGradeSummary[] {
  const today =
    input.todayIso ?? new Date().toISOString().slice(0, 10);

  const rows: ClassGradeSummary[] = input.classes.map((classRow) => {
    const assessments = input.assessmentsByClass.get(classRow.id) ?? [];
    const target =
      classRow.target_percent != null
        ? Number(classRow.target_percent)
        : null;
    const projection = computeGradeProjection(assessments, target);

    const nextDueDate = projection.nextAssessment?.due_date ?? null;
    const gapToTarget =
      projection.currentPercent != null && target != null
        ? target - projection.currentPercent
        : null;

    const days = daysUntil(nextDueDate, today);
    // Soon due + further below target + worse status → higher urgency
    const dueUrgency = nextDueDate ? Math.max(0, 120 - days) : 0;
    const gapUrgency = gapToTarget != null ? Math.max(0, gapToTarget) * 2 : 0;
    const urgencyScore =
      dueUrgency + gapUrgency + statusUrgency(projection.status) * 40;

    const prev = input.previousAverageByClass.get(classRow.id);
    let trend: TrendDirection = null;
    let trendDelta: number | null = null;
    if (
      projection.currentPercent != null &&
      prev != null &&
      Number.isFinite(prev)
    ) {
      trendDelta = projection.currentPercent - Number(prev);
      if (Math.abs(trendDelta) < 0.05) trend = "flat";
      else if (trendDelta > 0) trend = "up";
      else trend = "down";
    }

    return {
      classRow,
      projection,
      nextDueDate,
      gapToTarget,
      urgencyScore,
      trend,
      trendDelta,
    };
  });

  rows.sort((a, b) => b.urgencyScore - a.urgencyScore);
  return rows;
}

/** Simple unweighted mean of classes that have a current average. */
export function projectedSemesterAverage(
  summaries: ClassGradeSummary[]
): number | null {
  const vals = summaries
    .map((s) => s.projection.currentPercent)
    .filter((v): v is number => v != null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/**
 * Most urgent class/assessment: nearest due among unscored + largest gap-to-target.
 */
export function focusThisWeek(summaries: ClassGradeSummary[]): FocusThisWeek {
  if (!summaries.length) return null;

  const focus = summaries[0];
  const next = focus.projection.nextAssessment;
  const label =
    focus.classRow.code || focus.classRow.name;
  if (!next) {
    return {
      classId: focus.classRow.id,
      classLabel: label,
      assessmentTitle: "upcoming work",
      dueDate: null,
      line: `Focus this week: ${label} — enter scores or set a target to get a clearer plan.`,
    };
  }

  const dueBit = next.due_date ? ` (due ${next.due_date})` : "";
  const gapBit =
    focus.gapToTarget != null && focus.gapToTarget > 0
      ? ` — ${focus.gapToTarget.toFixed(0)} pts below target`
      : focus.projection.status === "at_risk" ||
          focus.projection.status === "failing_risk"
        ? ` — ${focus.projection.status.replace("_", " ")}`
        : "";

  return {
    classId: focus.classRow.id,
    classLabel: label,
    assessmentTitle: next.title,
    dueDate: next.due_date,
    line: `Focus this week: ${next.title} in ${label}${dueBit}${gapBit}.`,
  };
}
