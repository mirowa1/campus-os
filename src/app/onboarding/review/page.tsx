import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TargetGradeForm } from "./TargetGradeForm";
import type { AssessmentRow, ClassRow } from "@/lib/types";

export default async function OnboardingReviewPage({
  searchParams,
}: {
  searchParams: { classId?: string };
}) {
  const classId = searchParams.classId;
  if (!classId) redirect("/onboarding/upload");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: classRow } = await supabase
    .from("classes")
    .select("*")
    .eq("id", classId)
    .eq("user_id", user.id)
    .single();

  if (!classRow) redirect("/onboarding/upload");

  const { data: assessments } = await supabase
    .from("assessments")
    .select("*")
    .eq("class_id", classId)
    .order("due_date", { ascending: true, nullsFirst: false });

  const cls = classRow as ClassRow;
  const items = (assessments ?? []) as AssessmentRow[];
  const upcoming = items.filter((a) => a.due_date).slice(0, 6);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
        Here&apos;s your semester
      </p>
      <h1 className="font-display mt-3 text-4xl md:text-5xl">
        {cls.code ? `${cls.code} — ` : ""}
        {cls.name}
      </h1>
      {cls.term && (
        <p className="mt-2 text-[var(--muted)]">{cls.term}</p>
      )}

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <section className="surface rounded-2xl p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
            Upcoming deadlines
          </h2>
          <ul className="mt-4 space-y-3">
            {upcoming.map((a) => (
              <li key={a.id} className="flex justify-between gap-3 text-sm">
                <span>
                  <span className="font-medium">{a.title}</span>
                  <span className="block text-xs capitalize text-[var(--muted)]">
                    {a.type}
                  </span>
                </span>
                <span className="shrink-0 text-[var(--muted)]">{a.due_date}</span>
              </li>
            ))}
            {upcoming.length === 0 && (
              <li className="text-sm text-[var(--muted)]">
                No dated assessments found — you can still track grades by weight.
              </li>
            )}
          </ul>
        </section>

        <section className="surface rounded-2xl p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
            Grade weights
          </h2>
          <ul className="mt-4 space-y-2">
            {items.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-sm">
                <span className="truncate pr-3">{a.title}</span>
                <span className="text-[var(--accent)]">{a.weight_percent}%</span>
              </li>
            ))}
            {items.length === 0 && (
              <li className="text-sm text-[var(--muted)]">
                No assessments extracted.
              </li>
            )}
          </ul>
        </section>
      </div>

      <section className="surface mt-6 rounded-2xl p-5">
        <h2 className="font-display text-2xl">Set your target grade</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          We&apos;ll tell you what you need as you enter scores.
        </p>
        <TargetGradeForm classId={cls.id} />
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/onboarding/upload" className="btn btn-ghost">
          Add another class
        </Link>
        <Link href="/dashboard" className="btn btn-primary">
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
