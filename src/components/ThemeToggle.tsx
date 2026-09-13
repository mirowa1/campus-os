"use client";

import { useEffect, useState } from "react";

export const THEME_KEY = "cm_theme";
export type ThemeMode = "light" | "dark";

export function getStoredTheme(): ThemeMode {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: ThemeMode) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5z" />
    </svg>
  );
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  function toggle() {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className={`btn btn-ghost inline-flex h-9 w-9 items-center justify-center !px-0 ${className}`}
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? (
        <SunIcon className="h-4 w-4" />
      ) : (
        <MoonIcon className="h-4 w-4" />
      )}
    </button>
  );
}
