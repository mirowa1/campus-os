import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { ResumeBuilder } from "@/components/ResumeBuilder";
import {
  emptyExperience,
  emptyResumeData,
  normalizeAchievements,
  normalizeCertifications,
  normalizeExperience,
  normalizeExtracurriculars,
  normalizeProjects,
} from "@/lib/resume";
import { createClient } from "@/lib/supabase/server";
import type { ResumeDataRow, ResumeRow } from "@/lib/types";

export default async function ResumePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let { data: resume } = await supabase
    .from("resumes")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!resume) {
    const { data: created, error: createError } = await supabase
      .from("resumes")
      .insert({ user_id: user.id, current_step: 1 })
      .select("*")
      .single();
    if (createError || !created) {
      return (
        <div className="min-h-screen">
          <AppNav email={user.email} />
          <main className="mx-auto max-w-3xl px-6 py-10">
            <p className="text-[var(--danger)]">
              Could not create resume draft:{" "}
              {createError?.message ?? "unknown error"}
            </p>
          </main>
        </div>
      );
    }
    resume = created;
    await supabase.from("resume_data").insert({
      resume_id: created.id,
      experience: emptyExperience(),
    });
  }

  const { data: rawData } = await supabase
    .from("resume_data")
    .select("*")
    .eq("resume_id", resume.id)
    .maybeSingle();

  let initialData: ResumeDataRow;
  if (!rawData) {
    await supabase.from("resume_data").insert({
      resume_id: resume.id,
      experience: emptyExperience(),
    });
    initialData = emptyResumeData(resume.id);
  } else {
    initialData = {
      resume_id: rawData.resume_id,
      full_name: rawData.full_name,
      city: rawData.city ?? null,
      state: rawData.state,
      phone: rawData.phone,
      work_email: rawData.work_email,
      linkedin: rawData.linkedin,
      professional_title: rawData.professional_title,
      school: rawData.school,
      major: rawData.major,
      concentration: rawData.concentration,
      minor: rawData.minor,
      education_location: rawData.education_location ?? null,
      education_state: rawData.education_state ?? null,
      achievements: normalizeAchievements(rawData.achievements),
      certifications: normalizeCertifications(rawData.certifications),
      projects: normalizeProjects(rawData.projects),
      extracurriculars: normalizeExtracurriculars(rawData.extracurriculars),
      experience: normalizeExperience(rawData.experience),
    };
  }

  return (
    <div className="min-h-screen">
      <AppNav email={user.email} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <ResumeBuilder
          resume={resume as ResumeRow}
          initialData={initialData}
        />
      </main>
    </div>
  );
}
