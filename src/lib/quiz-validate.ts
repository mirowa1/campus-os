import type { FlashcardItem, QuizQuestion } from "@/lib/types";

export type QuizGenResult =
  | { thin: true; message: string }
  | { thin: false; items: QuizQuestion[] };

export type FlashcardGenResult =
  | { thin: true; message: string }
  | { thin: false; items: FlashcardItem[] };

function isStringArray(v: unknown, len?: number): v is string[] {
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) return false;
  if (len != null && v.length !== len) return false;
  return true;
}

export function parseQuizOrFlashcardResponse(
  raw: unknown,
  mode: "quiz" | "flashcard"
): QuizGenResult | FlashcardGenResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("Response is not an object");
  }
  const o = raw as Record<string, unknown>;

  if (o.thin === true) {
    const message =
      typeof o.message === "string" && o.message.trim()
        ? o.message.trim()
        : "Not enough material in the selected sources to build a meaningful set.";
    return { thin: true, message };
  }

  if (!Array.isArray(o.items)) {
    throw new Error("Missing items array");
  }
  if (o.items.length < 5) {
    throw new Error("Too few items returned");
  }
  if (o.items.length > 25) {
    throw new Error("Too many items returned");
  }

  if (mode === "quiz") {
    const items: QuizQuestion[] = o.items.map((item, i) => {
      if (!item || typeof item !== "object") {
        throw new Error(`Invalid quiz item[${i}]`);
      }
      const q = item as Record<string, unknown>;
      if (typeof q.question !== "string" || !q.question.trim()) {
        throw new Error(`Invalid quiz item[${i}] question`);
      }
      if (!isStringArray(q.options, 4)) {
        throw new Error(`Invalid quiz item[${i}] options (need 4)`);
      }
      if (
        typeof q.correctIndex !== "number" ||
        !Number.isInteger(q.correctIndex) ||
        q.correctIndex < 0 ||
        q.correctIndex > 3
      ) {
        throw new Error(`Invalid quiz item[${i}] correctIndex`);
      }
      return {
        question: q.question.trim(),
        options: q.options,
        correctIndex: q.correctIndex,
        explanation:
          typeof q.explanation === "string" ? q.explanation : undefined,
      };
    });
    return { thin: false, items };
  }

  const items: FlashcardItem[] = o.items.map((item, i) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Invalid flashcard[${i}]`);
    }
    const c = item as Record<string, unknown>;
    if (typeof c.front !== "string" || !c.front.trim()) {
      throw new Error(`Invalid flashcard[${i}] front`);
    }
    if (typeof c.back !== "string" || !c.back.trim()) {
      throw new Error(`Invalid flashcard[${i}] back`);
    }
    return { front: c.front.trim(), back: c.back.trim() };
  });
  return { thin: false, items };
}
