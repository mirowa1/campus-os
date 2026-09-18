export const ASSIGNMENT_GUIDE_REMINDER =
  "This is a study guide to help you understand the assignment — you still need to do the actual work yourself.";

export const MAX_WORKED_EXAMPLE_STEPS = 6;
export const MAX_WORKED_EXAMPLES = 3;

export function capWorkedExampleSteps(steps: string[]): string[] {
  return steps.slice(0, MAX_WORKED_EXAMPLE_STEPS);
}

export type AssignmentGuideTone = "neutral" | "encouraging" | "direct";

export type WorkedExampleItem = {
  title: string;
  steps: string[];
};

export type WorkedExample = {
  applicable: boolean;
  examples?: WorkedExampleItem[];
};

export type AssignmentGuide = {
  reminder: string;
  whatsBeingAsked: string[];
  keyConcepts: string[];
  suggestedOutline: string[];
  workedExample: WorkedExample;
  watchOutFor: string[];
};

export type AssignmentGuideInput = {
  text?: string;
  imageBase64?: string;
  mediaType?: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  courseName?: string;
  professorName?: string;
  extraContext?: string;
  tone?: AssignmentGuideTone;
  diagnosticAnswers?: DiagnosticAnswer[];
};

export type DiagnosticQuestion = {
  id: string;
  type: "open" | "multiple_choice";
  prompt: string;
  options?: string[];
  optional?: boolean;
};

export type DiagnosticAnswer = {
  questionId: string;
  value: string;
};

export type SelfCheckQuestion = {
  id: string;
  type: "open" | "multiple_choice";
  prompt: string;
  options?: string[];
};

export type AssignmentGuideResult = {
  guide: AssignmentGuide;
  selfCheck: SelfCheckQuestion[];
};

export type FollowUpType = "alternate_explanation";

export type FollowUpRequest = {
  type: FollowUpType;
  originalGuide: AssignmentGuide;
  diagnosticAnswers?: DiagnosticAnswer[];
  assignmentContext: string;
};

export type FollowUpResponse = {
  reminder: string;
  keyConcepts: string[];
};

export function normalizeDiagnosticQuestions(raw: unknown): DiagnosticQuestion[] {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const list = Array.isArray(obj.questions)
    ? obj.questions
    : Array.isArray(raw)
      ? raw
      : [];

  const questions: DiagnosticQuestion[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const q = item as Record<string, unknown>;
    const id = typeof q.id === "string" && q.id.trim() ? q.id.trim() : "";
    const prompt =
      typeof q.prompt === "string" && q.prompt.trim() ? q.prompt.trim() : "";
    const type = q.type === "multiple_choice" ? "multiple_choice" : "open";
    if (!id || !prompt) continue;

    const options = Array.isArray(q.options)
      ? q.options
          .filter((o): o is string => typeof o === "string")
          .map((o) => o.trim())
          .filter(Boolean)
      : undefined;

    if (type === "multiple_choice" && (!options || options.length < 2)) {
      continue;
    }

    questions.push({
      id,
      type,
      prompt,
      options: type === "multiple_choice" ? options : undefined,
      optional: Boolean(q.optional),
    });
  }

  return questions.slice(0, 3);
}

export function normalizeSelfCheckQuestions(raw: unknown): SelfCheckQuestion[] {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const list = Array.isArray(obj.selfCheck)
    ? obj.selfCheck
    : Array.isArray(raw)
      ? raw
      : [];

  const questions: SelfCheckQuestion[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const q = item as Record<string, unknown>;
    const id = typeof q.id === "string" && q.id.trim() ? q.id.trim() : "";
    const prompt =
      typeof q.prompt === "string" && q.prompt.trim() ? q.prompt.trim() : "";
    const type = q.type === "multiple_choice" ? "multiple_choice" : "open";
    if (!id || !prompt) continue;

    const options = Array.isArray(q.options)
      ? q.options
          .filter((o): o is string => typeof o === "string")
          .map((o) => o.trim())
          .filter(Boolean)
      : undefined;

    if (type === "multiple_choice" && (!options || options.length < 2)) {
      continue;
    }

    questions.push({
      id,
      type,
      prompt,
      options: type === "multiple_choice" ? options : undefined,
    });
  }

  return questions.slice(0, 4);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeAssignmentGuide(raw: unknown): AssignmentGuide {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const workedRaw =
    obj.workedExample && typeof obj.workedExample === "object"
      ? (obj.workedExample as Record<string, unknown>)
      : {};
  const applicable = Boolean(workedRaw.applicable);

  const examples: WorkedExampleItem[] = [];
  if (Array.isArray(workedRaw.examples)) {
    for (const item of workedRaw.examples) {
      if (!item || typeof item !== "object") continue;
      const ex = item as Record<string, unknown>;
      const title =
        typeof ex.title === "string" && ex.title.trim() ? ex.title.trim() : "";
      const steps = capWorkedExampleSteps(asStringArray(ex.steps));
      if (!title || steps.length === 0) continue;
      examples.push({ title, steps });
      if (examples.length >= MAX_WORKED_EXAMPLES) break;
    }
  }

  return {
    reminder: ASSIGNMENT_GUIDE_REMINDER,
    whatsBeingAsked: asStringArray(obj.whatsBeingAsked),
    keyConcepts: asStringArray(obj.keyConcepts),
    suggestedOutline: asStringArray(obj.suggestedOutline),
    workedExample: applicable
      ? examples.length > 0
        ? { applicable: true, examples }
        : { applicable: true }
      : { applicable: false },
    watchOutFor: asStringArray(obj.watchOutFor),
  };
}

export function normalizeFollowUpExplanation(raw: unknown): {
  reminder: string;
  keyConcepts: string[];
} {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const keyConcepts = asStringArray(obj.keyConcepts).slice(0, 5);
  if (keyConcepts.length === 0) {
    throw new Error("Follow-up explanation has no key concepts.");
  }
  return {
    reminder: ASSIGNMENT_GUIDE_REMINDER,
    keyConcepts,
  };
}
