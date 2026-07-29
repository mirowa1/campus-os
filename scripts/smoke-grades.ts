/**
 * Smoke test for grade projection math (no network).
 * Run: npx tsx scripts/smoke-grades.ts
 */
import {
  computeGradeProjection,
  letterToPercent,
} from "../src/lib/grades";
import type { AssessmentRow } from "../src/lib/types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const base = {
  class_id: "c1",
  max_score: 100,
  created_at: new Date().toISOString(),
};

const assessments: AssessmentRow[] = [
  {
    ...base,
    id: "1",
    title: "Quiz 1",
    type: "quiz",
    due_date: "2026-02-01",
    weight_percent: 20,
    score: 70,
  },
  {
    ...base,
    id: "2",
    title: "Quiz 2",
    type: "quiz",
    due_date: "2026-03-01",
    weight_percent: 20,
    score: 80,
  },
  {
    ...base,
    id: "3",
    title: "Midterm",
    type: "exam",
    due_date: "2026-04-01",
    weight_percent: 30,
    score: null,
  },
  {
    ...base,
    id: "4",
    title: "Final",
    type: "exam",
    due_date: "2026-05-01",
    weight_percent: 30,
    score: null,
  },
];

const target = letterToPercent("B+"); // 87
const proj = computeGradeProjection(assessments, target);

assert(proj.currentPercent != null, "currentPercent set");
assert(Math.abs(proj.currentPercent! - 75) < 0.01, `expected 75, got ${proj.currentPercent}`);
assert(proj.remainingWeight === 60, `remainingWeight ${proj.remainingWeight}`);
assert(proj.requiredAverageOnRemaining != null, "required avg set");
assert(proj.nextAssessment?.title === "Midterm", "next is Midterm");
assert(
  proj.status === "at_risk" || proj.status === "on_track" || proj.status === "failing_risk",
  `status ${proj.status}`
);

console.log("smoke-grades OK");
console.log({
  currentPercent: proj.currentPercent,
  requiredAverageOnRemaining: proj.requiredAverageOnRemaining,
  neededOnNext: proj.neededOnNext,
  status: proj.status,
  message: proj.message,
});
