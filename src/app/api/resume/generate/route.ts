import { NextResponse } from "next/server";
import { generateResumeWithClaude } from "@/lib/claude";
import { getTemplateSpec, isResumeTemplateId } from "@/lib/resume-templates";
import { parseTailoredResume } from "@/lib/resume-validate";
import { createClient } from "@/lib/supabase/server";
import type { ResumeDataRow } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function intakeHasExperience(userData: ResumeDataRow): boolean {
  return userData.experience.some(
    (e) =>
      (typeof e?.title === "string" && e.title.trim()) ||
      (typeof e?.company === "string" && e.company.trim())
  );
}

function tryParseTailored(rawText: string, requireExperience: boolean) {
  const parsed = JSON.parse(rawText) as unknown;
  return parseTailoredResume(parsed, { requireExperience });
}

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
      state: raw.state,
      phone: raw.phone,
      work_email: raw.work_email,
      linkedin: raw.linkedin,
      professional_title: raw.professional_title,
      school: raw.school,
      major: raw.major,
      concentration: raw.concentration,
      minor: raw.minor,
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

    const requireExperience = intakeHasExperience(userData);
    let tailored;
    let lastError = "Resume generation failed, please try again";

    for (let attempt = 0; attempt < 2; attempt++) {
      let text = "";
      try {
        text = await generateResumeWithClaude({
          userData,
          templateId: templateChoice,
          templateSpec: {
            name: templateSpec.name,
            sectionOrder: templateSpec.sectionOrder,
            formattingNotes: templateSpec.formattingNotes,
          },
        });
        tailored = tryParseTailored(text, requireExperience);
        break;
      } catch (err) {
        lastError =
          err instanceof Error
            ? err.message
            : "Resume generation failed, please try again";
        console.error(`resume/generate attempt ${attempt + 1}:`, err);
        if (text) {
          console.error(
            `resume/generate raw Claude (truncated):`,
            text.slice(0, 4000)
          );
        }
      }
    }

    if (!tailored) {
      return NextResponse.json(
        {
          error: "Resume generation failed, please try again",
          detail: lastError,
        },
        { status: 502 }
      );
    }

    const { error: saveError } = await supabase
      .from("resumes")
      .update({
        template_choice: templateChoice,
        generated_content: tailored,
        updated_at: new Date().toISOString(),
      })
      .eq("id", resume.id)
      .eq("user_id", user.id);

    if (saveError) {
      return NextResponse.json(
        { error: "Generated but failed to save. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      resumeId: resume.id,
      templateChoice,
      content: tailored,
      contact: {
        full_name: userData.full_name,
        state: userData.state,
        phone: userData.phone,
        work_email: userData.work_email,
        linkedin: userData.linkedin,
        professional_title: userData.professional_title,
      },
    });
  } catch (err) {
    console.error("resume/generate:", err);
    return NextResponse.json(
      { error: "Resume generation failed, please try again" },
      { status: 500 }
    );
  }
}
