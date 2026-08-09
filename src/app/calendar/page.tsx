import {
  addMonths,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import {
  CalendarView,
  type AssessmentCalItem,
  type MeetingCalItem,
  type PersonalCalItem,
} from "@/components/CalendarView";
import { expandMeetingsToCalItems } from "@/lib/class-meetings";
import { createClient } from "@/lib/supabase/server";
import type {
  AssessmentRow,
  CalendarEventRow,
  ClassMeetingRow,
  ClassRow,
} from "@/lib/types";

/**
 * Calendar shows syllabus assessments (by due_date), recurring class meetings,
 * plus personal reminders.
 */
export default async function CalendarPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: classes } = await supabase
    .from("classes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const classList = (classes ?? []) as ClassRow[];
  const ids = classList.map((c) => c.id);
  const byId = new Map(classList.map((c) => [c.id, c]));

  const [{ data: assessments }, { data: personal }, { data: meetings }] =
    await Promise.all([
      ids.length > 0
        ? supabase.from("assessments").select("*").in("class_id", ids)
        : Promise.resolve({ data: [] as AssessmentRow[] }),
      supabase
        .from("calendar_events")
        .select("*")
        .eq("user_id", user.id)
        .order("event_date", { ascending: true }),
      ids.length > 0
        ? supabase.from("class_meetings").select("*").in("class_id", ids)
        : Promise.resolve({ data: [] as ClassMeetingRow[] }),
    ]);

  const assessmentItems: AssessmentCalItem[] = (
    (assessments ?? []) as AssessmentRow[]
  )
    .filter((a) => a.due_date)
    .map((a) => {
      const c = byId.get(a.class_id);
      return {
        kind: "assessment" as const,
        id: a.id,
        title: a.title,
        date: a.due_date!,
        classId: a.class_id,
        classLabel: c ? c.code || c.name : "Class",
        type: a.type,
      };
    });

  const personalItems: PersonalCalItem[] = (
    (personal ?? []) as CalendarEventRow[]
  ).map((e) => {
    const c = e.class_id ? byId.get(e.class_id) : undefined;
    return {
      kind: "personal" as const,
      id: e.id,
      title: e.title,
      date: e.event_date,
      classId: e.class_id,
      classLabel: c ? c.code || c.name : null,
      userId: e.user_id,
    };
  });

  // Expand meetings across a wide window so month navigation still has chips.
  const rangeStart = startOfWeek(startOfMonth(subMonths(new Date(), 2)));
  const rangeEnd = endOfWeek(endOfMonth(addMonths(new Date(), 6)));
  const meetingItems: MeetingCalItem[] = expandMeetingsToCalItems(
    (meetings ?? []) as ClassMeetingRow[],
    byId,
    rangeStart,
    rangeEnd
  );

  return (
    <div>
      <AppNav email={user.email} />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="font-heading text-4xl">Calendar</h1>
        <p className="mt-2 text-[var(--muted)]">
          Assignments from syllabi, recurring class times, and personal
          reminders.
        </p>
        <div className="mt-8">
          <CalendarView
            assessments={assessmentItems}
            personalEvents={personalItems}
            meetingEvents={meetingItems}
            classes={classList}
          />
        </div>
      </main>
    </div>
  );
}
