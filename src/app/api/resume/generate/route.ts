import { NextResponse } from "next/server";
import { generateResumeHtmlWithClaude } from "@/lib/claude";
import { assertValidResumeHtml, wrapResumeDocument } from "@/lib/resume-html";
import { getTemplateSpec, isResumeTemplateId } from "@/lib/resume-templates";
import { createClient } from "@/lib/supabase/server";
import type { ResumeDataRow } from "@/lib/types";

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
      templateChoice?: unknown;
      resumeId?: unknown;
    };

    if (!isResumeTemplateId(body.templateChoice)) {
      return NextResponse.json(
        { error: "Choose template A, B, or C." },
        { status: 400 }
      );
    }
    const templateChoice = body.templateChoice;
    const templateSpec = getTemplateSpec(templateChoice);

    let resumeQuery = supabase
      .from("resumes")
      .select("id, user_id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (typeof body.resumeId === "string" && body.resumeId) {
      resumeQuery = supabase
        .from("resumes")
        .select("id, user_id")
        .eq("id", body.resumeId)
        .eq("user_id", user.id)
        .limit(1);
    }

    const { data: resume, error: resumeError } = await resumeQuery.maybeSingle();
    if (resumeError || !resume) {
      return NextResponse.json(
        { error: "No resume draft found. Finish the intake form first." },
        { status: 404 }
      );
    }

    const { data: raw, error: dataError } = await supabase
      .from("resume_data")
      .select("*")
      .eq("resume_id", resume.id)
      .maybeSingle();

    if (dataError || !raw) {
      return NextResponse.json(
        { error: "Resume data missing. Complete the intake form first." },
        { status: 404 }
      );
    }

    const userData: ResumeDataRow = {
      resume_id: raw.resume_id,
      full_name: raw.full_name,
      city: raw.city ?? null,
      state: raw.state,
      phone: raw.phone,
      work_email: raw.work_email,
      linkedin: raw.linkedin,
      professional_title: raw.professional_title,
      school: raw.school,
      major: raw.major,
      concentration: raw.concentration,
      minor: raw.minor,
      education_location: raw.education_location ?? null,
      education_state: raw.education_state ?? null,
      achievements: Array.isArray(raw.achievements) ? raw.achievements : [],
      certifications: Array.isArray(raw.certifications)
        ? raw.certifications
        : [],
      projects: Array.isArray(raw.projects) ? raw.projects : [],
      extracurriculars: Array.isArray(raw.extracurriculars)
        ? raw.extracurriculars
        : [],
      experience: Array.isArray(raw.experience) ? raw.experience : [],
    };

    let html: string | null = null;
    let lastError = "Resume generation failed, please try again";

    for (let attempt = 0; attempt < 2; attempt++) {
      let text = "";
      try {
        text = await generateResumeHtmlWithClaude({
          userData,
          templateId: templateChoice,
          templateSpec: {
            name: templateSpec.name,
            sectionOrder: templateSpec.sectionOrder,
            formattingNotes: templateSpec.formattingNotes,
            htmlStyleBrief: templateSpec.htmlStyleBrief,
          },
        });
        html = wrapResumeDocument(assertValidResumeHtml(text));
        break;
      } catch (err) {
        lastError =
          err instanceof Error
            ? err.message
            : "Resume generation failed, please try again";
        console.error(`resume/generate HTML attempt ${attempt + 1}:`, err);
        if (text) {
          console.error(
            `resume/generate raw Claude HTML (truncated):`,
            text.slice(0, 4000)
          );
        }
      }
    }

    if (!html) {
      return NextResponse.json(
        {
          error: "Resume generation failed, please try again",
          detail: lastError,
        },
        { status: 502 }
      );
    }

    // Save HTML; leave generated_content untouched for rollback.
    const { error: saveError } = await supabase
      .from("resumes")
      .update({
        template_choice: templateChoice,
        generated_html: html,
        updated_at: new Date().toISOString(),
      })
      .eq("id", resume.id)
      .eq("user_id", user.id);

    if (saveError) {
      console.error("resume/generate save error:", {
        message: saveError.message,
        code: saveError.code,
        details: saveError.details,
        hint: saveError.hint,
      });
      return NextResponse.json(
        {
          error: "Generated but failed to save. Please try again.",
          detail: saveError.message,
          code: saveError.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      resumeId: resume.id,
      templateChoice,
      html,
    });
  } catch (err) {
    console.error("resume/generate:", err);
    return NextResponse.json(
      { error: "Resume generation failed, please try again" },
      { status: 500 }
    );
  }
}
