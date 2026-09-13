import type { Metadata } from "next";
import { AppNav } from "@/components/AppNav";
import {
  AssessmentsPanel,
  type AssessmentsPanelItem,
} from "@/components/AssessmentsPanel";
import { getUserOrRedirect } from "@/lib/supabase/get-user-or-redirect";
import { createClient } from "@/lib/supabase/server";
import type { AssessmentRow, ClassRow } from "@/lib/types";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AssessmentsPage() {
  const supabase = createClient();
  const user = await getUserOrRedirect(
    supabase,
    "/login?next=/assessments"
  );

  const { data: classes } = await supabase
    .from("classes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const classList = (classes ?? []) as ClassRow[];
  const ids = classList.map((c) => c.id);
  const classById = new Map(classList.map((c) => [c.id, c]));

  const { data: assessments } = ids.length
    ? await supabase.from("assessments").select("*").in("class_id", ids)
    : { data: [] as AssessmentRow[] };

  const items: AssessmentsPanelItem[] = ((assessments ?? []) as AssessmentRow[])
    .map((assessment) => {
      const cls = classById.get(assessment.class_id);
      if (!cls) return null;
      const classLabel = cls.code
        ? `${cls.code} — ${cls.name}`
        : cls.name;
      return {
        assessment,
        classId: cls.id,
        classLabel,
      };
    })
    .filter((x): x is AssessmentsPanelItem => x != null);

  return (
    <div>
      <AppNav email={user.email} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-heading text-4xl">Assessments</h1>
        <p className="mt-2 text-[var(--muted)]">
          Everything due across your classes — color-coded like ClassToExcel.
        </p>
        <div className="mt-8">
          <AssessmentsPanel
            items={items}
            classes={classList.map((c) => ({
              id: c.id,
              name: c.name,
              code: c.code,
            }))}
          />
        </div>
      </main>
    </div>
  );
}
