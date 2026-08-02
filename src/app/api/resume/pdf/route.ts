import { NextResponse } from "next/server";
import { assertValidResumeHtml, wrapResumeDocument } from "@/lib/resume-html";
import { htmlToPdfBuffer } from "@/lib/resume-pdf-chromium";
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
    const pdf = await htmlToPdfBuffer(documentHtml);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Resume.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("resume/pdf:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "PDF generation failed. Please try again.",
      },
      { status: 500 }
    );
  }
}
