import { readFileSync } from "fs";
import { parseQuizOrFlashcardResponse } from "../src/lib/quiz-validate";
import { generateQuizOrFlashcardsWithClaude } from "../src/lib/claude";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
}

function stripFences(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  return match ? match[1].trim() : trimmed;
}

async function main() {
  const text = await generateQuizOrFlashcardsWithClaude({
    mode: "quiz",
    className: "Intro to Algorithms",
    classCode: "CSC 4520",
    materialTexts: [
      {
        fileName: "Lecture notes.txt",
        text: `
Big-O notation describes asymptotic upper bounds. Merge sort runs in O(n log n).
A hash table provides average-case O(1) lookup. Dijkstra finds shortest paths in
weighted graphs with non-negative edges. Dynamic programming stores subproblem
results. A binary search tree keeps ordered keys with expected O(log n) ops when balanced.
BFS explores level by level; DFS goes deep first. Amortized analysis averages cost over a sequence.
        `.trim(),
      },
    ],
    images: [],
  });
  const raw = JSON.parse(stripFences(text));
  const parsed = parseQuizOrFlashcardResponse(raw, "quiz");
  if (parsed.thin) throw new Error("unexpected thin: " + parsed.message);
  console.log("LIVE_QUIZ_ITEMS", parsed.items.length);
  console.log("sample Q:", parsed.items[0].question.slice(0, 80));
  console.log("CLAUDE_QUIZ_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
