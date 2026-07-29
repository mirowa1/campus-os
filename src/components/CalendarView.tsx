"use client";

import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { AssessmentRow, ClassRow } from "@/lib/types";

export type CalendarEvent = AssessmentRow & {
  className: string;
  classId: string;
};

type Props = {
  events: CalendarEvent[];
  initialView?: "week" | "month";
};

export function CalendarView({ events, initialView = "month" }: Props) {
  const [view, setView] = useState<"week" | "month">(initialView);
  const [cursor, setCursor] = useState(new Date());

  const days = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(cursor);
      const end = endOfWeek(cursor);
      return eachDayOfInterval({ start, end });
    }
    const start = startOfWeek(startOfMonth(cursor));
    const end = endOfWeek(endOfMonth(cursor));
    return eachDayOfInterval({ start, end });
  }, [cursor, view]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      if (!e.due_date) continue;
      const key = e.due_date.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [events]);

  function shift(dir: -1 | 1) {
    if (view === "week") setCursor((d) => addDays(d, dir * 7));
    else
      setCursor(
        (d) => new Date(d.getFullYear(), d.getMonth() + dir, 1)
      );
  }

  return (
    <div className="surface rounded-2xl p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">
            {view === "month"
              ? format(cursor, "MMMM yyyy")
              : `Week of ${format(startOfWeek(cursor), "MMM d")}`}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-ghost text-xs" onClick={() => shift(-1)}>
            Prev
          </button>
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={() => setCursor(new Date())}
          >
            Today
          </button>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => shift(1)}>
            Next
          </button>
          <div className="ml-2 flex rounded-lg border border-[var(--line)] p-0.5">
            {(["week", "month"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1 text-xs capitalize ${
                  view === v
                    ? "bg-[var(--bg-soft)] text-[var(--ink)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-[var(--muted)]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = byDay.get(key) ?? [];
          const inMonth = view === "week" || isSameMonth(day, cursor);
          return (
            <div
              key={key}
              className={`min-h-[5.5rem] rounded-lg border border-[var(--line)] p-1.5 ${
                isSameDay(day, new Date())
                  ? "bg-[var(--accent)]/10"
                  : "bg-[var(--bg)]/40"
              } ${inMonth ? "" : "opacity-40"}`}
            >
              <p className="text-xs text-[var(--muted)]">{format(day, "d")}</p>
              <ul className="mt-1 space-y-0.5">
                {dayEvents.slice(0, view === "week" ? 4 : 2).map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/classes/${e.classId}`}
                      className="block truncate rounded px-1 py-0.5 text-[10px] leading-tight bg-[var(--bg-soft)] hover:bg-[var(--accent)]/20"
                      title={`${e.title} · ${e.className}`}
                    >
                      {e.title}
                    </Link>
                  </li>
                ))}
                {dayEvents.length > (view === "week" ? 4 : 2) && (
                  <li className="px-1 text-[10px] text-[var(--muted)]">
                    +{dayEvents.length - (view === "week" ? 4 : 2)} more
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function buildCalendarEvents(
  classes: (ClassRow & { assessments: AssessmentRow[] })[]
): CalendarEvent[] {
  return classes.flatMap((c) =>
    c.assessments.map((a) => ({
      ...a,
      className: c.code || c.name,
      classId: c.id,
    }))
  );
}
