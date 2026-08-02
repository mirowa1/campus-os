import { NextResponse } from "next/server";
import HTMLtoDOCX from "html-to-docx";
import { assertValidResumeHtml, wrapResumeDocument } from "@/lib/resume-html";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      resumeId?: unknown;
      html?: unknown;
    };

    let html: string | null =
      typeof body.html === "string" && body.html.trim() ? body.html : null;

    if (!html) {
      if (typeof body.resumeId !== "string" || !body.resumeId) {
        return NextResponse.json(
          { error: "resumeId or html required" },
          { status: 400 }
        );
      }
      const { data: resume, error } = await supabase
        .from("resumes")
        .select("id, generated_html")
        .eq("id", body.resumeId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error || !resume?.generated_html) {
        return NextResponse.json(
          { error: "No generated resume HTML found. Generate a resume first." },
          { status: 404 }
        );
      }
      html = resume.generated_html;
    }

    if (!html) {
      return NextResponse.json(
        { error: "No generated resume HTML found. Generate a resume first." },
        { status: 404 }
      );
    }

    const documentHtml = wrapResumeDocument(assertValidResumeHtml(html));
    const docx = await HTMLtoDOCX(documentHtml, null, {
      title: "Resume",
      creator: "CampusOS",
      orientation: "portrait",
      margins: {
        top: 720,
        right: 720,
        bottom: 720,
        left: 720,
      },
    });

    const buffer = Buffer.isBuffer(docx)
      ? docx
      : Buffer.from(docx as ArrayBuffer);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="Resume.docx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("resume/docx:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Word export failed. Please try again.",
      },
      { status: 500 }
    );
  }
}
