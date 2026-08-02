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

const STUDY_GUIDE_SYSTEM = `You are a study/homework helper for university students.
Create a custom study guide ONLY from the provided sources (uploaded files, class notes, and/or pasted/attached text).
Position as academic study aid — never produce an answer key for graded work or encourage cheating.

Anti-fabrication rules (apply to ALL source types equally):
- Use only information present in the selected sources.
- Do NOT invent facts, definitions, formulas, examples, dates, or claims that are not in the sources.
- If the sources are thin or incomplete, say so briefly and limit the guide to what is actually present.
- Prefer quoting or clearly paraphrasing source language so the guide is grounded.

Return markdown only (no surrounding code fences) with:
## Overview
## Key terms
## Core concepts
## Likely question types
## Quick review checklist

Ground every section in the provided sources. Quote or paraphrase specific terms, names, and ideas so the guide is clearly about THIS content, not generic filler.`;

export async function generateStudyGuideWithClaude(input: {
  className: string;
  classCode?: string | null;
  materialTexts: { fileName: string; text: string }[];
  images?: {
    fileName: string;
    base64: string;
    mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  }[];
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local to generate study guides."
    );
  }

  const client = new Anthropic({ apiKey });
  const content: Anthropic.MessageCreateParams["messages"][0]["content"] = [];

  const label = [input.classCode, input.className].filter(Boolean).join(" — ");
  let textBlock = `Course: ${label || input.className}\n\nSelected sources only — do not use outside knowledge:\n\n`;
  for (const m of input.materialTexts) {
    textBlock += `--- Source: ${m.fileName} ---\n${m.text.slice(0, 40000)}\n\n`;
  }
  if (!input.materialTexts.length && !(input.images?.length)) {
    throw new Error("No readable material content.");
  }

  content.push({
    type: "text",
    text: `${textBlock}\nGenerate a study guide grounded strictly in the selected sources above. Do not invent content that is not present.`,
  });

  for (const img of input.images ?? []) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mediaType,
        data: img.base64,
      },
    });
    content.push({
      type: "text",
      text: `(Image source: ${img.fileName})`,
    });
  }

  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 4096,
    system: STUDY_GUIDE_SYSTEM,
    messages: [{ role: "user", content }],
  });

  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no study guide text.");
  }

  return stripFences(block.text).trim();
}

const RESUME_HTML_BASE = `You format a student resume as a complete, self-contained HTML document from structured user data.
Improve phrasing — do NOT invent facts.

Rules (strict):
- Never invent companies, titles, dates, schools, metrics, tools, or accomplishments
  not present in the source data.
- You MAY rewrite bullets into stronger resume language (active verbs, concise phrasing)
  only if the underlying fact stays the same.
- Do not invent a Summary or skills lists. Only include summary/skills if they can be
  derived strictly from provided title, certifications, achievements, or experience wording.
- Omit sections with no grounded content.
- Copy education_location / education_state and each experience title, company, location, state, endDate, bullets from user data — never drop company when provided.
- Output HTML ONLY (no markdown fences, no prose before/after).
- Self-contained: inline <style> in <head>; no external stylesheets, fonts CDNs, or scripts.
- Include @page { size: letter; margin: 0.6in; } and body max-width suitable for US Letter.
- Use semantic structure (header, sections, h1/h2, ul/li). Black/gray text on white.
- Do not include <script>, event handlers, iframes, or remote images.`;

export async function generateResumeHtmlWithClaude(input: {
  userData: unknown;
  templateId: string;
  templateSpec: {
    name: string;
    sectionOrder: string[];
    formattingNotes: string;
    htmlStyleBrief: string;
  };
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local to generate resumes."
    );
  }

  const client = new Anthropic({ apiKey });
  const system = `${RESUME_HTML_BASE}

Selected style: ${input.templateId} — ${input.templateSpec.name}
Suggested section order: ${input.templateSpec.sectionOrder.join(" → ")}
Notes: ${input.templateSpec.formattingNotes}

${input.templateSpec.htmlStyleBrief}`;

  const userText = `User data (source of truth — do not invent beyond this):
${JSON.stringify(input.userData, null, 2)}

Return a complete HTML document only.`;

  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 8192,
    system,
    messages: [{ role: "user", content: userText }],
  });

  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no resume HTML.");
  }
  return stripFences(block.text).trim();
}

/** @deprecated JSON resume path kept for rollback; prefer generateResumeHtmlWithClaude. */
const RESUME_SYSTEM = `You are formatting a resume from structured user-provided data. Your job is to
improve phrasing and structure — NOT invent facts.

Rules (strict):
- Never invent companies, titles, dates, schools, metrics, tools, or accomplishments
  not present in the source data below.
- You MAY rewrite bullet points into stronger resume language (active verbs,
  concise phrasing, removing filler words) as long as the underlying fact,
  scope, and meaning stay the same as what the user wrote.
- You MAY reorder bullets within an experience entry for impact, but do not
  merge two experiences or move a bullet to a different job.
- If a bullet is vague (e.g. "helped with stuff"), tighten the wording but do
  not add specifics (numbers, tools, outcomes) that weren't stated.
- Do not invent a Summary or skills lists. Only include summary / professionalSkills /
  technicalSkills if they can be derived strictly from provided title, certifications,
  achievements, or experience wording — never add tools or claims not in the data.
- Output must fit the selected template section expectations — omit sections with no grounded content.
- Return JSON only matching this shape (no markdown fences, no prose):
{
  "summary": string | null,
  "professionalSkills": string[],
  "technicalSkills": string[],
  "education": {
    "school": string,
    "degreeLine": string,
    "location": string | null,
    "state": string | null,
    "date": string | null,
    "details": string[]
  },
  "experience": [
    {
      "title": string,
      "company": string,
      "location": string,
      "state": string,
      "endDate": string,
      "bullets": string[]
    }
  ],
  "projects": [{ "title": string, "description": string, "dateContext": string }],
  "extracurriculars": string[],
  "certifications": string[],
  "achievements": string[],
  "additional": string[]
}
Use empty arrays when a list has no grounded items. education and experience are required.
Copy education_location → education.location and education_state → education.state from user data (do not invent).
- Copy each experience entry's title, company, location, and state from user data (do not invent or drop company).`;

export async function generateResumeWithClaude(input: {
  userData: unknown;
  templateId: string;
  templateSpec: { name: string; sectionOrder: string[]; formattingNotes: string };
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local to generate resumes."
    );
  }

  const client = new Anthropic({ apiKey });
  const userText = `Selected template: ${input.templateId} — ${input.templateSpec.name}
Template section order: ${input.templateSpec.sectionOrder.join(" → ")}
Formatting: ${input.templateSpec.formattingNotes}

User data (source of truth — do not invent beyond this):
${JSON.stringify(input.userData, null, 2)}

Return JSON only.`;

  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 8192,
    system: RESUME_SYSTEM,
    messages: [{ role: "user", content: userText }],
  });

  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no resume text.");
  }
  return stripFences(block.text).trim();
}

const QUIZ_FLASHCARD_SYSTEM = `You create study quizzes or flashcards for university students STRICTLY from provided sources.

Anti-fabrication rules:
- Use ONLY information present in the selected sources.
- Do NOT invent facts, definitions, formulas, examples, or claims not in the sources.
- Prefer 15–20 items when the sources support it. Never pad with generic filler.
- If sources are too thin to produce at least ~8 meaningful grounded items, return:
  { "thin": true, "message": "<brief explanation>" }
  instead of inventing content.

For mode=quiz return JSON only:
{
  "thin": false,
  "items": [
    {
      "question": string,
      "options": [string, string, string, string],
      "correctIndex": 0|1|2|3,
      "explanation": string
    }
  ]
}

For mode=flashcard return JSON only:
{
  "thin": false,
  "items": [
    { "front": string, "back": string }
  ]
}

No markdown fences. No prose outside JSON.`;

export async function generateQuizOrFlashcardsWithClaude(input: {
  mode: "quiz" | "flashcard";
  className: string;
  classCode?: string | null;
  materialTexts: { fileName: string; text: string }[];
  images?: {
    fileName: string;
    base64: string;
    mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  }[];
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local to generate quizzes."
    );
  }

  const client = new Anthropic({ apiKey });
  const content: Anthropic.MessageCreateParams["messages"][0]["content"] = [];

  const label = [input.classCode, input.className].filter(Boolean).join(" — ");
  let textBlock = `Course: ${label || input.className}\nMode: ${input.mode}\n\nSelected sources only — do not use outside knowledge:\n\n`;
  for (const m of input.materialTexts) {
    textBlock += `--- Source: ${m.fileName} ---\n${m.text.slice(0, 40000)}\n\n`;
  }

  content.push({
    type: "text",
    text: `${textBlock}\nGenerate a ${input.mode} set grounded strictly in the sources above. JSON only.`,
  });

  for (const img of input.images ?? []) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mediaType,
        data: img.base64,
      },
    });
    content.push({
      type: "text",
      text: `(Image source: ${img.fileName})`,
    });
  }

  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 8192,
    system: QUIZ_FLASHCARD_SYSTEM,
    messages: [{ role: "user", content }],
  });

  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no quiz/flashcard text.");
  }
  return stripFences(block.text).trim();
}

