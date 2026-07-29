import Anthropic from "@anthropic-ai/sdk";
import type { ParsedSyllabus } from "./types";

const SYSTEM = `You extract structured course data from a syllabus.
Return ONLY valid JSON matching this schema (no markdown fences):
{
  "name": string,
  "code": string | null,
  "term": string | null,
  "assessments": [
    {
      "title": string,
      "type": "assignment" | "quiz" | "exam" | "other",
      "due_date": "YYYY-MM-DD" | null,
      "weight_percent": number
    }
  ]
}
Rules:
- Include every graded item you can find (assignments, quizzes, exams, projects, participation).
- weight_percent is the portion of the final grade (e.g. 20 for 20%). Use 0 if unknown.
- due_date: infer year from the term/syllabus when possible; null if unknown.
- type: use exam for midterms/finals, quiz for quizzes/tests, assignment for homework/projects, other otherwise.
- Prefer the official course name and code (e.g. CIS 8040).`;

function stripFences(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  return match ? match[1].trim() : trimmed;
}

export async function parseSyllabusWithClaude(input: {
  text?: string;
  imageBase64?: string;
  mediaType?: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
}): Promise<ParsedSyllabus> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local to parse syllabi."
    );
  }

  const client = new Anthropic({ apiKey });

  const content: Anthropic.MessageCreateParams["messages"][0]["content"] = [];

  if (input.imageBase64 && input.mediaType) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: input.mediaType,
        data: input.imageBase64,
      },
    });
    content.push({
      type: "text",
      text: "Extract the course and all graded assessments from this syllabus image.",
    });
  } else if (input.text?.trim()) {
    content.push({
      type: "text",
      text: `Extract the course and all graded assessments from this syllabus text:\n\n${input.text.slice(0, 100000)}`,
    });
  } else {
    throw new Error("No syllabus content to parse.");
  }

  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 4096,
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });

  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no text response.");
  }

  let parsed: ParsedSyllabus;
  try {
    parsed = JSON.parse(stripFences(block.text)) as ParsedSyllabus;
  } catch {
    throw new Error("Failed to parse Claude JSON response.");
  }

  if (!parsed.name || !Array.isArray(parsed.assessments)) {
    throw new Error("Parsed syllabus missing name or assessments.");
  }

  parsed.assessments = parsed.assessments.map((a) => ({
    title: a.title || "Untitled",
    type: (["assignment", "quiz", "exam", "other"] as const).includes(a.type)
      ? a.type
      : "other",
    due_date: a.due_date || null,
    weight_percent: Number(a.weight_percent) || 0,
  }));

  return parsed;
}
