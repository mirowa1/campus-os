"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { AssistantWidget } from "@/components/AssistantWidget";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { createClient } from "@/lib/supabase/client";

type NavItem = {
  href: string;
  label: string;
  weight: "hero" | "secondary";
  icon?: (props: { className?: string }) => ReactNode;
};

function iconProps(className?: string) {
  return {
    className,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.75,
    "aria-hidden": true as const,
  };
}

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M4 4h7v7H4V4Zm9 0h7v5h-7V4ZM4 13h7v7H4v-7Zm9 3h7v4h-7v-4Z" />
    </svg>
  );
}

function ClassesIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M4 19V6.5A1.5 1.5 0 0 1 5.5 5H14v14H5.5A1.5 1.5 0 0 1 4 17.5" />
      <path d="M14 5h4.5A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5H14" />
      <path d="M8 9h3M8 12h3" />
    </svg>
  );
}

function AssessmentsIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M8 4h8a2 2 0 0 1 2 2v14l-6-3-6 3V6a2 2 0 0 1 2-2Z" />
      <path d="M9.5 10h5M9.5 13h5" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PRIMARY: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", weight: "hero", icon: DashboardIcon },
  { href: "/classes", label: "Classes", weight: "hero", icon: ClassesIcon },
  { href: "/assessments", label: "Assessments", weight: "hero", icon: AssessmentsIcon },
  { href: "/grades", label: "Grades", weight: "secondary" },
];

const MORE = [
  { href: "/calendar", label: "Calendar" },
  { href: "/classtoexcel", label: "ClassToExcel" },
  { href: "/resume", label: "Resume" },
  { href: "/settings", label: "Settings" },
] as const;

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function linkClass(active: boolean, weight: "hero" | "secondary") {
  const parts = ["app-nav-link"];
  parts.push(weight === "hero" ? "app-nav-link--hero" : "app-nav-link--secondary");
  if (active) {
    parts.push(weight === "hero" ? "app-nav-link--active" : "app-nav-link--active-quiet");
  }
  return parts.join(" ");
}

function MoreMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const moreActive = MORE.some((item) => isActivePath(pathname, item.href));

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown);
    }, 0);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function onMenuKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (!open) return;
    const items = rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    if (!items?.length) return;
    const list = [...items];
    const idx = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        if (idx <= 0) triggerRef.current?.focus();
        else list[idx - 1]?.focus();
      } else if (idx < 0) list[0]?.focus();
      else if (idx >= list.length - 1) triggerRef.current?.focus();
      else list[idx + 1]?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      list[(idx < 0 ? 0 : idx + 1) % list.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[idx <= 0 ? list.length - 1 : idx - 1]?.focus();
    }
  }

  return (
    <div className="app-nav-more" ref={rootRef} onKeyDown={onMenuKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className={[
          "app-nav-link",
          "app-nav-link--secondary",
          moreActive ? "app-nav-link--more-active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        More
        {moreActive && <span className="app-nav-more-dot" aria-hidden />}
        <ChevronIcon
          className={`app-nav-caret${open ? " app-nav-caret--open" : ""}`}
        />
      </button>
      {open && (
        <div id={menuId} role="menu" className="app-nav-menu">
          {MORE.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                tabIndex={0}
                className={`app-nav-menu-item${active ? " app-nav-menu-item--active" : ""}`}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PrimaryLinks({ pathname }: { pathname: string }) {
  return (
    <>
      {PRIMARY.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} className={linkClass(active, item.weight)}>
            {Icon && <Icon className="app-nav-icon" />}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}

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
    <header className="app-nav-header relative z-40 border-b border-[var(--line)]">
      {/* Row 1: brand + actions — never shares horizontal space with nav links */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Logo href="/dashboard" size="sm" rotated={false} withByline={false} />
        <div className="relative z-10 flex shrink-0 items-center gap-3">
          <ThemeToggle />
          {email && (
            <Link
              href="/profile"
              className="hidden max-w-[9rem] truncate text-xs text-[var(--muted)] hover:text-[var(--ink)] lg:inline"
              title={email}
            >
              {email}
            </Link>
          )}
          <Link href="/profile" className="btn btn-ghost text-xs md:hidden">
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

      {/* Row 2 desktop */}
      <nav
        className="app-nav-row mx-auto hidden max-w-6xl items-center gap-1 overflow-visible px-6 pb-3 sm:flex"
        aria-label="Main"
      >
        <PrimaryLinks pathname={pathname} />
        <MoreMenu pathname={pathname} />
      </nav>

      {/* Row 2 mobile — overflow only around primary; More outside scroll */}
      <nav
        className="app-nav-row flex items-center gap-1 overflow-visible px-6 pb-3 sm:hidden"
        aria-label="Main"
      >
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          <PrimaryLinks pathname={pathname} />
        </div>
        <MoreMenu pathname={pathname} />
      </nav>

      <AssistantWidget />
    </header>
  );
}
