import { parseQuizOrFlashcardResponse } from "../src/lib/quiz-validate";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const quiz = parseQuizOrFlashcardResponse(
  {
    items: Array.from({ length: 5 }, (_, i) => ({
      question: `Q${i + 1}?`,
      options: ["A", "B", "C", "D"],
      correctIndex: i % 4,
      explanation: "Because",
    })),
  },
  "quiz"
);
assert(!quiz.thin && quiz.items.length === 5, "quiz parse");

const thin = parseQuizOrFlashcardResponse(
  { thin: true, message: "Not enough material" },
  "quiz"
);
assert(thin.thin && thin.message.includes("Not enough"), "thin");

const cards = parseQuizOrFlashcardResponse(
  {
    items: Array.from({ length: 6 }, (_, i) => ({
      front: `Front ${i}`,
      back: `Back ${i}`,
    })),
  },
  "flashcard"
);
assert(!cards.thin && cards.items.length === 6, "flashcards");

let threw = false;
try {
  parseQuizOrFlashcardResponse({ items: [{ question: "x" }] }, "quiz");
} catch {
  threw = true;
}
assert(threw, "invalid quiz should throw");

console.log("QUIZ_VALIDATE_OK");
