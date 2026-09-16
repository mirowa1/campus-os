import type { Metadata } from "next";
import { AppNav } from "@/components/AppNav";
import { CheckoutClient } from "@/components/CheckoutClient";
import { getUserOrRedirect } from "@/lib/supabase/get-user-or-redirect";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const supabase = createClient();
  const user = await getUserOrRedirect(supabase, "/login?next=/checkout");

  return (
    <div>
      <AppNav email={user.email} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-heading text-4xl">Coursework Pro</h1>
        <p className="mt-2 text-[var(--muted)]">
          Choose a plan to unlock unlimited syllabus uploads, calendar sync, and
          ClassToExcel.
        </p>
        <CheckoutClient />
      </main>
    </div>
  );
}
