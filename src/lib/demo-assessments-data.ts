import type { AssessmentsPanelItem } from "@/components/AssessmentsPanel";
import {
  getAssessmentStatus,
  type AssessmentStatus,
} from "@/lib/assessment-status";
import type { AssessmentRow, ClassRow } from "@/lib/types";

/** Relative YMD so CF colors stay correct as the calendar moves. */
function daysFromNow(n: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DEMO_USER = "demo-user";

const DEMO_CLASSES: Pick<ClassRow, "id" | "name" | "code">[] = [
  { id: "demo-class-mktg", name: "Principles of Marketing", code: "MKTG 101" },
  { id: "demo-class-calc", name: "Calculus I", code: "CACL 3427" },
  { id: "demo-class-cs", name: "Data Structures", code: "CSCI 4200" },
  { id: "demo-class-eng", name: "College Writing II", code: "ENG 2101" },
  { id: "demo-class-psy", name: "Intro to Psychology", code: "PSYC 1101" },
];

type DemoAssessmentSeed = {
  id: string;
  classId: string;
  title: string;
  type: AssessmentRow["type"];
  dueOffsetDays: number | null;
  weight_percent: number;
  score: number | null;
  max_score: number;
};

/** Mix covers overdue / due_soon / upcoming / completed across 5 classes. */
const DEMO_ASSESSMENT_SEEDS: DemoAssessmentSeed[] = [
  {
    id: "demo-a-overdue-1",
    classId: "demo-class-mktg",
    title: "Case Study: Brand Positioning",
    type: "assignment",
    dueOffsetDays: -4,
    weight_percent: 10,
    score: null,
    max_score: 100,
  },
  {
    id: "demo-a-overdue-2",
    classId: "demo-class-calc",
    title: "Problem Set 4",
    type: "assignment",
    dueOffsetDays: -1,
    weight_percent: 5,
    score: null,
    max_score: 50,
  },
  {
    id: "demo-a-soon-1",
    classId: "demo-class-cs",
    title: "Quiz 3 — Trees & Heaps",
    type: "quiz",
    dueOffsetDays: 2,
    weight_percent: 8,
    score: null,
    max_score: 20,
  },
  {
    id: "demo-a-soon-2",
    classId: "demo-class-eng",
    title: "Draft: Research Paper",
    type: "assignment",
    dueOffsetDays: 5,
    weight_percent: 15,
    score: null,
    max_score: 100,
  },
  {
    id: "demo-a-upcoming-1",
    classId: "demo-class-psy",
    title: "Midterm Exam",
    type: "exam",
    dueOffsetDays: 18,
    weight_percent: 25,
    score: null,
    max_score: 100,
  },
  {
    id: "demo-a-upcoming-2",
    classId: "demo-class-mktg",
    title: "Group Project — Campaign Proposal",
    type: "assignment",
    dueOffsetDays: 28,
    weight_percent: 20,
    score: null,
    max_score: 100,
  },
  {
    id: "demo-a-done-1",
    classId: "demo-class-calc",
    title: "Quiz 2",
    type: "quiz",
    dueOffsetDays: -14,
    weight_percent: 5,
    score: 18,
    max_score: 20,
  },
  {
    id: "demo-a-done-2",
    classId: "demo-class-cs",
    title: "Lab 2 — Linked Lists",
    type: "assignment",
    dueOffsetDays: -10,
    weight_percent: 10,
    score: 92,
    max_score: 100,
  },
  {
    id: "demo-a-done-3",
    classId: "demo-class-eng",
    title: "Reading Response 3",
    type: "assignment",
    dueOffsetDays: -7,
    weight_percent: 5,
    score: 9,
    max_score: 10,
  },
];

function toAssessmentRow(seed: DemoAssessmentSeed): AssessmentRow {
  return {
    id: seed.id,
    class_id: seed.classId,
    title: seed.title,
    type: seed.type,
    due_date:
      seed.dueOffsetDays == null ? null : daysFromNow(seed.dueOffsetDays),
    weight_percent: seed.weight_percent,
    score: seed.score,
    max_score: seed.max_score,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

export function getDemoAssessmentClasses(): Pick<
  ClassRow,
  "id" | "name" | "code"
>[] {
  return DEMO_CLASSES;
}

/** Static panel props — never query the database. */
export function getDemoAssessmentPanelProps(): {
  items: AssessmentsPanelItem[];
  classes: Pick<ClassRow, "id" | "name" | "code">[];
} {
  void DEMO_USER;
  const classById = new Map(DEMO_CLASSES.map((c) => [c.id, c]));
  const items: AssessmentsPanelItem[] = DEMO_ASSESSMENT_SEEDS.map((seed) => {
    const cls = classById.get(seed.classId)!;
    const classLabel = cls.code ? `${cls.code} — ${cls.name}` : cls.name;
    return {
      assessment: toAssessmentRow(seed),
      classId: cls.id,
      classLabel,
    };
  });
  return { items, classes: DEMO_CLASSES };
}

/** Canned assistant copy grounded in the same static demo items (no API). */
export function buildDemoAssistantScript(items: AssessmentsPanelItem[]): {
  userMessage: string;
  assistantMessage: string;
} {
  const today = new Date();
  const byStatus = (status: AssessmentStatus) =>
    items.filter(
      (row) =>
        getAssessmentStatus(
          row.assessment.due_date,
          row.assessment.score,
          today
        ) === status
    );

  const dueSoon = byStatus("due_soon");
  const overdue = byStatus("overdue");

  const dueSoonList =
    dueSoon.length === 0
      ? "none in the next 7 days"
      : dueSoon.map((r) => r.assessment.title).join("; ");

  const overdueNearest = overdue[0]?.assessment.title ?? "none";

  return {
    userMessage: "What's due this week?",
    assistantMessage: `You have ${dueSoon.length} assessment${
      dueSoon.length === 1 ? "" : "s"
    } due within 7 days: ${dueSoonList}. Your next overdue item is ${overdueNearest}.`,
  };
}
