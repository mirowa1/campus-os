import type { AssessmentRow, AssessmentType } from "@/lib/types";

const ASSESSMENT_TYPES = new Set<AssessmentType>([
  "assignment",
  "quiz",
  "exam",
  "other",
]);

function parseDueDate(raw: unknown): { ok: true; due_date: string | null } | { ok: false; error: string } {
  if (raw == null || raw === "") {
    return { ok: true, due_date: null };
  }
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { ok: false, error: "Due date must be YYYY-MM-DD" };
  }
  return { ok: true, due_date: raw };
}

function parseType(raw: unknown): { ok: true; type: AssessmentType } | { ok: false; error: string } {
  if (typeof raw !== "string" || !ASSESSMENT_TYPES.has(raw as AssessmentType)) {
    return { ok: false, error: "Type must be assignment, quiz, exam, or other" };
  }
  return { ok: true, type: raw as AssessmentType };
}

export function parseAssessmentCreateBody(body: unknown):
  | { ok: true; row: Omit<AssessmentRow, "id" | "class_id" | "created_at"> }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body" };
  }

  const raw = body as Record<string, unknown>;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) {
    return { ok: false, error: "Title is required" };
  }

  const typeResult = parseType(raw.type);
  if (!typeResult.ok) return typeResult;

  const dueResult = parseDueDate(raw.due_date);
  if (!dueResult.ok) return dueResult;

  const weight_percent = Number(raw.weight_percent);
  if (Number.isNaN(weight_percent) || weight_percent < 0) {
    return { ok: false, error: "Weight % must be a number >= 0" };
  }

  let score: number | null = null;
  if (raw.score != null && raw.score !== "") {
    score = Number(raw.score);
    if (Number.isNaN(score)) {
      return { ok: false, error: "Score must be a number" };
    }
  }

  const max_score =
    raw.max_score != null && raw.max_score !== ""
      ? Number(raw.max_score)
      : 100;
  if (Number.isNaN(max_score) || max_score <= 0) {
    return { ok: false, error: "Max score must be a number > 0" };
  }

  return {
    ok: true,
    row: {
      title,
      type: typeResult.type,
      due_date: dueResult.due_date,
      weight_percent,
      score,
      max_score,
    },
  };
}

export function parseAssessmentPatchBody(body: unknown):
  | {
      ok: true;
      row: Pick<AssessmentRow, "title" | "type" | "due_date" | "weight_percent">;
    }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body" };
  }

  const raw = body as Record<string, unknown>;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) {
    return { ok: false, error: "Title is required" };
  }

  const typeResult = parseType(raw.type);
  if (!typeResult.ok) return typeResult;

  const dueResult = parseDueDate(raw.due_date);
  if (!dueResult.ok) return dueResult;

  const weight_percent = Number(raw.weight_percent);
  if (Number.isNaN(weight_percent) || weight_percent < 0) {
    return { ok: false, error: "Weight % must be a number >= 0" };
  }

  return {
    ok: true,
    row: {
      title,
      type: typeResult.type,
      due_date: dueResult.due_date,
      weight_percent,
    },
  };
}
