import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Privacy Policy | Coursework by CoreMax",
  description:
    "Coursework by CoreMax privacy policy, including SMS/mobile messaging disclosures for A2P 10DLC compliance.",
};

export default function PrivacyPage() {
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
        <h1 className="font-heading text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Last updated: August 17, 2026
        </p>

        <div className="prose-legal mt-8 space-y-8 text-[var(--ink)] leading-relaxed">
          <section className="space-y-3">
            <h2 className="font-heading text-2xl">Overview</h2>
            <p>
              CoreMax provides a student operating system that helps you
              organize courses, deadlines, grades, and study tools. This
              Privacy Policy explains what information we collect, how we use
              it, and your choices.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-2xl">Information we collect</h2>
            <p>Depending on how you use CoreMax, we may collect:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Account information</strong> — such as your email
                address, name, and profile details you choose to provide
                (major, expected graduation term, student ID, avatar).
              </li>
              <li>
                <strong>Course materials you upload</strong> — including
                syllabi, notes, and other class files you submit to the
                service.
              </li>
              <li>
                <strong>Academic data you enter or we extract</strong> —
                including class names, assessment titles, due dates, grade
                weights, scores, and target grades.
              </li>
              <li>
                <strong>Content generated for you</strong> — such as study
                guides, quizzes, flashcards, and resume drafts created using
                our AI features from materials you provide.
              </li>
              <li>
                <strong>Mobile phone number</strong> — if you enable SMS
                notifications (see SMS / mobile messaging below).
              </li>
              <li>
                <strong>Usage and technical data</strong> — such as login
                activity and basic request logs needed to operate and secure
                the service.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-2xl">How we use your information</h2>
            <p>We use the information above to:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                Power CoreMax features — calendar deadlines, grade tracking,
                class notes, AI study tools, and resume tools.
              </li>
              <li>
                Authenticate your account and keep your data private to you.
              </li>
              <li>
                Send optional notifications you request (including SMS, if
                enabled).
              </li>
              <li>
                Maintain, secure, and improve the service, and comply with
                legal obligations.
              </li>
            </ul>
            <p>
              We do not use your uploaded course materials or grades to train
              public AI models for unrelated third parties. AI features process
              content you provide to generate outputs for your account.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-2xl">
              SMS / mobile messaging
            </h2>
            <p>
              If you provide a mobile number and enable SMS notifications,
              CoreMax may send you text messages about upcoming assignments,
              exams, and related reminders.
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                We do not share mobile information or messaging consent with
                third parties or affiliates for marketing or promotional
                purposes. This includes phone numbers and any consent status
                related to SMS/text message communications.
              </li>
              <li>
                Message frequency varies based on your upcoming assignment due
                dates and notification settings, typically up to a few
                messages per week.
              </li>
              <li>Message and data rates may apply.</li>
              <li>
                You can opt out of SMS notifications at any time by disabling
                them in Profile settings or by replying STOP to any message.
              </li>
            </ul>
            <p>
              For help with SMS, reply HELP to any message or contact us at the
              email below.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-2xl">How we store your data</h2>
            <p>
              CoreMax stores account and application data using{" "}
              <strong>Supabase</strong> (hosted Postgres database, auth, and
              file storage). Access is protected with authentication and
              row-level security so that your classes, grades, and uploads are
              associated with your user account.
            </p>
            <p>
              We retain your data while your account is active. You may request
              deletion of your account and associated data by contacting us.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-2xl">Data protection</h2>
            <p>
              We use technical controls to protect personal and account data,
              including:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Row-Level Security (RLS)</strong> in our Supabase
                database so that authenticated users can only access their own
                records (classes, grades, uploads, profile, and related data).
              </li>
              <li>
                <strong>Authentication</strong> is required to access personal
                application data. Public pages (such as this Privacy Policy)
                do not expose your account information.
              </li>
              <li>
                <strong>Google Calendar OAuth tokens</strong> (access and
                refresh tokens) are encrypted at rest using a dedicated
                encryption key before they are stored. We use these
                tokens only to sync calendar events you authorize.
              </li>
              <li>
                Data is transmitted over <strong>HTTPS/TLS</strong> in transit.
              </li>
              <li>
                <strong>Phone numbers</strong> collected for SMS are used only
                for verification and optional due-date reminders. We do not
                sell or share them for marketing.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-2xl">
              AI features and Google API data
            </h2>
            <p>
              CoreMax uses the Claude API (Anthropic) to power AI features such
              as study guides, quizzes, and resume generation. These AI features
              process only the course materials, notes, and content you directly
              upload or provide for that purpose — Google Calendar data is never
              sent to or processed by any AI model. Google Calendar API access is
              used solely to create and display calendar events reflecting
              assignment and exam due dates; this data is not used to train,
              improve, or fine-tune any AI/ML model. Our use of data received
              from Google APIs adheres to the Google API Services User Data
              Policy, including the Limited Use requirements.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-2xl">Sharing</h2>
            <p>
              We share data only with service providers that help us operate
              CoreMax (for example, hosting, database, AI processing, and SMS
              delivery), under agreements that limit use to providing those
              services. We do not sell your personal information.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-2xl">Your choices</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>Update profile details in Profile settings.</li>
              <li>
                Disable SMS notifications in Profile settings or by replying
                STOP.
              </li>
              <li>
                Contact us to request access to or deletion of your account
                data.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-2xl">Contact</h2>
            <p>
              For privacy questions, contact:{" "}
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
