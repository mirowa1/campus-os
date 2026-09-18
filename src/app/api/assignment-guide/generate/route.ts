import { NextRequest, NextResponse } from "next/server";
import {
  generateAssignmentGuide,
  type AssignmentGuideTone,
} from "@/lib/assignment-guide";
import { extractSyllabusContent } from "@/lib/extract";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const TONES = new Set<AssignmentGuideTone>([
  "neutral",
  "encouraging",
  "direct",
]);

function parseTone(value: unknown): AssignmentGuideTone {
  if (typeof value === "string" && TONES.has(value as AssignmentGuideTone)) {
    return value as AssignmentGuideTone;
  }
  return "neutral";
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        {
          error:
            "ANTHROPIC_API_KEY is not set. Add it to .env.local to use Assignment Guide.",
        },
        { status: 503 }
      );
    }

    const contentType = request.headers.get("content-type") || "";
    let courseName: string | undefined;
    let professorName: string | undefined;
    let extraContext: string | undefined;
    let tone: AssignmentGuideTone = "neutral";
    let pastedText: string | undefined;
    let file: File | null = null;
    let diagnosticAnswers: { questionId: string; value: string }[] | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const maybeFile = form.get("file");
      if (maybeFile instanceof File && maybeFile.size > 0) {
        file = maybeFile;
      }
      courseName = optionalString(form.get("courseName"));
      professorName = optionalString(form.get("professorName"));
      extraContext = optionalString(form.get("extraContext"));
      tone = parseTone(form.get("tone"));
      pastedText = optionalString(form.get("text"));
      const rawAnswers = form.get("diagnosticAnswers");
      if (typeof rawAnswers === "string" && rawAnswers.trim()) {
        try {
          const parsed = JSON.parse(rawAnswers) as unknown;
          if (Array.isArray(parsed)) {
            diagnosticAnswers = parsed
              .filter(
                (a): a is { questionId: string; value: string } =>
                  !!a &&
                  typeof a === "object" &&
                  typeof (a as { questionId?: unknown }).questionId ===
                    "string" &&
                  typeof (a as { value?: unknown }).value === "string"
              )
              .map((a) => ({
                questionId: a.questionId,
                value: a.value,
              }));
          }
        } catch {
          /* ignore malformed */
        }
      }
    } else {
      const body = (await request.json()) as Record<string, unknown>;
      courseName = optionalString(body.courseName);
      professorName = optionalString(body.professorName);
      extraContext = optionalString(body.extraContext);
      tone = parseTone(body.tone);
      pastedText = optionalString(body.text);
      if (Array.isArray(body.diagnosticAnswers)) {
        diagnosticAnswers = body.diagnosticAnswers
          .filter(
            (a): a is { questionId: string; value: string } =>
              !!a &&
              typeof a === "object" &&
              typeof (a as { questionId?: unknown }).questionId === "string" &&
              typeof (a as { value?: unknown }).value === "string"
          )
          .map((a) => ({
            questionId: a.questionId,
            value: a.value,
          }));
      }
    }

    if (!file && !pastedText) {
      return NextResponse.json(
        { error: "Provide a file upload or pasted assignment text." },
        { status: 400 }
      );
    }

    let guideInput: Parameters<typeof generateAssignmentGuide>[0] = {
      courseName,
      professorName,
      extraContext,
      tone,
      diagnosticAnswers,
    };

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const extracted = await extractSyllabusContent(
        buffer,
        file.type || "",
        file.name
      );
      if (extracted.kind === "image") {
        guideInput = {
          ...guideInput,
          imageBase64: extracted.base64,
          mediaType: extracted.mediaType,
        };
      } else {
        const combined = [extracted.text, pastedText]
          .filter(Boolean)
          .join("\n\n");
        if (!combined.trim()) {
          return NextResponse.json(
            { error: "Could not extract text from that file." },
            { status: 400 }
          );
        }
        guideInput = { ...guideInput, text: combined };
      }
    } else {
      guideInput = { ...guideInput, text: pastedText };
    }

    const { guide, selfCheck } = await generateAssignmentGuide(guideInput);
    return NextResponse.json({ guide, selfCheck });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Assignment guide failed";
    console.error("assignment-guide/generate:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
