import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { StatusBadge } from "@/components/StatusBadge";
import { computeGradeProjection } from "@/lib/grades";
import { createClient } from "@/lib/supabase/server";
import type { AssessmentRow, ClassRow } from "@/lib/types";

export default async function ClassesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: classes } = await supabase
    .from("classes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const classList = (classes ?? []) as ClassRow[];
  const ids = classList.map((c) => c.id);

  const { data: assessments } =
    ids.length > 0
      ? await supabase.from("assessments").select("*").in("class_id", ids)
      : { data: [] };

  const all = (assessments ?? []) as AssessmentRow[];

  return (
    <div>
      <AppNav email={user.email} />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-4xl">Classes</h1>
            <p className="mt-2 text-[var(--muted)]">
              Grades, targets, and syllabus assessments.
            </p>
          </div>
          <Link href="/onboarding/upload" className="btn btn-primary">
            Upload syllabus
          </Link>
        </div>

        <ul className="mt-10 grid gap-6 sm:grid-cols-2">
          {classList.map((c) => {
            const items = all.filter((a) => a.class_id === c.id);
            const proj = computeGradeProjection(
              items,
              c.target_percent != null ? Number(c.target_percent) : null
            );
            return (
              <li key={c.id}>
                <Link
                  href={`/classes/${c.id}`}
                  className="surface block rounded-2xl p-6"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-heading text-2xl">
                        {c.code || c.name}
                      </p>
                      {c.code && (
                        <p className="text-sm text-[var(--muted)]">{c.name}</p>
                      )}
                      {c.term && (
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {c.term}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={proj.status} />
                  </div>
                  <p className="mt-4 text-sm text-[var(--muted)]">
                    {items.length} assessments
                    {proj.currentPercent != null
                      ? ` · ${proj.currentPercent.toFixed(1)}%`
                      : ""}
                    {c.target_letter ? ` · target ${c.target_letter}` : ""}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>

        {classList.length === 0 && (
          <div className="surface mt-10 rounded-2xl p-12 text-center">
            <p className="font-heading text-2xl">No classes yet</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Add a class manually or upload a syllabus to populate your
              semester.
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
