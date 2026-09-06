import Link from "next/link";
import type { Metadata } from "next";
import { AppNav } from "@/components/AppNav";
import { StatusBadge } from "@/components/StatusBadge";
import {
  buildClassGradeSummaries,
  focusThisWeek,
  projectedSemesterAverage,
} from "@/lib/grades-aggregate";
import { getUserOrRedirect } from "@/lib/supabase/get-user-or-redirect";
import { createClient } from "@/lib/supabase/server";
import type { AssessmentRow, ClassRow } from "@/lib/types";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function TrendArrow({
  trend,
  delta,
}: {
  trend: "up" | "down" | "flat" | null;
  delta: number | null;
}) {
  if (!trend || delta == null) {
    return (
      <span className="text-xs text-[var(--muted)]" title="No prior score yet">
        —
      </span>
    );
  }
  if (trend === "flat") {
    return (
      <span className="text-xs text-[var(--muted)]" title="Unchanged vs last score">
        → 0.0
      </span>
    );
  }
  if (trend === "up") {
    return (
      <span
        className="text-xs font-medium text-[var(--accent)]"
        title="Up since last score entry"
      >
        ↑ {delta.toFixed(1)}
      </span>
    );
  }
  return (
    <span
      className="text-xs font-medium text-[var(--danger)]"
      title="Down since last score entry"
    >
      ↓ {Math.abs(delta).toFixed(1)}
    </span>
  );
}

export default async function GradesPage() {
  const supabase = createClient();
  const user = await getUserOrRedirect(supabase);

  const { data: classes } = await supabase
    .from("classes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const classList = (classes ?? []) as ClassRow[];
  const ids = classList.map((c) => c.id);

  const [{ data: assessments }, { data: history }] = await Promise.all([
    ids.length
      ? supabase.from("assessments").select("*").in("class_id", ids)
      : Promise.resolve({ data: [] as AssessmentRow[] }),
    ids.length
      ? supabase
          .from("score_history")
          .select("class_id, class_average_before, created_at")
          .eq("user_id", user.id)
          .in("class_id", ids)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { class_id: string; class_average_before: number | null }[] }),
  ]);

  const all = (assessments ?? []) as AssessmentRow[];
  const byClass = new Map<string, AssessmentRow[]>();
  for (const a of all) {
    const list = byClass.get(a.class_id) ?? [];
    list.push(a);
    byClass.set(a.class_id, list);
  }

  const previousAverageByClass = new Map<string, number | null>();
  for (const row of history ?? []) {
    if (previousAverageByClass.has(row.class_id)) continue;
    previousAverageByClass.set(
      row.class_id,
      row.class_average_before != null
        ? Number(row.class_average_before)
        : null
    );
  }

  const summaries = buildClassGradeSummaries({
    classes: classList,
    assessmentsByClass: byClass,
    previousAverageByClass,
  });
  const semesterAvg = projectedSemesterAverage(summaries);
  const focus = focusThisWeek(summaries);

  return (
    <div>
      <AppNav email={user.email} />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="font-heading text-4xl">Grades</h1>
        <p className="mt-2 text-[var(--muted)]">
          All classes in one place — same math as each class page.
        </p>

        {focus && (
          <div className="surface mt-8 rounded-2xl border-[var(--accent)]/25 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
              Focus this week
            </p>
            <p className="mt-2 text-sm md:text-base">
              <Link
                href={`/classes/${focus.classId}`}
                className="text-[var(--ink)] hover:text-[var(--accent)]"
              >
                {focus.line}
              </Link>
            </p>
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="surface rounded-2xl p-6">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Projected semester average
            </p>
            <p className="font-heading mt-2 text-4xl">
              {semesterAvg != null ? `${semesterAvg.toFixed(1)}%` : "—"}
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Unweighted mean of classes with scores (no credit hours yet).
            </p>
          </div>
          <div className="surface rounded-2xl p-6">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Classes tracked
            </p>
            <p className="font-heading mt-2 text-4xl">{classList.length}</p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Sorted by urgency (soonest due + furthest off target).
            </p>
          </div>
        </div>

        <ul className="mt-8 space-y-4">
          {summaries.map((s) => {
            const c = s.classRow;
            const p = s.projection;
            return (
              <li key={c.id}>
                <Link
                  href={`/classes/${c.id}`}
                  className="surface block rounded-2xl p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-heading text-xl">
                        {c.code || c.name}
                      </p>
                      {c.code && (
                        <p className="text-sm text-[var(--muted)]">{c.name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <TrendArrow trend={s.trend} delta={s.trendDelta} />
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-6 text-sm">
                    <div>
                      <p className="text-xs text-[var(--muted)]">Current</p>
                      <p className="font-medium">
                        {p.currentPercent != null
                          ? `${p.currentPercent.toFixed(1)}%`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--muted)]">Target</p>
                      <p className="font-medium">
                        {c.target_letter
                          ? `${c.target_letter}${
                              c.target_percent != null
                                ? ` (~${Number(c.target_percent)}%)`
                                : ""
                            }`
                          : "Not set"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--muted)]">Next due</p>
                      <p className="font-medium">
                        {p.nextAssessment
                          ? `${p.nextAssessment.title}${
                              s.nextDueDate ? ` · ${s.nextDueDate}` : ""
                            }`
                          : "—"}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        {classList.length === 0 && (
          <div className="surface mt-8 rounded-2xl p-12 text-center">
            <p className="font-heading text-2xl">No classes yet</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Add a class manually or upload a syllabus to start tracking grades.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/classes/new" className="btn btn-primary">
                + Add Class
              </Link>
              <Link href="/onboarding/upload" className="btn btn-ghost">
                + Upload Syllabus
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
