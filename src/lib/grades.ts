import type { AssessmentRow, RiskStatus } from "./types";

/** Midpoint-style letter → percent map used for target goals. */
export const LETTER_TO_PERCENT: Record<string, number> = {
  "A+": 97,
  A: 93,
  "A-": 90,
  "B+": 87,
  B: 83,
  "B-": 80,
  "C+": 77,
  C: 73,
  "C-": 70,
  "D+": 67,
  D: 63,
  "D-": 60,
  F: 50,
};

export const LETTER_OPTIONS = Object.keys(LETTER_TO_PERCENT);

export function letterToPercent(letter: string): number {
  const key = letter.trim().toUpperCase();
  if (!(key in LETTER_TO_PERCENT)) {
    throw new Error(`Unknown letter grade: ${letter}`);
  }
  return LETTER_TO_PERCENT[key];
}

export function percentToLetter(percent: number): string {
  const entries = Object.entries(LETTER_TO_PERCENT).sort((a, b) => b[1] - a[1]);
  for (const [letter, threshold] of entries) {
    if (percent >= threshold - 2) return letter;
  }
  return "F";
}

function scoreAsPercent(a: AssessmentRow): number | null {
  if (a.score == null) return null;
  if (a.max_score <= 0) return null;
  return (Number(a.score) / Number(a.max_score)) * 100;
}

export interface GradeProjection {
  currentPercent: number | null;
  scoredWeight: number;
  remainingWeight: number;
  targetPercent: number | null;
  requiredAverageOnRemaining: number | null;
  nextAssessment: AssessmentRow | null;
  /** Score % needed on the next unscored assessment alone, assuming other remaining work averages at the target. */
  neededOnNext: number | null;
  status: RiskStatus;
  message: string;
}

/**
 * Grade math assumptions:
 * - Current % = weighted average of scored items only (weights renormalized among scored).
 * - Required average on remaining = (target*totalWeight - earnedPoints) / remainingWeight.
 * - Needed on next item: assume every other remaining item is scored at `targetPercent`,
 *   then solve for the score needed on the next upcoming unscored assessment.
 */
export function computeGradeProjection(
  assessments: AssessmentRow[],
  targetPercent: number | null
): GradeProjection {
  const scored = assessments.filter((a) => a.score != null);
  const unscored = assessments.filter((a) => a.score == null);

  const scoredWeight = scored.reduce((s, a) => s + Number(a.weight_percent), 0);
  const remainingWeight = unscored.reduce((s, a) => s + Number(a.weight_percent), 0);
  const totalWeight = scoredWeight + remainingWeight;

  let earnedPoints = 0;
  for (const a of scored) {
    const pct = scoreAsPercent(a);
    if (pct != null) earnedPoints += pct * Number(a.weight_percent);
  }

  const currentPercent =
    scoredWeight > 0 ? earnedPoints / scoredWeight : null;

  let requiredAverageOnRemaining: number | null = null;
  if (targetPercent != null && remainingWeight > 0 && totalWeight > 0) {
    requiredAverageOnRemaining =
      (targetPercent * totalWeight - earnedPoints) / remainingWeight;
  }

  const nextAssessment =
    unscored
      .filter((a) => a.due_date)
      .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))[0] ??
    unscored[0] ??
    null;

  let neededOnNext: number | null = null;
  if (
    targetPercent != null &&
    nextAssessment &&
    Number(nextAssessment.weight_percent) > 0 &&
    totalWeight > 0
  ) {
    const otherRemaining = remainingWeight - Number(nextAssessment.weight_percent);
    const pointsFromOthers = otherRemaining * targetPercent;
    neededOnNext =
      (targetPercent * totalWeight - earnedPoints - pointsFromOthers) /
      Number(nextAssessment.weight_percent);
  }

  let status: RiskStatus = "insufficient_data";
  let message = "Enter scores or set a target grade to see projections.";

  if (targetPercent == null) {
    status = "insufficient_data";
    message = "Set a target grade to see if you're on track.";
  } else if (scored.length === 0) {
    status = "insufficient_data";
    message = `Target set at ${targetPercent}%. Enter your first score to unlock projections.`;
  } else if (remainingWeight <= 0) {
    const finalPct = currentPercent ?? 0;
    if (finalPct >= targetPercent) {
      status = "on_track";
      message = `Final average ${finalPct.toFixed(1)}% — you hit your ${targetPercent}% goal.`;
    } else if (finalPct >= 60) {
      status = "at_risk";
      message = `Final average ${finalPct.toFixed(1)}% — below your ${targetPercent}% goal.`;
    } else {
      status = "failing_risk";
      message = `Final average ${finalPct.toFixed(1)}% — below passing.`;
    }
  } else if (requiredAverageOnRemaining != null) {
    if (requiredAverageOnRemaining <= 100 && requiredAverageOnRemaining <= targetPercent + 5) {
      status = "on_track";
      message = `On track — you need about ${Math.max(0, requiredAverageOnRemaining).toFixed(0)}% average on remaining work to hit ${targetPercent}%.`;
    } else if (requiredAverageOnRemaining <= 100) {
      status = "at_risk";
      message = `At risk — you need an ${requiredAverageOnRemaining.toFixed(0)}+ average on remaining work to hit your ${targetPercent}% goal.`;
    } else {
      status = "failing_risk";
      message = `Failing risk — even 100% on remaining work may not reach ${targetPercent}%. Minimum needed would be ${requiredAverageOnRemaining.toFixed(0)}%.`;
    }

    if (nextAssessment && neededOnNext != null) {
      message += ` On ${nextAssessment.title}, aim for ~${Math.max(0, neededOnNext).toFixed(0)}% (assuming other remaining work averages at your target).`;
    }
  }

  return {
    currentPercent,
    scoredWeight,
    remainingWeight,
    targetPercent,
    requiredAverageOnRemaining,
    nextAssessment,
    neededOnNext,
    status,
    message,
  };
}
