import type { Metadata } from "next";
import { AppNav } from "@/components/AppNav";
import { ProfileForm } from "@/components/ProfileForm";
import {
  SmsRemindersCard,
  type NotificationPrefs,
} from "@/components/SmsRemindersCard";
import { SiteFooter } from "@/components/SiteFooter";
import { getUserOrRedirect } from "@/lib/supabase/get-user-or-redirect";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const supabase = createClient();
  const user = await getUserOrRedirect(supabase);

  const [{ data: profile }, { data: notifPrefs }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("notification_preferences")
      .select("sms_enabled, phone_number, phone_verified")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

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
        signup_utm_source: null,
        signup_utm_medium: null,
        signup_utm_campaign: null,
        signup_utm_content: null,
      };

  if (!profile) {
    await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email ?? "",
    });
  }

  const smsInitial: NotificationPrefs | null = notifPrefs
    ? {
        sms_enabled: Boolean(notifPrefs.sms_enabled),
        phone_number: notifPrefs.phone_number ?? null,
        phone_verified: Boolean(notifPrefs.phone_verified),
      }
    : null;

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav email={user.email} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="font-heading text-4xl">Profile</h1>
        <p className="mt-2 text-[var(--muted)]">
          Your account details — private to you.
        </p>
        <div className="mt-8 space-y-8">
          <ProfileForm initial={row} email={user.email ?? row.email} />
          <SmsRemindersCard initial={smsInitial} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
