import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { CalendarView, type CalendarEvent } from "@/components/CalendarView";
import { createClient } from "@/lib/supabase/server";
import type { AssessmentRow, ClassRow } from "@/lib/types";

export default async function CalendarPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: classes } = await supabase
    .from("classes")
    .select("*")
    .eq("user_id", user.id);

  const classList = (classes ?? []) as ClassRow[];
  const ids = classList.map((c) => c.id);

  const { data: assessments } =
    ids.length > 0
      ? await supabase.from("assessments").select("*").in("class_id", ids)
      : { data: [] };

  const all = (assessments ?? []) as AssessmentRow[];
  const events: CalendarEvent[] = classList.flatMap((c) =>
    all
      .filter((a) => a.class_id === c.id)
      .map((a) => ({
        ...a,
        className: c.code || c.name,
        classId: c.id,
      }))
  );

  return (
    <div>
      <AppNav email={user.email} />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="font-display text-4xl">Calendar</h1>
        <p className="mt-2 text-[var(--muted)]">
          Assignments and exams from your syllabi in one place.
        </p>
        <div className="mt-8">
          <CalendarView events={events} />
        </div>
      </main>
    </div>
  );
}
