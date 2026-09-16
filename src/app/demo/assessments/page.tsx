import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { DemoAssessmentsClient } from "@/components/DemoAssessmentsClient";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getDemoAssessmentPanelProps } from "@/lib/demo-assessments-data";

export const metadata: Metadata = {
  title: "Assessments demo — Coursework by CoreMax",
  description:
    "See how Coursework color-codes overdue, due soon, and upcoming work across every class.",
  robots: { index: true, follow: true },
};

export default function DemoAssessmentsPage() {
  const { items, classes } = getDemoAssessmentPanelProps();

  return (
    <div className="hero-blob-shell relative min-h-screen">
      <div className="hero-blob" aria-hidden />
      <header className="relative z-40 border-b border-[var(--line)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <Logo href="/" size="sm" rotated={false} withByline={false} />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/signup" className="btn btn-ghost text-xs">
              Sign up
            </Link>
          </div>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-3xl px-6 py-10 pb-28">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
          Interactive demo
        </p>
        <h1 className="mt-2 font-heading text-4xl">Assessments</h1>
        <p className="mt-2 text-[var(--muted)]">
          Everything due across your classes — color-coded like ClassToExcel.
          Tap the filters to triage. This is sample data, not a live account.
        </p>
        <div className="mt-8">
          <Suspense fallback={null}>
            <DemoAssessmentsClient items={items} classes={classes} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
