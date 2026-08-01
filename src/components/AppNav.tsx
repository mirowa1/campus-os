"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/calendar", label: "Calendar" },
  { href: "/classes", label: "Classes" },
  { href: "/grades", label: "Grades" },
  { href: "/resume", label: "Resume" },
];

export function AppNav({ email }: { email?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-[var(--line)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="font-display text-xl">
            CoreMax
          </Link>
          <nav className="hidden gap-1 sm:flex">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    active
                      ? "bg-[var(--bg-soft)] text-[var(--ink)] ring-1 ring-[var(--accent)]/30"
                      : "text-[var(--muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {email && (
            <Link
              href="/profile"
              className="hidden text-xs text-[var(--muted)] hover:text-[var(--ink)] md:inline"
            >
              {email}
            </Link>
          )}
          <Link
            href="/profile"
            className="btn btn-ghost text-xs md:hidden"
          >
            Profile
          </Link>
          <Link href="/onboarding/upload" className="btn btn-ghost text-xs">
            + Syllabus
          </Link>
          <button type="button" onClick={signOut} className="btn btn-ghost text-xs">
            Sign out
          </button>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-6 pb-3 sm:hidden">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-1.5 text-sm whitespace-nowrap ${
                active
                  ? "bg-[var(--bg-soft)] text-[var(--ink)] ring-1 ring-[var(--accent)]/30"
                  : "text-[var(--muted)]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
