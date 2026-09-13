import Link from "next/link";
import type { Metadata } from "next";
import { AppNav } from "@/components/AppNav";
import { BillingBanner } from "@/components/BillingBanner";
import { BillingSettingsCard } from "@/components/BillingSettingsCard";
import { GoogleCalendarSettings } from "@/components/GoogleCalendarSettings";
import { getBillingProfile } from "@/lib/billing";
import { getUserOrRedirect } from "@/lib/supabase/get-user-or-redirect";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const supabase = createClient();
  const user = await getUserOrRedirect(supabase);

  const [{ data: connection }, profile] = await Promise.all([
    supabase
      .from("google_calendar_connections")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    getBillingProfile(supabase, user.id, user.email),
  ]);

  return (
    <div>
      <AppNav email={user.email} />
      <main className="mx-auto max-w-3xl space-y-8 px-6 py-10">
        <div>
          <h1 className="font-heading text-4xl">Settings</h1>
          <p className="mt-2 text-[var(--muted)]">
            Account integrations. Profile details live on{" "}
            <Link href="/profile" className="text-[var(--accent)] hover:underline">
              Profile
            </Link>
            .
          </p>
        </div>
        <BillingBanner />
        <BillingSettingsCard profile={profile} />
        <GoogleCalendarSettings connected={!!connection} />
      </main>
    </div>
  );
}
