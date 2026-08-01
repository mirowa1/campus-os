import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { ResumePreviewClient } from "@/components/ResumePreviewClient";
import { isResumeTemplateId } from "@/lib/resume-templates";
import {
  normalizeTailoredResume,
  parseTailoredResume,
} from "@/lib/resume-validate";
import { createClient } from "@/lib/supabase/server";

export default async function ResumePreviewPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: resume } = await supabase
    .from("resumes")
    .select("id, template_choice, generated_content")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!resume?.generated_content || !isResumeTemplateId(resume.template_choice)) {
    redirect("/resume/generate");
  }

  let initialContent;
  try {
    initialContent = parseTailoredResume(resume.generated_content);
  } catch (err) {
    console.error("resume/preview invalid generated_content:", err);
    // Clear bad payload so generate page is the recovery path
    await supabase
      .from("resumes")
      .update({ generated_content: null })
      .eq("id", resume.id)
      .eq("user_id", user.id);
    redirect("/resume/generate");
  }

  const { data: raw } = await supabase
    .from("resume_data")
    .select(
      "full_name, state, phone, work_email, linkedin, professional_title"
    )
    .eq("resume_id", resume.id)
    .maybeSingle();

  if (!raw) redirect("/resume");

  return (
    <div className="min-h-screen">
      <AppNav email={user.email} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <ResumePreviewClient
          resumeId={resume.id}
          template={resume.template_choice}
          contact={{
            full_name: raw.full_name,
            state: raw.state,
            phone: raw.phone,
            work_email: raw.work_email,
            linkedin: raw.linkedin,
            professional_title: raw.professional_title,
          }}
          initialContent={normalizeTailoredResume(initialContent)}
        />
      </main>
    </div>
  );
}
