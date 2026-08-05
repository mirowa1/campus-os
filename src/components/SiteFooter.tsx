import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--line)]">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-[var(--muted)]">
        <p>© {new Date().getFullYear()} Coursework by CoreMax</p>
        <nav className="flex gap-4">
          <Link href="/privacy" className="hover:text-[var(--ink)]">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-[var(--ink)]">
            Terms of Service
          </Link>
        </nav>
      </div>
    </footer>
  );
}
