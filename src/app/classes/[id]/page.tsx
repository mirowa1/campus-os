import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { ClassExportButton } from "@/components/ClassExportButton";
import { DeleteClassButton } from "@/components/DeleteClassButton";
import { GoogleSyncButton } from "@/components/GoogleSyncButton";
import { GradePanel } from "@/components/GradePanel";
import { MaterialsPanel } from "@/components/MaterialsPanel";
import { NotesPanel } from "@/components/NotesPanel";
import { QuizFlashcardsPanel } from "@/components/QuizFlashcardsPanel";
import { StudyGuidePanel } from "@/components/StudyGuidePanel";
import { SyllabusDownloadButton } from "@/components/SyllabusDownloadButton";
import { getUserOrRedirect } from "@/lib/supabase/get-user-or-redirect";
import { createClient } from "@/lib/supabase/server";
import type {
  AssessmentRow,
  ClassRow,
  CourseMaterialRow,
  NoteRow,
  QuizAttemptRow,
  QuizSetRow,
  StudyGuideRow,
} from "@/lib/types";

export default async function ClassDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const user = await getUserOrRedirect(supabase);

  const { data: classRow } = await supabase
    .from("classes")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!classRow) notFound();

  const [
    { data: assessments },
    { data: notes },
    { data: materials },
    { data: guides },
    { data: quizSets },
    { data: googleConnection },
  ] = await Promise.all([
    supabase
      .from("assessments")
      .select("*")
      .eq("class_id", params.id)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("notes")
      .select("*")
      .eq("class_id", params.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("course_materials")
      .select("*")
      .eq("class_id", params.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("study_guides")
      .select("*")
      .eq("class_id", params.id)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("quiz_sets")
      .select("*")
      .eq("class_id", params.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("google_calendar_connections")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const cls = classRow as ClassRow;
  const items = (assessments ?? []) as AssessmentRow[];
  const noteRows = (notes ?? []) as NoteRow[];
  const materialRows = (materials ?? []) as CourseMaterialRow[];
  const latestGuide = ((guides ?? [])[0] ?? null) as StudyGuideRow | null;
  const setRows = (quizSets ?? []) as QuizSetRow[];
  const setIds = setRows.map((s) => s.id);

  const { data: attemptRows } =
    setIds.length > 0
      ? await supabase
          .from("quiz_attempts")
          .select("*")
          .in("quiz_set_id", setIds)
          .order("created_at", { ascending: false })
      : { data: [] as QuizAttemptRow[] };

  const attemptsBySet = new Map<string, QuizAttemptRow[]>();
  for (const a of (attemptRows ?? []) as QuizAttemptRow[]) {
    const list = attemptsBySet.get(a.quiz_set_id) ?? [];
    list.push(a);
    attemptsBySet.set(a.quiz_set_id, list);
  }

  const initialQuizSets = setRows.map((s) => ({
    ...s,
    attempts: attemptsBySet.get(s.id) ?? [],
  }));

  const classLabel = [cls.code, cls.name].filter(Boolean).join(" — ");

  return (
    <div>
      <AppNav email={user.email} />
      <main className="mx-auto max-w-3xl space-y-8 px-6 py-10">
        <div>
          <Link
            href="/classes"
            className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
          >
            ← Classes
          </Link>
          <h1 className="font-heading mt-3 text-4xl">
            {cls.code ? `${cls.code} — ` : ""}
            {cls.name}
          </h1>
          {cls.term && (
            <p className="mt-2 text-[var(--muted)]">{cls.term}</p>
          )}
          {cls.syllabus_path && (
            <SyllabusDownloadButton
              syllabusPath={cls.syllabus_path}
              fileName={cls.syllabus_file_name}
            />
          )}
          <ClassExportButton classId={cls.id} />
          <DeleteClassButton classId={cls.id} classLabel={classLabel} />
        </div>

        <GradePanel classRow={cls} assessments={items} />
        <GoogleSyncButton
          classId={cls.id}
          connected={!!googleConnection}
        />
        <NotesPanel classId={cls.id} initialNotes={noteRows} />
        <MaterialsPanel classId={cls.id} initialMaterials={materialRows} />
        <StudyGuidePanel
          classId={cls.id}
          classLabel={classLabel}
          materials={materialRows}
          notes={noteRows}
          initialGuide={latestGuide}
        />
        <QuizFlashcardsPanel
          classId={cls.id}
          materials={materialRows}
          notes={noteRows}
          initialSets={initialQuizSets}
        />
      </main>
    </div>
  );
}
