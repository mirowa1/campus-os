import { NextRequest, NextResponse } from "next/server";
import { generateFollowUp } from "@/lib/assignment-guide";
import type {
  AssignmentGuide,
  DiagnosticAnswer,
  FollowUpType,
} from "@/lib/assignment-guide-shared";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const FOLLOW_UP_TYPES = new Set<FollowUpType>(["alternate_explanation"]);

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

    const body = (await request.json()) as Record<string, unknown>;
    const type = body.type;
    if (typeof type !== "string" || !FOLLOW_UP_TYPES.has(type as FollowUpType)) {
      return NextResponse.json(
        { error: "Invalid follow-up type." },
        { status: 400 }
      );
    }
    if (!body.originalGuide || typeof body.originalGuide !== "object") {
      return NextResponse.json(
        { error: "originalGuide is required." },
        { status: 400 }
      );
    }
    if (typeof body.assignmentContext !== "string") {
      return NextResponse.json(
        { error: "assignmentContext must be a string." },
        { status: 400 }
      );
    }

    let diagnosticAnswers: DiagnosticAnswer[] | undefined;
    if (Array.isArray(body.diagnosticAnswers)) {
      diagnosticAnswers = body.diagnosticAnswers
        .filter(
          (a): a is DiagnosticAnswer =>
            !!a &&
            typeof a === "object" &&
            typeof (a as DiagnosticAnswer).questionId === "string" &&
            typeof (a as DiagnosticAnswer).value === "string"
        )
        .map((a) => ({
          questionId: a.questionId,
          value: a.value,
        }));
    }

    const result = await generateFollowUp({
      type: type as FollowUpType,
      originalGuide: body.originalGuide as AssignmentGuide,
      diagnosticAnswers,
      assignmentContext: body.assignmentContext,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Follow-up generation failed";
    console.error("assignment-guide/followup:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
