import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Terms of Service | Coursework by CoreMax",
  description:
    "Coursework by CoreMax terms of service for use of the student OS platform.",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <BrandMark href="/" size="sm" />
          <Link href="/login" className="btn btn-ghost text-xs">
            Log in
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <h1 className="font-heading text-4xl">Terms of Service</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Last updated: August 3, 2026
        </p>

        <div className="mt-8 space-y-8 text-[var(--ink)] leading-relaxed">
          <section className="space-y-3">
            <h2 className="font-heading text-2xl">Agreement</h2>
            <p>
              By creating an account or using CoreMax, you agree to these Terms
              of Service. If you do not agree, do not use the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-2xl">The service</h2>
            <p>
              CoreMax is a student productivity application that helps you
              upload syllabi, track deadlines and grades, organize notes, and
              use AI-assisted study and resume tools. Features may change over
              time.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-2xl">Accounts</h2>
            <p>
              You are responsible for your account credentials and for activity
              under your account. Provide accurate information and keep your
              password secure. You must be able to lawfully use the service in
              your jurisdiction.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-2xl">Acceptable use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                Upload content you do not have the right to use, or that is
                unlawful, harmful, or infringing.
              </li>
              <li>
                Attempt to access other users&apos; data, disrupt the service,
                or abuse AI or messaging features.
              </li>
              <li>
                Use CoreMax to send spam or unsolicited marketing SMS.
              </li>
              <li>
                Reverse engineer or misuse the platform except as allowed by
                law.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-2xl">Your content</h2>
            <p>
              You retain ownership of syllabi, notes, and other materials you
              upload. You grant CoreMax a limited license to host and process
              that content solely to provide the service to you (including AI
              features you choose to use).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-2xl">AI outputs</h2>
            <p>
              Study guides, quizzes, resume drafts, and similar AI outputs may
              contain errors. You are responsible for reviewing them before
              relying on them for coursework, applications, or other decisions.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-2xl">SMS notifications</h2>
            <p>
              Optional SMS features are subject to our Privacy Policy and
              carrier rules. Message and data rates may apply. You can opt out
              by disabling SMS in Profile settings or replying STOP.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-2xl">Disclaimers</h2>
            <p>
              CoreMax is provided &quot;as is&quot; and &quot;as
              available.&quot; We do not warrant that the service will be
              uninterrupted, error-free, or that extracted syllabus data or AI
              outputs will be complete or accurate. Academic and career
              decisions remain yours.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-2xl">Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, CoreMax and its operators
              will not be liable for indirect, incidental, special,
              consequential, or punitive damages, or for lost grades,
              opportunities, profits, or data, arising from your use of the
              service. Our total liability for any claim relating to the
              service will not exceed the greater of (a) the amounts you paid
              us for the service in the twelve months before the claim, or (b)
              fifty U.S. dollars (US $50) if you have not paid us.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-2xl">Termination</h2>
            <p>
              You may stop using CoreMax at any time. We may suspend or
              terminate access if you violate these terms or if we need to
              protect the service or other users.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-2xl">Changes</h2>
            <p>
              We may update these terms from time to time. The &quot;Last
              updated&quot; date at the top will change when we do. Continued
              use after changes means you accept the updated terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-2xl">Contact</h2>
            <p>
              Questions about these terms:{" "}
              <a
                href="mailto:maxwelllirowa1@gmail.com"
                className="text-[var(--accent)] hover:underline"
              >
                maxwelllirowa1@gmail.com
              </a>
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
