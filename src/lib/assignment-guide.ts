import Anthropic from "@anthropic-ai/sdk";
import {
  normalizeAssignmentGuide,
  normalizeDiagnosticQuestions,
  normalizeFollowUpExplanation,
  normalizeSelfCheckQuestions,
  type AssignmentGuideInput,
  type AssignmentGuideResult,
  type DiagnosticQuestion,
  type FollowUpRequest,
  type FollowUpResponse,
} from "@/lib/assignment-guide-shared";

export {
  ASSIGNMENT_GUIDE_REMINDER,
  normalizeAssignmentGuide,
  normalizeDiagnosticQuestions,
  normalizeFollowUpExplanation,
  normalizeSelfCheckQuestions,
  type AssignmentGuide,
  type AssignmentGuideInput,
  type AssignmentGuideResult,
  type AssignmentGuideTone,
  type DiagnosticAnswer,
  type DiagnosticQuestion,
  type FollowUpRequest,
  type FollowUpResponse,
  type FollowUpType,
  type SelfCheckQuestion,
  type WorkedExample,
  type WorkedExampleItem,
} from "@/lib/assignment-guide-shared";

const DIAGNOSE_SYSTEM = `You write short diagnostic questions that help tailor an Assignment Guide for a student.
Return ONLY valid JSON (no markdown fences):
{
  "questions": [
    {
      "id": string,
      "type": "open" | "multiple_choice",
      "prompt": string,
      "options"?: string[],
      "optional"?: boolean
    }
  ]
}

Rules:
- Return exactly 2 or 3 questions, assignment-specific (not generic boilerplate).
- Prefer a mix: at least one open and one multiple_choice when the assignment has distinct parts.
- Multiple-choice options must be short GENERIC CATEGORIES or topic labels derived from the assignment (e.g. "cost", "feasibility", "risk", "timeline", "the grading rubric", "how to structure the response"). NEVER put fully-formed thesis sentences, argument fragments, code, formulas that solve the problem, or anything a student could copy into a submission.
- Do not ask the student to produce submittable work (no "write your thesis", no "solve for x").
- Do not include answers to the assignment.
- Keep prompts short and direct.
- Mark at most one question as "optional": true (e.g. "Have you already tried something?").`;

const SYSTEM = `You are Assignment Guide Mode for Coursework by CoreMax.
Your job is to help a student UNDERSTAND and STRUCTURE an assignment.
You do NOT write the assignment for them.

HARD RULES (never violate):
1. NEVER produce prose, paragraphs, essay sentences, or code that could be copied into a submission as-is.
2. NEVER answer the assignment's specific question/prompt directly — only explain requirements, concepts, approach, and structure.
3. For essays/reports: use bullet points and structural guidance only — no finished thesis statements, topic sentences, or body paragraphs that read as draft content.
4. For math/code worked examples: produce exactly 3 distinct analogous practice examples (different scenario/numbers/framing from each other and from the assignment — never the assigned numbers/inputs). Describe the method in PROSE or language-agnostic PSEUDOCODE ONLY. Forbidden in workedExample (and anywhere else for code/math): real programming-language syntax or runnable snippets — no keywords like def/for/if/else/return/function/class, no braces/semicolons that form real code, no real operators as code (%, ==, !=, +=, etc.), no real assignment lines (e.g. total = 0), no typed signatures. Explain conceptually instead, e.g. "start a counter at zero," "go through each item in the list one at a time," "check whether it meets your condition," "if it does, add it to your counter," "once you've gone through everything, give back the counter's value." The student must write the actual code in their own language/syntax. Each example has a title and a full sequence of steps (max 6 steps each) — show the whole method; do not pace or withhold steps.
5. For code/math assignments, suggestedOutline (and other bullet fields) must also stay conceptual/structural — same ban on real language syntax as rule 4. Outline what to do in plain language; do not emit pasteable source lines.
6. Prefer short bullets over paragraphs everywhere.
7. Always set "reminder" exactly to:
   "This is a study guide to help you understand the assignment — you still need to do the actual work yourself."
8. If diagnosticAnswers contain real code, traceback, or pasteable snippets, treat that paste as a SYMPTOM DESCRIPTION only. Respond with conceptual diagnosis in bullets (keyConcepts / watchOutFor / suggestedOutline). NEVER debug, correct, complete, or rewrite their pasted code line-by-line; NEVER emit a fixed runnable version of their snippet.

Optional personalization (framing only, not answers):
- course name, professor name, extra context, tone (neutral | encouraging | direct).
Tone affects wording of guidance (e.g. warmer vs terser), not substance of any answer.

Diagnostic depth weighting (when student answers are provided):
- If they struggle with concepts / "don't get it" → put MORE depth into keyConcepts (more/finer bullets; still short).
- If they struggle with structure / outline / how to organize → put MORE depth into suggestedOutline.
- If they already tried something that failed → lean watchOutFor toward that failure mode.
- If they flag a specific skill (e.g. loops, criteria application, counterarguments) → expand the matching section(s) that teach that skill.
- If an answer includes pasted code/errors, use it only to infer what concept is confusing — HARD RULE 8 still applies.
This changes EMPHASIS only. HARD RULES still apply. Never produce submittable work.

Also include selfCheck: 2–4 short questions the student will answer later to confirm understanding (requirements, constraints, approach). selfCheck must NOT ask them to write the assignment, produce essay prose, or solve the assigned problem. Multiple-choice options must be short generic categories — never copyable answer fragments.

Output ONLY valid JSON matching this schema (no markdown fences):
{
  "reminder": string,
  "whatsBeingAsked": string[],
  "keyConcepts": string[],
  "suggestedOutline": string[],
  "workedExample": {
    "applicable": boolean,
    "examples"?: [ { "title": string, "steps": string[] }, { "title": string, "steps": string[] }, { "title": string, "steps": string[] } ]
  },
  "watchOutFor": string[],
  "selfCheck": [
    { "id": string, "type": "open" | "multiple_choice", "prompt": string, "options"?: string[] }
  ]
}
If worked examples are useful (math/code/method practice), set applicable true and include exactly 3 distinct analogous examples (max 6 steps each). If not useful (e.g. pure essay), set workedExample.applicable to false and omit examples.`;

function stripFences(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  return match ? match[1].trim() : trimmed;
}

function buildMetaBlock(input: AssignmentGuideInput): string {
  const tone = input.tone ?? "neutral";
  const lines = [`Preferred tone for framing (not answers): ${tone}`];
  if (input.courseName?.trim()) {
    lines.push(`Course name: ${input.courseName.trim()}`);
  }
  if (input.professorName?.trim()) {
    lines.push(`Professor: ${input.professorName.trim()}`);
  }
  if (input.extraContext?.trim()) {
    lines.push(`Extra context from student: ${input.extraContext.trim()}`);
  }
  if (input.diagnosticAnswers && input.diagnosticAnswers.length > 0) {
    lines.push(
      "Student diagnostic answers (DEPTH weighting only; if any answer contains code/snippets, treat as symptom description — do NOT rewrite or fix their code):"
    );
    for (const a of input.diagnosticAnswers) {
      const value = a.value?.trim() || "(skipped)";
      lines.push(`- ${a.questionId}: ${value}`);
    }
  }
  return lines.join("\n");
}

export async function generateDiagnosticQuestions(
  input: AssignmentGuideInput
): Promise<DiagnosticQuestion[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local to use Assignment Guide."
    );
  }

  const client = new Anthropic({ apiKey });
  const content: Anthropic.MessageCreateParams["messages"][0]["content"] = [];
  const meta = buildMetaBlock(input);

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
      text: `${meta}\n\nCreate 2–3 diagnostic questions for the assignment in this image.`,
    });
  } else if (input.text?.trim()) {
    content.push({
      type: "text",
      text: `${meta}\n\nAssignment prompt / materials:\n\n${input.text.slice(0, 100000)}\n\nCreate 2–3 diagnostic questions for this assignment.`,
    });
  } else {
    throw new Error("No assignment content to analyze.");
  }

  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2048,
    thinking: { type: "disabled" },
    system: DIAGNOSE_SYSTEM,
    messages: [{ role: "user", content }],
  });

  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no text response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(block.text));
  } catch {
    throw new Error("Failed to parse diagnostic questions JSON.");
  }

  const questions = normalizeDiagnosticQuestions(parsed);
  if (questions.length < 2) {
    throw new Error("Diagnostic response did not include enough questions.");
  }
  return questions;
}

export async function generateAssignmentGuide(
  input: AssignmentGuideInput
): Promise<AssignmentGuideResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local to use Assignment Guide."
    );
  }

  const client = new Anthropic({ apiKey });
  const content: Anthropic.MessageCreateParams["messages"][0]["content"] = [];
  const meta = buildMetaBlock(input);

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
      text: `${meta}\n\nProduce an Assignment Guide JSON (including selfCheck) for the assignment shown in this image. Follow the HARD RULES and diagnostic depth weighting.`,
    });
  } else if (input.text?.trim()) {
    content.push({
      type: "text",
      text: `${meta}\n\nAssignment prompt / materials:\n\n${input.text.slice(0, 100000)}\n\nProduce an Assignment Guide JSON (including selfCheck). Follow the HARD RULES and diagnostic depth weighting.`,
    });
  } else {
    throw new Error("No assignment content to analyze.");
  }

  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 4096,
    thinking: { type: "disabled" },
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });

  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no text response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(block.text));
  } catch (parseErr) {
    console.error("[generateAssignmentGuide] JSON.parse failed", {
      stop_reason: message.stop_reason,
      usage: message.usage,
      parseError:
        parseErr instanceof Error ? parseErr.message : String(parseErr),
      rawResponse: block.text,
    });
    if (message.stop_reason === "max_tokens") {
      throw new Error(
        "This assignment is too long to process at once — try a shorter excerpt."
      );
    }
    throw new Error("Failed to parse Claude JSON response.");
  }

  const guide = normalizeAssignmentGuide(parsed);
  const selfCheck = normalizeSelfCheckQuestions(parsed);
  if (
    guide.whatsBeingAsked.length === 0 &&
    guide.keyConcepts.length === 0 &&
    guide.suggestedOutline.length === 0
  ) {
    throw new Error("Assignment guide response was empty.");
  }

  return { guide, selfCheck };
}

export async function generateFollowUp(
  req: FollowUpRequest
): Promise<FollowUpResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local to use Assignment Guide."
    );
  }

  const diagMeta = buildMetaBlock({
    diagnosticAnswers: req.diagnosticAnswers,
  });

  const priorJson = JSON.stringify(req.originalGuide.keyConcepts ?? [], null, 2);

  const userText = [
    diagMeta,
    `Assignment context:\n${req.assignmentContext.slice(0, 100000) || "(none)"}`,
    `Prior keyConcepts:\n${priorJson}`,
    `The student found the previous explanation of key concepts insufficient. Produce a materially different one — not a reworded version of what was already given. All existing hard rules (no real code syntax, never answer the assignment's specific question directly, prose/pseudocode-only worked examples, bullet caps) still apply exactly as before.`,
    `Return ONLY valid JSON:\n{\n  "reminder": string,\n  "keyConcepts": string[]\n}\nkeyConcepts must use a different analogy/framing than the prior list. Cap at 5 bullets.`,
  ].join("\n\n");

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2048,
    thinking: { type: "disabled" },
    system: SYSTEM,
    messages: [{ role: "user", content: userText }],
  });

  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no text response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(block.text));
  } catch {
    throw new Error("Failed to parse follow-up JSON response.");
  }

  return normalizeFollowUpExplanation(parsed);
}
