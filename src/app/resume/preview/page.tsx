import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { ResumeHtmlPreviewClient } from "@/components/ResumeHtmlPreviewClient";
import { assertValidResumeHtml, wrapResumeDocument } from "@/lib/resume-html";
import { isResumeTemplateId } from "@/lib/resume-templates";
import { createClient } from "@/lib/supabase/server";

export default async function ResumePreviewPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: resume } = await supabase
    .from("resumes")
    .select("id, template_choice, generated_html")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!resume?.generated_html || !isResumeTemplateId(resume.template_choice)) {
    redirect("/resume/generate");
  }

  let initialHtml: string;
  try {
    initialHtml = wrapResumeDocument(assertValidResumeHtml(resume.generated_html));
  } catch (err) {
    console.error("resume/preview invalid generated_html:", err);
    // Clear bad HTML only — leave generated_content for rollback
    await supabase
      .from("resumes")
      .update({ generated_html: null })
      .eq("id", resume.id)
      .eq("user_id", user.id);
    redirect("/resume/generate");
  }

  const { data: raw } = await supabase
    .from("resume_data")
    .select("full_name")
    .eq("resume_id", resume.id)
    .maybeSingle();

  if (!raw) redirect("/resume");

  return (
    <div className="min-h-screen">
      <AppNav email={user.email} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <ResumeHtmlPreviewClient
          resumeId={resume.id}
          template={resume.template_choice}
          initialHtml={initialHtml}
          fileBaseName={raw.full_name || "Resume"}
        />
      </main>
    </div>
  );
}
