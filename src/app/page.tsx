import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AddToHomeScreenBanner } from "@/components/AddToHomeScreenBanner";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <>
      <AddToHomeScreenBanner />
      <main className="landing-page">
        <section className="landing-hero flex min-h-[85dvh] flex-col">
          <div className="landing-hero-inner flex flex-1 flex-col">
            <header className="flex items-center justify-between gap-3">
              <Logo href="/" size="sm" rotated={false} withByline={false} />
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <ThemeToggle />
                <Link
                  href="/login"
                  className="btn btn-ghost px-3 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="btn btn-primary px-3 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm"
                >
                  Sign up
                </Link>
              </div>
            </header>

            <div className="flex flex-1 flex-col justify-center py-8 md:py-16">
              <div className="max-w-xl md:max-w-2xl">
                <div className="mb-2 max-w-full overflow-visible">
                  <Logo href={null} size="lg" rotated withByline />
                </div>
                <h1 className="landing-hero-lede mt-6 max-w-md text-base font-normal tracking-normal text-[var(--muted)] md:mt-8 md:text-lg">
                  All you need in one platform.
                </h1>
                <div className="mt-8 flex flex-wrap gap-3 md:mt-10">
                  <Link
                    href="/signup"
                    className="btn btn-primary px-6 py-3 text-base"
                  >
                    Get started — under 60 seconds
                  </Link>
                  <Link
                    href="/login"
                    className="btn btn-ghost px-6 py-3 text-base"
                  >
                    I already have an account
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="landing-assessments"
          aria-labelledby="assessments-heading"
        >
          <div className="landing-assessments-inner">
            <p className="landing-assessments-eyebrow">Assessments</p>
            <h2
              id="assessments-heading"
              className="font-heading landing-assessments-title"
            >
              Every assessment, every class — one color-coded view
            </h2>
            <p className="landing-assessments-lede">
              See what&apos;s overdue, due this week, and coming up across every
              class — without opening each one. Color-coded by urgency so you
              never wonder what&apos;s next.
            </p>
            <Link
              href="/signup"
              className="btn btn-primary mt-6 inline-flex px-6 py-3 text-base"
            >
              See your assessments
            </Link>
          </div>
          <div className="landing-assessments-visual">
            <Image
              src="/landing/assessments-desktop.png"
              alt="Assessments triage view with overdue, due soon, and upcoming work color-coded across classes"
              width={1280}
              height={2100}
              className="landing-assessments-img landing-assessments-img-desktop"
              sizes="100vw"
              unoptimized
            />
            <Image
              src="/landing/assessments-mobile.png"
              alt="Assessments on mobile with color-coded urgency cards"
              width={390}
              height={1800}
              className="landing-assessments-img landing-assessments-img-mobile"
              sizes="100vw"
              unoptimized
            />
          </div>
        </section>

        <section
          className="landing-cte landing-cte-compact"
          aria-labelledby="cte-heading"
        >
          <div className="landing-cte-inner">
            <p className="landing-cte-eyebrow">ClassToExcel</p>
            <h2 id="cte-heading" className="font-heading landing-cte-title">
              Full semester export
            </h2>
            <p className="landing-cte-lede">
              Your entire semester — assessments, grades, and schedule — in one
              file, anytime. No lock-in.
            </p>
            <Link
              href="/signup"
              className="btn btn-primary mt-6 inline-flex px-6 py-3 text-base"
            >
              Export your semester
            </Link>
          </div>
          <div className="landing-cte-visual">
            <Image
              src="/landing/classtoexcel-assessments.png"
              alt="ClassToExcel spreadsheet preview with a color-coded sample of assessments"
              width={1440}
              height={1100}
              className="landing-cte-img landing-cte-img-desktop"
              sizes="100vw"
              unoptimized
            />
            <Image
              src="/landing/classtoexcel-assessments-mobile.png"
              alt="ClassToExcel assessments on mobile"
              width={780}
              height={1688}
              className="landing-cte-img landing-cte-img-mobile"
              sizes="100vw"
              unoptimized
            />
          </div>
        </section>

        <section className="landing-secondary" aria-label="More features">
          <div className="landing-secondary-inner">
            <h2 className="font-heading text-2xl md:text-3xl">
              Also in Coursework
            </h2>
            <ul className="landing-secondary-list">
              <li>
                <strong>Google Calendar sync</strong>
                <span>Due dates where you already look.</span>
              </li>
              <li>
                <strong>Grade tracking</strong>
                <span>Projections for what you need on remaining work.</span>
              </li>
              <li>
                <strong>Study guides &amp; quizzes</strong>
                <span>Built from your course materials.</span>
              </li>
            </ul>
          </div>
        </section>

        <div className="landing-footer-wrap">
          <SiteFooter />
        </div>
      </main>
    </>
  );
}
