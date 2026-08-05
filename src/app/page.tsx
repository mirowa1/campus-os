import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { SiteFooter } from "@/components/SiteFooter";
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
    <main className="landing-hero flex min-h-screen flex-col">
      <div className="landing-hero-blob" aria-hidden />

      <div className="landing-hero-inner flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-3">
          <BrandMark href="/" size="md" />
          <div className="flex shrink-0 gap-2 sm:gap-3">
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

        <section className="flex flex-1 flex-col justify-center py-8 md:py-16">
          <div className="max-w-xl md:max-w-2xl">
            <p className="font-heading text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
              Coursework by CoreMax
            </p>
            <h1 className="landing-hero-wordmark font-heading mt-4 text-[clamp(3.25rem,17vw,8.5rem)] font-bold leading-[0.92] tracking-tight text-white md:mt-5">
              COREMAX
            </h1>
            <p className="mt-6 max-w-md text-base text-[var(--muted)] md:mt-8 md:text-lg">
              Upload your syllabus. Know exactly where you stand.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 md:mt-10">
              <Link href="/signup" className="btn btn-primary px-6 py-3 text-base">
                Get started — under 60 seconds
              </Link>
              <Link href="/login" className="btn btn-ghost px-6 py-3 text-base">
                I already have an account
              </Link>
            </div>
          </div>
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}
