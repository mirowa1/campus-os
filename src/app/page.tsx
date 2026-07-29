import Link from "next/link";
import { redirect } from "next/navigation";
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
    <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <p className="font-display text-2xl tracking-tight">CampusOS</p>
        <div className="flex gap-3">
          <Link href="/login" className="btn btn-ghost">
            Log in
          </Link>
          <Link href="/signup" className="btn btn-primary">
            Sign up
          </Link>
        </div>
      </header>

      <section className="mt-24 flex flex-1 flex-col justify-center pb-24">
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
          Student operating system
        </p>
        <h1 className="font-display max-w-3xl text-5xl leading-[1.05] tracking-tight md:text-7xl">
          Upload a syllabus.
          <br />
          <span className="italic text-[var(--accent)]">Own your semester.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-[var(--muted)]">
          CampusOS extracts every assignment, exam, and weight — then tracks your
          grades and tells you exactly what you need to hit your goal.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/signup" className="btn btn-primary px-6 py-3 text-base">
            Get started — under 60 seconds
          </Link>
          <Link href="/login" className="btn btn-ghost px-6 py-3 text-base">
            I already have an account
          </Link>
        </div>
      </section>
    </main>
  );
}
