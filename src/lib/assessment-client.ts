import { computeGradeProjection } from "@/lib/grades";
import { createClient } from "@/lib/supabase/client";
import type { AssessmentRow, AssessmentType } from "@/lib/types";

export type AssessmentFormFields = {
  title: string;
  type: AssessmentType;
  due_date: string;
  weight_percent: string;
  score: string;
  max_score: string;
};

export const EMPTY_ASSESSMENT_FORM: AssessmentFormFields = {
  title: "",
  type: "assignment",
  due_date: "",
  weight_percent: "0",
  score: "",
  max_score: "100",
};

export type AssessmentMutationResult = {
  assessment?: AssessmentRow;
  calendarSyncWarning?: string;
  error?: string;
};

export async function createAssessment(
  classId: string,
  form: AssessmentFormFields
): Promise<AssessmentMutationResult> {
  const title = form.title.trim();
  if (!title) return { error: "Title is required." };

  const res = await fetch(`/api/classes/${classId}/assessments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      type: form.type,
      due_date: form.due_date || null,
      weight_percent: Number(form.weight_percent),
      score: form.score.trim() === "" ? null : Number(form.score),
      max_score: form.max_score.trim() === "" ? 100 : Number(form.max_score),
    }),
  });
  const data = (await res.json()) as {
    error?: string;
    assessment?: AssessmentRow;
    calendarSyncWarning?: string;
  };
  if (!res.ok) return { error: data.error || "Failed to add assessment" };
  return {
    assessment: data.assessment,
    calendarSyncWarning: data.calendarSyncWarning,
  };
}

export async function patchAssessment(
  classId: string,
  assessmentId: string,
  fields: Pick<
    AssessmentFormFields,
    "title" | "type" | "due_date" | "weight_percent"
  >
): Promise<AssessmentMutationResult> {
  const title = fields.title.trim();
  if (!title) return { error: "Title is required." };

  const res = await fetch(
    `/api/classes/${classId}/assessments/${assessmentId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        type: fields.type,
        due_date: fields.due_date || null,
        weight_percent: Number(fields.weight_percent),
      }),
    }
  );
  const data = (await res.json()) as {
    error?: string;
    assessment?: AssessmentRow;
    calendarSyncWarning?: string;
  };
  if (!res.ok) return { error: data.error || "Failed to update assessment" };
  return {
    assessment: data.assessment,
    calendarSyncWarning: data.calendarSyncWarning,
  };
}

export async function deleteAssessment(
  classId: string,
  assessmentId: string
): Promise<AssessmentMutationResult> {
  const res = await fetch(
    `/api/classes/${classId}/assessments/${assessmentId}`,
    { method: "DELETE" }
  );
  const data = (await res.json()) as {
    error?: string;
    calendarSyncWarning?: string;
  };
  if (!res.ok) return { error: data.error || "Failed to delete assessment" };
  return { calendarSyncWarning: data.calendarSyncWarning };
}

export async function saveAssessmentScore(args: {
  classId: string;
  assessmentId: string;
  rawScore: string;
  assessments: AssessmentRow[];
  targetPercent: number | null;
}): Promise<{ score: number | null; error?: string }> {
  const value =
    args.rawScore.trim() === "" ? null : Number(args.rawScore);
  if (value != null && Number.isNaN(value)) {
    return { score: null, error: "Score must be a number." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { score: null, error: "Not signed in" };

  const before = args.assessments.find((a) => a.id === args.assessmentId);
  const averageBefore = computeGradeProjection(
    args.assessments,
    args.targetPercent
  ).currentPercent;

  const { error: histError } = await supabase.from("score_history").insert({
    user_id: user.id,
    class_id: args.classId,
    assessment_id: args.assessmentId,
    old_score: before?.score ?? null,
    new_score: value,
    class_average_before: averageBefore,
  });
  if (histError) {
    console.warn("score_history:", histError.message);
  }

  const { error: updError } = await supabase
    .from("assessments")
    .update({ score: value })
    .eq("id", args.assessmentId);
  if (updError) return { score: null, error: updError.message };

  return { score: value };
}
