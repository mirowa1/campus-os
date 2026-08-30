import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import {
  ClassToExcelPanel,
  type ClassToExcelPickerClass,
} from "@/components/ClassToExcelPanel";
import {
  FREE_CLASSTOEXCEL_LIMIT,
  getBillingProfile,
  getClassToExcelRemaining,
  hasActiveSubscription,
} from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import type { ClassRow } from "@/lib/types";

function countByClassId(rows: { class_id: string }[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.class_id, (counts.get(row.class_id) ?? 0) + 1);
  }
  return counts;
}

export default async function ClassToExcelPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/classtoexcel");

  const profile = await getBillingProfile(supabase, user.id, user.email);
  const subscribed = hasActiveSubscription(profile);
  const remaining = getClassToExcelRemaining(profile);

  const { data: classes } = await supabase
    .from("classes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const classList = (classes ?? []) as ClassRow[];
  const ids = classList.map((c) => c.id);

  const [{ data: assessments }, { data: meetings }] =
    ids.length > 0
      ? await Promise.all([
          supabase.from("assessments").select("class_id").in("class_id", ids),
          supabase
            .from("class_meetings")
            .select("class_id")
            .in("class_id", ids),
        ])
      : [{ data: [] as { class_id: string }[] }, { data: [] as { class_id: string }[] }];

  const assessmentCounts = countByClassId(assessments ?? []);
  const meetingCounts = countByClassId(meetings ?? []);

  const pickerClasses: ClassToExcelPickerClass[] = classList.map((c) => ({
    id: c.id,
    label: [c.code, c.name].filter(Boolean).join(" — ") || c.name,
    assessmentCount: assessmentCounts.get(c.id) ?? 0,
    meetingCount: meetingCounts.get(c.id) ?? 0,
  }));

  return (
    <div>
      <AppNav email={user.email} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
          ClassToExcel
        </p>
        <h1 className="font-heading mt-3 text-4xl md:text-5xl">
          Export your semester to Excel
        </h1>
        <p className="mt-3 text-[var(--muted)]">
          Download assignments and class schedules as a spreadsheet — from your
          existing classes or a fresh syllabus upload.
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {subscribed
            ? "Unlimited conversions with Coursework Pro"
            : `${remaining ?? 0} of ${FREE_CLASSTOEXCEL_LIMIT} free conversions remaining`}
        </p>

        <ClassToExcelPanel classes={pickerClasses} />
      </main>
    </div>
  );
}
