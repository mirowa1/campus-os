/**
 * Assessment status matching ClassToExcel conditional formatting exactly.
 *
 * Excel CF priority (classtoexcel.ts):
 * 1. score set → completed (gray)
 * 2. due < TODAY() → overdue (red)
 * 3. due in [TODAY(), TODAY()+7] → due_soon (yellow)
 * 4. due > TODAY()+7 → upcoming (green)
 * no due → undated (no CF fill)
 *
 * due_date is guaranteed YYYY-MM-DD:
 * - DB: public.assessments.due_date is Postgres `date`
 * - API: assessment-validation requires /^\d{4}-\d{2}-\d{2}$/
 * so lexicographic string compare matches calendar order.
 */

export type AssessmentStatus =
  | "completed"
  | "overdue"
  | "due_soon"
  | "upcoming"
  | "undated";

/** UI hex matching ClassToExcel CF ARGB (sans FF prefix). */
export const ASSESSMENT_STATUS_COLORS: Record<
  Exclude<AssessmentStatus, "undated">,
  string
> = {
  completed: "#D9D9D9",
  overdue: "#F4A6A6",
  due_soon: "#FDE9A0",
  upcoming: "#C6E8B5",
};

export const ASSESSMENT_STATUS_LABELS: Record<
  Exclude<AssessmentStatus, "undated">,
  string
> = {
  completed: "Completed",
  overdue: "Overdue",
  due_soon: "Due ≤7d",
  upcoming: "Upcoming",
};

export function localYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getAssessmentStatus(
  dueDate: string | null,
  score: number | null,
  today: Date = new Date()
): AssessmentStatus {
  if (score != null) return "completed";
  if (!dueDate) return "undated";
  const todayYmd = localYmd(today);
  const soon = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  soon.setDate(soon.getDate() + 7);
  const soonYmd = localYmd(soon);
  if (dueDate < todayYmd) return "overdue";
  if (dueDate <= soonYmd) return "due_soon";
  return "upcoming";
}

const TRIAGE_RANK: Record<AssessmentStatus, number> = {
  overdue: 0,
  due_soon: 1,
  upcoming: 2,
  undated: 3,
  completed: 4,
};

export function compareAssessmentsByTriage(
  a: { due_date: string | null; score: number | null; title: string },
  b: { due_date: string | null; score: number | null; title: string },
  today?: Date
): number {
  const sa = getAssessmentStatus(a.due_date, a.score, today);
  const sb = getAssessmentStatus(b.due_date, b.score, today);
  if (sa !== sb) return TRIAGE_RANK[sa] - TRIAGE_RANK[sb];
  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
  if (a.due_date) return -1;
  if (b.due_date) return 1;
  return a.title.localeCompare(b.title);
}
