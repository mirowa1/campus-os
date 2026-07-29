import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { GradePanel } from "@/components/GradePanel";
import { createClient } from "@/lib/supabase/server";
import type { AssessmentRow, ClassRow } from "@/lib/types";

export default async function ClassDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: classRow } = await supabase
    .from("classes")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!classRow) notFound();

  const { data: assessments } = await supabase
    .from("assessments")
    .select("*")
    .eq("class_id", params.id)
    .order("due_date", { ascending: true, nullsFirst: false });

  const cls = classRow as ClassRow;
  const items = (assessments ?? []) as AssessmentRow[];

  return (
    <div>
      <AppNav email={user.email} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href="/classes"
          className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
        >
          ← Classes
        </Link>
        <h1 className="font-display mt-3 text-4xl">
          {cls.code ? `${cls.code} — ` : ""}
          {cls.name}
        </h1>
        {cls.term && (
          <p className="mt-2 text-[var(--muted)]">{cls.term}</p>
        )}

        <div className="mt-8">
          <GradePanel classRow={cls} assessments={items} />
        </div>
      </main>
    </div>
  );
}
