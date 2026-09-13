import type { SupabaseClient } from "@supabase/supabase-js";
import { localYmd } from "@/lib/assessment-status";
import { computeGradeProjection } from "@/lib/grades";
import type {
  AssessmentRow,
  AssessmentType,
  ClassMeetingRow,
  ClassRow,
} from "@/lib/types";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type AssistantAssessmentBucket =
  | "completed"
  | "overdue"
  | "due_today"
  | "due_this_week"
  | "upcoming"
  | "undated";

export type AssistantAssessmentFact = {
  id: string;
  classId: string;
  className: string;
  title: string;
  type: AssessmentType;
  dueDate: string | null;
  dayOfWeek: string | null;
  weightPercent: number;
  score: number | null;
  maxScore: number;
  bucket: AssistantAssessmentBucket;
};

export type AssistantCalendarDay = {
  date: string;
  weekday: string;
  isToday: boolean;
};

export type AssistantClassGradeFact = {
  classId: string;
  className: string;
  code: string | null;
  targetPercent: number | null;
  targetLetter: string | null;
  currentPercent: number | null;
  requiredAverageOnRemaining: number | null;
  nextAssessmentTitle: string | null;
  nextAssessmentDueDate: string | null;
  neededOnNext: number | null;
  status: string;
  message: string;
  missingScoreTitles: string[];
};

export type AssistantMeetingFact = {
  classId: string;
  className: string;
  day: string;
  startTime: string;
  endTime: string;
  location: string | null;
};

export type AssistantContext = {
  today: string;
  todayWeekday: string;
  /** Next 14 calendar days including today — use for "Wednesday" / relative dates. */
  calendar: AssistantCalendarDay[];
  classes: {
    id: string;
    name: string;
    code: string | null;
    term: string | null;
  }[];
  assessmentsByBucket: Record<AssistantAssessmentBucket, AssistantAssessmentFact[]>;
  missingScores: AssistantAssessmentFact[];
  grades: AssistantClassGradeFact[];
  schedule: AssistantMeetingFact[];
};

function addDaysYmd(today: Date, days: number): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  d.setDate(d.getDate() + days);
  return localYmd(d);
}

export function getAssistantAssessmentBucket(
  dueDate: string | null,
  score: number | null,
  today: Date = new Date()
): AssistantAssessmentBucket {
  if (score != null) return "completed";
  if (!dueDate) return "undated";
  const todayYmd = localYmd(today);
  const weekEnd = addDaysYmd(today, 7);
  if (dueDate < todayYmd) return "overdue";
  if (dueDate === todayYmd) return "due_today";
  if (dueDate <= weekEnd) return "due_this_week";
  return "upcoming";
}

function weekdayForYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return DAY_NAMES[dt.getDay()] ?? "Unknown";
}

function buildCalendar(today: Date, days = 14): AssistantCalendarDay[] {
  const todayYmd = localYmd(today);
  const out: AssistantCalendarDay[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDaysYmd(today, i);
    out.push({
      date,
      weekday: weekdayForYmd(date),
      isToday: date === todayYmd,
    });
  }
  return out;
}

function trimTime(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function toFact(
  a: AssessmentRow,
  className: string,
  today: Date
): AssistantAssessmentFact {
  return {
    id: a.id,
    classId: a.class_id,
    className,
    title: a.title,
    type: a.type,
    dueDate: a.due_date,
    dayOfWeek: a.due_date ? weekdayForYmd(a.due_date) : null,
    weightPercent: Number(a.weight_percent),
    score: a.score == null ? null : Number(a.score),
    maxScore: Number(a.max_score),
    bucket: getAssistantAssessmentBucket(a.due_date, a.score, today),
  };
}

/**
 * Build structured coursework facts for the authenticated user only.
 * Ownership is enforced at the query layer via classes.user_id = userId.
 */
export async function buildAssistantContext(
  supabase: SupabaseClient,
  userId: string,
  today: Date = new Date()
): Promise<AssistantContext> {
  const { data: classes, error: classError } = await supabase
    .from("classes")
    .select(
      "id, user_id, name, code, term, target_letter, target_percent, created_at, syllabus_path, syllabus_file_name"
    )
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (classError) throw classError;

  const classRows = (classes ?? []) as ClassRow[];
  const classIds = classRows.map((c) => c.id);
  const classNameById = new Map(classRows.map((c) => [c.id, c.name]));

  let assessments: AssessmentRow[] = [];
  let meetings: ClassMeetingRow[] = [];

  if (classIds.length > 0) {
    const [{ data: aData, error: aErr }, { data: mData, error: mErr }] =
      await Promise.all([
        supabase
          .from("assessments")
          .select(
            "id, class_id, title, type, due_date, weight_percent, score, max_score, created_at"
          )
          .in("class_id", classIds),
        supabase
          .from("class_meetings")
          .select(
            "id, class_id, user_id, day_of_week, start_time, end_time, location, term_start_date, term_end_date, created_at"
          )
          .eq("user_id", userId)
          .in("class_id", classIds),
      ]);
    if (aErr) throw aErr;
    if (mErr) throw mErr;
    assessments = (aData ?? []) as AssessmentRow[];
    meetings = (mData ?? []) as ClassMeetingRow[];
  }

  const emptyBuckets: AssistantContext["assessmentsByBucket"] = {
    completed: [],
    overdue: [],
    due_today: [],
    due_this_week: [],
    upcoming: [],
    undated: [],
  };

  const facts = assessments.map((a) =>
    toFact(a, classNameById.get(a.class_id) || "Class", today)
  );

  for (const f of facts) {
    emptyBuckets[f.bucket].push(f);
  }

  for (const key of Object.keys(emptyBuckets) as AssistantAssessmentBucket[]) {
    emptyBuckets[key].sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return a.title.localeCompare(b.title);
    });
  }

  const grades: AssistantClassGradeFact[] = classRows.map((c) => {
    const classAssessments = assessments.filter((a) => a.class_id === c.id);
    const projection = computeGradeProjection(
      classAssessments,
      c.target_percent
    );
    return {
      classId: c.id,
      className: c.name,
      code: c.code,
      targetPercent: c.target_percent,
      targetLetter: c.target_letter,
      currentPercent:
        projection.currentPercent == null
          ? null
          : Math.round(projection.currentPercent * 10) / 10,
      requiredAverageOnRemaining:
        projection.requiredAverageOnRemaining == null
          ? null
          : Math.round(projection.requiredAverageOnRemaining * 10) / 10,
      nextAssessmentTitle: projection.nextAssessment?.title ?? null,
      nextAssessmentDueDate: projection.nextAssessment?.due_date ?? null,
      neededOnNext:
        projection.neededOnNext == null
          ? null
          : Math.round(projection.neededOnNext * 10) / 10,
      status: projection.status,
      message: projection.message,
      missingScoreTitles: classAssessments
        .filter((a) => a.score == null)
        .map((a) => a.title),
    };
  });

  const schedule: AssistantMeetingFact[] = meetings
    .map((m) => ({
      classId: m.class_id,
      className: classNameById.get(m.class_id) || "Class",
      day: DAY_NAMES[m.day_of_week] ?? `Day ${m.day_of_week}`,
      startTime: trimTime(m.start_time),
      endTime: trimTime(m.end_time),
      location: m.location,
    }))
    .sort((a, b) => {
      const dayA = DAY_NAMES.indexOf(a.day as (typeof DAY_NAMES)[number]);
      const dayB = DAY_NAMES.indexOf(b.day as (typeof DAY_NAMES)[number]);
      if (dayA !== dayB) return dayA - dayB;
      return a.startTime.localeCompare(b.startTime);
    });

  return {
    today: localYmd(today),
    todayWeekday: DAY_NAMES[today.getDay()] ?? weekdayForYmd(localYmd(today)),
    calendar: buildCalendar(today, 14),
    classes: classRows.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      term: c.term,
    })),
    assessmentsByBucket: emptyBuckets,
    missingScores: facts.filter((f) => f.score == null),
    grades,
    schedule,
  };
}
