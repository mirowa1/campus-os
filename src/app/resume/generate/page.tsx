import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { ResumeGenerateClient } from "@/components/ResumeGenerateClient";
import { getUserOrRedirect } from "@/lib/supabase/get-user-or-redirect";
import { createClient } from "@/lib/supabase/server";
import { isResumeTemplateId } from "@/lib/resume-templates";
import type { ResumeTemplateId } from "@/lib/types";

export default async function ResumeGeneratePage() {
  const supabase = createClient();
  const user = await getUserOrRedirect(supabase);

  const { data: resume } = await supabase
    .from("resumes")
    .select("id, template_choice")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!resume) redirect("/resume");

  const { data: dataRow } = await supabase
    .from("resume_data")
    .select("full_name")
    .eq("resume_id", resume.id)
    .maybeSingle();

  if (!dataRow) redirect("/resume");

  const initialTemplate: ResumeTemplateId | null = isResumeTemplateId(
    resume.template_choice
  )
    ? resume.template_choice
    : null;

  return (
    <div className="min-h-screen">
      <AppNav email={user.email} />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <ResumeGenerateClient
          resumeId={resume.id}
          initialTemplate={initialTemplate}
        />
      </main>
    </div>
  );
}
