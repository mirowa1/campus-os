import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { ProfileForm } from "@/components/ProfileForm";
import { SiteFooter } from "@/components/SiteFooter";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const row: Profile = profile
    ? (profile as Profile)
    : {
        id: user.id,
        email: user.email ?? "",
        created_at: new Date().toISOString(),
        full_name: null,
        major: null,
        expected_grad_term: null,
        student_id: null,
        avatar_path: null,
      };

  if (!profile) {
    await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email ?? "",
    });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav email={user.email} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="font-heading text-4xl">Profile</h1>
        <p className="mt-2 text-[var(--muted)]">
          Your account details — private to you.
        </p>
        <div className="mt-8">
          <ProfileForm initial={row} email={user.email ?? row.email} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
