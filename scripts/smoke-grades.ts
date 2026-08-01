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

/** Reject any "~N%" or "Minimum needed would be N%" where N > 100. */
function assertNoImpossiblePercents(message: string) {
  assert(!/Minimum needed would be/i.test(message), `should not mention Minimum needed: ${message}`);
  const aimMatches = [...message.matchAll(/aim for ~(\d+)%/gi)];
  for (const m of aimMatches) {
    const n = Number(m[1]);
    assert(n <= 100, `message must not aim above 100%: ${message}`);
  }
  const barePercents = [...message.matchAll(/(\d+)%/g)];
  for (const m of barePercents) {
    // Allow target/current numbers in copy; flag only if we somehow print impossible aims.
    // Stricter: no standalone percent tokens > 100 anywhere in message.
    const n = Number(m[1]);
    assert(n <= 100, `message must never show >100%: found ${n}% in: ${message}`);
  }
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
assertNoImpossiblePercents(proj.message);

// Unreachable overall + next assessment: low scored weight, high target, small next item
const unreachable: AssessmentRow[] = [
  {
    ...base,
    id: "u1",
    title: "Quiz 1",
    type: "quiz",
    due_date: "2026-01-15",
    weight_percent: 80,
    score: 40,
  },
  {
    ...base,
    id: "u2",
    title: "Project Charter",
    type: "project",
    due_date: "2026-03-01",
    weight_percent: 10,
    score: null,
  },
  {
    ...base,
    id: "u3",
    title: "Final",
    type: "exam",
    due_date: "2026-05-01",
    weight_percent: 10,
    score: null,
  },
];

const failProj = computeGradeProjection(unreachable, 95);
assert(failProj.status === "failing_risk", `expected failing_risk, got ${failProj.status}`);
assert(
  failProj.requiredAverageOnRemaining != null && failProj.requiredAverageOnRemaining > 100,
  `requiredAverageOnRemaining should be >100, got ${failProj.requiredAverageOnRemaining}`
);
assert(
  failProj.neededOnNext != null && failProj.neededOnNext > 100,
  `neededOnNext should be >100, got ${failProj.neededOnNext}`
);
assert(/Failing risk/i.test(failProj.message), `expected failing-risk language: ${failProj.message}`);
assert(
  /not achievable even with 100%/i.test(failProj.message),
  `expected not-achievable language: ${failProj.message}`
);
assert(!/aim for ~/i.test(failProj.message), `should not aim for % when >100: ${failProj.message}`);
assertNoImpossiblePercents(failProj.message);

// neededOnNext > 100 while overall remaining average still <= 100
const heavyNext: AssessmentRow[] = [
  {
    ...base,
    id: "h1",
    title: "Quiz 1",
    type: "quiz",
    due_date: "2026-01-15",
    weight_percent: 50,
    score: 85,
  },
  {
    ...base,
    id: "h2",
    title: "Tiny Quiz",
    type: "quiz",
    due_date: "2026-03-01",
    weight_percent: 5,
    score: null,
  },
  {
    ...base,
    id: "h3",
    title: "Final",
    type: "exam",
    due_date: "2026-05-01",
    weight_percent: 45,
    score: null,
  },
];

const heavyProj = computeGradeProjection(heavyNext, 87);
assert(
  heavyProj.requiredAverageOnRemaining != null && heavyProj.requiredAverageOnRemaining <= 100,
  `required avg should be <=100, got ${heavyProj.requiredAverageOnRemaining}`
);
assert(
  heavyProj.neededOnNext != null && heavyProj.neededOnNext > 100,
  `neededOnNext should be >100, got ${heavyProj.neededOnNext}`
);
assert(
  /not achievable even with 100%/i.test(heavyProj.message),
  `expected not-achievable appendix: ${heavyProj.message}`
);
assert(!/aim for ~/i.test(heavyProj.message), `should not aim when neededOnNext >100: ${heavyProj.message}`);
assertNoImpossiblePercents(heavyProj.message);

console.log("smoke-grades OK");
console.log({
  baseline: {
    currentPercent: proj.currentPercent,
    requiredAverageOnRemaining: proj.requiredAverageOnRemaining,
    neededOnNext: proj.neededOnNext,
    status: proj.status,
    message: proj.message,
  },
  unreachable: {
    requiredAverageOnRemaining: failProj.requiredAverageOnRemaining,
    neededOnNext: failProj.neededOnNext,
    status: failProj.status,
    message: failProj.message,
  },
  heavyNext: {
    requiredAverageOnRemaining: heavyProj.requiredAverageOnRemaining,
    neededOnNext: heavyProj.neededOnNext,
    status: heavyProj.status,
    message: heavyProj.message,
  },
});
