import { AppNav } from "@/components/AppNav";
import { AssignmentGuidePanel } from "@/components/AssignmentGuidePanel";
import { getUserOrRedirect } from "@/lib/supabase/get-user-or-redirect";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  robots: { index: false },
};

export default async function AssignmentGuidePage() {
  const supabase = createClient();
  const user = await getUserOrRedirect(
    supabase,
    "/login?next=/assignment-guide"
  );

  return (
    <div>
      <AppNav email={user.email} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
          Assignment Guide
        </p>
        <h1 className="font-heading mt-3 text-4xl md:text-5xl">
          Understand the assignment — then do the work yourself
        </h1>
        <p className="mt-3 text-[var(--muted)]">
          Upload or paste a prompt to get requirements, concepts, a structural
          outline, and common pitfalls. This mode never writes a submittable
          draft or solves your specific problem for you.
        </p>

        <AssignmentGuidePanel />
      </main>
    </div>
  );
}
