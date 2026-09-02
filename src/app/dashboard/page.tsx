import Link from "next/link";
import { format, isAfter, parseISO, startOfDay } from "date-fns";
import type { Metadata } from "next";
import { AppNav } from "@/components/AppNav";
import { StatusBadge } from "@/components/StatusBadge";
import { computeGradeProjection } from "@/lib/grades";
import { getUserOrRedirect } from "@/lib/supabase/get-user-or-redirect";
import { createClient } from "@/lib/supabase/server";
import type { AssessmentRow, ClassRow } from "@/lib/types";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const supabase = createClient();
  const user = await getUserOrRedirect(supabase);

  const { data: classes } = await supabase
    .from("classes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const classList = (classes ?? []) as ClassRow[];

  if (classList.length === 0) {
    return (
      <div className="hero-blob-shell">
        <div className="hero-blob" aria-hidden />
        <AppNav email={user.email} />
        <main className="mx-auto max-w-6xl px-6 py-10">
          <h1 className="font-heading text-4xl">Today</h1>
          <p className="mt-2 text-[var(--muted)]">
            {format(new Date(), "EEEE, MMMM d")}
          </p>

          <div className="surface mt-10 rounded-2xl p-12 text-center">
            <p className="font-heading text-3xl">Welcome to Coursework</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Add your first class manually or upload a syllabus to auto-parse
              deadlines and grades.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/classes/new" className="btn btn-primary">
                + Add Class
              </Link>
              <Link href="/onboarding/upload" className="btn btn-ghost">
                + Upload Syllabus
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const { data: assessments } = await supabase
    .from("assessments")
    .select("*")
    .in(
      "class_id",
      classList.map((c) => c.id)
    );

  const allAssessments = (assessments ?? []) as AssessmentRow[];
  const today = startOfDay(new Date());

  const upcoming = allAssessments
    .filter((a) => a.due_date && !isAfter(today, parseISO(a.due_date)))
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
    .slice(0, 8);

  const classMap = new Map(classList.map((c) => [c.id, c]));

  return (
    <div className="hero-blob-shell">
      <div className="hero-blob" aria-hidden />
      <AppNav email={user.email} />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="font-heading text-4xl">Today</h1>
        <p className="mt-2 text-[var(--muted)]">
          {format(new Date(), "EEEE, MMMM d")} — deadlines and grade pulse.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-5">
          <section className="surface rounded-2xl p-6 lg:col-span-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
              Upcoming deadlines
            </h2>
            <ul className="mt-4 divide-y divide-[var(--line)]">
              {upcoming.map((a) => {
                const cls = classMap.get(a.class_id);
                return (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-medium">{a.title}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {cls?.code || cls?.name} · {a.type}
                      </p>
                    </div>
                    <div className="text-right">
                      <p>{a.due_date}</p>
                      <Link
                        href={`/classes/${a.class_id}`}
                        className="text-xs text-[var(--accent)] hover:underline"
                      >
                        Open class
                      </Link>
                    </div>
                  </li>
                );
              })}
              {upcoming.length === 0 && (
                <li className="py-8 text-center text-sm text-[var(--muted)]">
                  No upcoming dated assessments.
                </li>
              )}
            </ul>
          </section>

          <section className="space-y-4 lg:col-span-2">
            <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
              Classes
            </h2>
            {classList.map((c) => {
              const items = allAssessments.filter((a) => a.class_id === c.id);
              const proj = computeGradeProjection(
                items,
                c.target_percent != null ? Number(c.target_percent) : null
              );
              return (
                <Link
                  key={c.id}
                  href={`/classes/${c.id}`}
                  className="surface block rounded-2xl p-6"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {c.code || c.name}
                      </p>
                      {c.code && (
                        <p className="text-xs text-[var(--muted)]">{c.name}</p>
                      )}
                    </div>
                    <StatusBadge status={proj.status} />
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {proj.currentPercent != null
                      ? `Current ${proj.currentPercent.toFixed(1)}%`
                      : "No scores yet"}
                    {c.target_letter ? ` · goal ${c.target_letter}` : ""}
                  </p>
                </Link>
              );
            })}
            <Link href="/onboarding/upload" className="btn btn-ghost w-full">
              + Add another class
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
}
