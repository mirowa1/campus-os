"use client";

import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  AssessmentRow,
  CalendarEventRow,
  ClassRow,
} from "@/lib/types";

/** Assessment-backed calendar chip (from syllabus). Not editable here. */
export type AssessmentCalItem = {
  kind: "assessment";
  id: string;
  title: string;
  date: string;
  classId: string;
  classLabel: string;
  type: AssessmentRow["type"];
};

/** Personal reminder/task. Editable/deletable from calendar. */
export type PersonalCalItem = {
  kind: "personal";
  id: string;
  title: string;
  date: string;
  classId: string | null;
  classLabel: string | null;
  userId: string;
};

/** Recurring class meeting time (from syllabus). */
export type MeetingCalItem = {
  kind: "meeting";
  id: string;
  title: string;
  date: string;
  classId: string;
  classLabel: string;
  startTime: string;
  endTime: string;
  location: string | null;
};

export type UnifiedCalItem =
  | AssessmentCalItem
  | PersonalCalItem
  | MeetingCalItem;

type Props = {
  assessments: AssessmentCalItem[];
  personalEvents: PersonalCalItem[];
  meetingEvents?: MeetingCalItem[];
  classes: ClassRow[];
  initialView?: "week" | "month";
};

type FormState = {
  mode: "create" | "edit";
  id: string | null;
  title: string;
  date: string;
};

function emptyForm(date: string): FormState {
  return { mode: "create", id: null, title: "", date };
}

/** Prefer earliest dated item on/after today; else earliest overall; else now. */
function initialCursorFromItems(
  assessments: AssessmentCalItem[],
  personalEvents: PersonalCalItem[],
  meetingEvents: MeetingCalItem[] = []
): Date {
  const today = startOfDay(new Date());
  const dates = [...assessments, ...personalEvents, ...meetingEvents]
    .map((e) => e.date?.slice(0, 10))
    .filter((d): d is string => Boolean(d))
    .map((d) => startOfDay(parseISO(d)))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length === 0) return new Date();
  const upcoming = dates.find((d) => d.getTime() >= today.getTime());
  return upcoming ?? dates[0];
}

function earliestAssessmentOutsideVisible(
  assessments: AssessmentCalItem[],
  visibleKeys: Set<string>
): { date: Date; label: string } | null {
  const outside = assessments
    .map((a) => a.date?.slice(0, 10))
    .filter((d): d is string => Boolean(d) && !visibleKeys.has(d))
    .sort();
  if (outside.length === 0) return null;
  const d = parseISO(outside[0]);
  if (Number.isNaN(d.getTime())) return null;
  return { date: d, label: format(d, "MMM yyyy") };
}

/** Prefer earliest on/after today; else earliest overall. */
function nearestDate(dates: Date[]): Date | null {
  if (dates.length === 0) return null;
  const today = startOfDay(new Date());
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  return sorted.find((d) => d.getTime() >= today.getTime()) ?? sorted[0];
}

type NewDatesNotice = {
  monthLabel: string;
  jumpDate: Date;
  extraMonthCount: number;
};

function noticeForNewOutOfViewDates(
  newAssessments: AssessmentCalItem[],
  visibleStart: Date,
  visibleEnd: Date
): NewDatesNotice | null {
  const outOfViewDates: Date[] = [];
  for (const a of newAssessments) {
    if (!a.date) continue;
    const d = startOfDay(parseISO(a.date.slice(0, 10)));
    if (Number.isNaN(d.getTime())) continue;
    if (d < visibleStart || d > visibleEnd) outOfViewDates.push(d);
  }
  const jumpDate = nearestDate(outOfViewDates);
  if (!jumpDate) return null;

  const months = new Set(outOfViewDates.map((d) => format(d, "yyyy-MM")));
  const monthLabel = format(jumpDate, "MMMM yyyy");
  const extraMonthCount = Math.max(0, months.size - 1);

  return { monthLabel, jumpDate, extraMonthCount };
}

type CalItemVariant = "grid" | "modal";

function kindLabel(e: UnifiedCalItem): string {
  if (e.kind === "assessment") {
    if (e.type === "exam") return "Exam";
    if (e.type === "quiz") return "Quiz";
    if (e.type === "other") return "Other";
    return "Assignment";
  }
  if (e.kind === "meeting") return "Class meeting";
  return "Event";
}

function renderCalItem(
  e: UnifiedCalItem,
  variant: CalItemVariant,
  onEditPersonal: (item: PersonalCalItem) => void
) {
  const compact = variant === "grid";
  const textSize = compact ? "text-[10px]" : "text-sm";
  const metaSize = compact ? "text-[9px]" : "text-xs";

  if (e.kind === "assessment") {
    return (
      <Link
        href={`/classes/${e.classId}`}
        onClick={(ev) => ev.stopPropagation()}
        className={`block truncate rounded px-1 py-0.5 leading-tight bg-[var(--bg-soft)] hover:bg-[var(--accent)]/20 ${textSize} ${
          compact ? "" : "p-2"
        }`}
        title={`${e.title} · ${e.classLabel} · ${e.type}`}
      >
        {!compact && (
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
            {kindLabel(e)}
          </span>
        )}
        <span className="font-medium">{e.title}</span>
        <span className={`mt-0.5 block truncate text-[var(--muted)] ${metaSize}`}>
          {e.classLabel}
        </span>
      </Link>
    );
  }

  if (e.kind === "meeting") {
    return (
      <Link
        href={`/classes/${e.classId}`}
        onClick={(ev) => ev.stopPropagation()}
        className={`block truncate rounded border border-dashed border-[var(--accent)]/50 bg-transparent px-1 py-0.5 leading-tight hover:bg-[var(--accent)]/10 ${textSize} ${
          compact ? "" : "p-2"
        }`}
        title={`${e.classLabel} · ${e.title}${e.location ? ` · ${e.location}` : ""}`}
      >
        {!compact && (
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--accent)]">
            {kindLabel(e)}
          </span>
        )}
        <span className="font-medium text-[var(--accent)]">{e.classLabel}</span>
        <span className={`mt-0.5 block truncate text-[var(--muted)] ${metaSize}`}>
          {e.title}
        </span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={(ev) => {
        ev.stopPropagation();
        onEditPersonal(e);
      }}
      className={`block w-full truncate rounded px-1 py-0.5 text-left leading-tight bg-[var(--accent)]/15 hover:bg-[var(--accent)]/25 ${textSize} ${
        compact ? "" : "p-2"
      }`}
      title={e.classLabel ? `${e.title} · ${e.classLabel}` : e.title}
    >
      {!compact && (
        <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
          {kindLabel(e)}
        </span>
      )}
      <span className="font-medium">{e.title}</span>
      {e.classLabel && (
        <span className={`mt-0.5 block truncate text-[var(--muted)] ${metaSize}`}>
          {e.classLabel}
        </span>
      )}
    </button>
  );
}

export function CalendarView({
  assessments,
  personalEvents,
  meetingEvents = [],
  classes,
  initialView = "month",
}: Props) {
  const router = useRouter();
  const [view, setView] = useState<"week" | "month">(initialView);
  const [cursor, setCursor] = useState(() =>
    initialCursorFromItems(assessments, personalEvents, meetingEvents)
  );
  const [items, setItems] = useState<UnifiedCalItem[]>(() => [
    ...assessments,
    ...personalEvents,
    ...meetingEvents,
  ]);
  const [form, setForm] = useState<FormState | null>(null);
  const [dayView, setDayView] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newDatesNotice, setNewDatesNotice] = useState<NewDatesNotice | null>(
    null
  );
  /** null = first effect run (mount); then tracks prior assessment ids. */
  const prevAssessmentIdsRef = useRef<Set<string> | null>(null);

  // Soft sync when SSR props change (e.g. after syllabus parse + navigate/refresh).
  useEffect(() => {
    setItems([...assessments, ...personalEvents, ...meetingEvents]);
  }, [assessments, personalEvents, meetingEvents]);

  // First-ever syllabus data may jump once; subsequent uploads never auto-jump —
  // show a clickable notice when new dates land outside the current viewport.
  useEffect(() => {
    const nextIds = new Set(assessments.map((a) => a.id));
    const prev = prevAssessmentIdsRef.current;
    prevAssessmentIdsRef.current = nextIds;

    // First mount: initializer already seeded cursor — do not jump.
    if (prev === null) return;

    const added = assessments.filter((a) => !prev.has(a.id) && a.date);
    if (added.length === 0) return;

    // True first syllabus data while mounted on an empty calendar.
    if (prev.size === 0) {
      setCursor(initialCursorFromItems(assessments, personalEvents, meetingEvents));
      setNewDatesNotice(null);
      return;
    }

    // Subsequent uploads: preserve viewport; notify if new dates are out of view.
    const visibleStart =
      view === "week" ? startOfWeek(cursor) : startOfMonth(cursor);
    const visibleEnd =
      view === "week" ? endOfWeek(cursor) : endOfMonth(cursor);
    const notice = noticeForNewOutOfViewDates(
      added,
      visibleStart,
      visibleEnd
    );
    if (notice) setNewDatesNotice(notice);
    // Intentionally omit cursor/view from deps — use values at prop-change time only.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- preserve user viewport on syllabus refresh
  }, [assessments, personalEvents]);

  useEffect(() => {
    if (!dayView) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDayView(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dayView]);

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
    const map = new Map<string, UnifiedCalItem[]>();
    for (const e of items) {
      if (!e.date) continue;
      const key = e.date.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [items]);

  const visibleKeys = useMemo(
    () => new Set(days.map((d) => format(d, "yyyy-MM-dd"))),
    [days]
  );

  const visibleItemCount = useMemo(() => {
    let n = 0;
    for (const key of Array.from(visibleKeys)) {
      n += byDay.get(key)?.length ?? 0;
    }
    return n;
  }, [byDay, visibleKeys]);

  const jumpTarget = useMemo(() => {
    if (visibleItemCount > 0) return null;
    if (assessments.length === 0) return null;
    return earliestAssessmentOutsideVisible(assessments, visibleKeys);
  }, [assessments, visibleItemCount, visibleKeys]);

  function shift(dir: -1 | 1) {
    if (view === "week") setCursor((d) => addDays(d, dir * 7));
    else
      setCursor((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
  }

  function openCreate(date?: string) {
    setError(null);
    setForm(emptyForm(date || format(new Date(), "yyyy-MM-dd")));
  }

  function openDayView(dateKey: string) {
    setDayView(dateKey);
  }

  function closeDayView() {
    setDayView(null);
  }

  function openCreateForDay(dateKey: string) {
    closeDayView();
    openCreate(dateKey);
  }

  function openEditFromDay(item: PersonalCalItem) {
    closeDayView();
    openEdit(item);
  }

  function openEdit(item: PersonalCalItem) {
    setError(null);
    setForm({
      mode: "edit",
      id: item.id,
      title: item.title,
      date: item.date.slice(0, 10),
    });
  }

  function closeForm() {
    setForm(null);
    setError(null);
  }

  function classLabelFor(classId: string | null): string | null {
    if (!classId) return null;
    const c = classes.find((x) => x.id === classId);
    if (!c) return null;
    return c.code || c.name;
  }

  async function saveForm() {
    if (!form) return;
    const title = form.title.trim();
    if (!title) {
      setError("Title is required.");
      return;
    }
    if (!form.date) {
      setError("Date is required.");
      return;
    }

    setSaving(true);
    setError(null);
    const supabase = createClient();
    try {
      if (form.mode === "create") {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not signed in");

        const { data, error: insertError } = await supabase
          .from("calendar_events")
          .insert({
            user_id: user.id,
            title,
            event_date: form.date,
            class_id: null,
          })
          .select()
          .single();

        if (insertError || !data) {
          throw new Error(insertError?.message || "Failed to create event");
        }

        const row = data as CalendarEventRow;
        const next: PersonalCalItem = {
          kind: "personal",
          id: row.id,
          title: row.title,
          date: row.event_date,
          classId: row.class_id,
          classLabel: classLabelFor(row.class_id),
          userId: row.user_id,
        };
        setItems((prev) => [...prev, next]);
      } else if (form.id) {
        const { data, error: updateError } = await supabase
          .from("calendar_events")
          .update({
            title,
            event_date: form.date,
            class_id: null,
          })
          .eq("id", form.id)
          .select()
          .single();

        if (updateError || !data) {
          throw new Error(updateError?.message || "Failed to update event");
        }

        const row = data as CalendarEventRow;
        setItems((prev) =>
          prev.map((it) =>
            it.kind === "personal" && it.id === row.id
              ? {
                  ...it,
                  title: row.title,
                  date: row.event_date,
                  classId: row.class_id,
                  classLabel: classLabelFor(row.class_id),
                }
              : it
          )
        );
      }

      closeForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent() {
    if (!form?.id || form.mode !== "edit") return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    try {
      const { error: delError } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", form.id);
      if (delError) throw new Error(delError.message);
      const deletedId = form.id;
      setItems((prev) =>
        prev.filter((it) => !(it.kind === "personal" && it.id === deletedId))
      );
      closeForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  const limit = view === "week" ? 4 : 2;
  const dayViewEvents = dayView ? (byDay.get(dayView) ?? []) : [];

  return (
    <div className="surface rounded-2xl p-6 md:p-7">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl">
            {view === "month"
              ? format(cursor, "MMMM yyyy")
              : `Week of ${format(startOfWeek(cursor), "MMM d")}`}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-primary text-xs"
            onClick={() => openCreate()}
          >
            + Add event
          </button>
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={() => shift(-1)}
          >
            Prev
          </button>
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={() => setCursor(new Date())}
          >
            Today
          </button>
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={() => shift(1)}
          >
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

      {newDatesNotice && (
        <div
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3 text-sm"
          role="status"
        >
          <p className="text-[var(--ink)]">
            New dates added to {newDatesNotice.monthLabel}
            {newDatesNotice.extraMonthCount > 0
              ? ` (+${newDatesNotice.extraMonthCount} more month${
                  newDatesNotice.extraMonthCount === 1 ? "" : "s"
                })`
              : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-ghost text-xs"
              onClick={() => {
                setCursor(newDatesNotice.jumpDate);
                setNewDatesNotice(null);
              }}
            >
              Show {format(newDatesNotice.jumpDate, "MMM yyyy")}
            </button>
            <button
              type="button"
              className="btn btn-ghost text-xs"
              onClick={() => setNewDatesNotice(null)}
              aria-label="Dismiss"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {jumpTarget && !newDatesNotice && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg-soft)] px-4 py-3 text-sm">
          <p className="text-[var(--muted)]">
            Syllabus dates are in {jumpTarget.label} — nothing in this{" "}
            {view === "week" ? "week" : "month"}.
          </p>
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={() => setCursor(jumpTarget.date)}
          >
            Jump to {jumpTarget.label}
          </button>
        </div>
      )}

      {form && (
        <div className="mb-4 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-4">
          <p className="font-medium">
            {form.mode === "create" ? "Add event" : "Edit event"}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="cal-title">
                Title
              </label>
              <input
                id="cal-title"
                className="input"
                autoFocus
                value={form.title}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, title: e.target.value } : f))
                }
                placeholder="Study session, office hours…"
              />
            </div>
            <div>
              <label className="label" htmlFor="cal-date">
                Date
              </label>
              <input
                id="cal-date"
                type="date"
                className="input"
                value={form.date}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, date: e.target.value } : f))
                }
              />
            </div>

          </div>
          {error && (
            <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary text-xs"
              disabled={saving}
              onClick={() => void saveForm()}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="btn btn-ghost text-xs"
              disabled={saving}
              onClick={closeForm}
            >
              Cancel
            </button>
            {form.mode === "edit" && (
              <button
                type="button"
                className="btn btn-ghost text-xs text-[var(--danger)]"
                disabled={saving}
                onClick={() => void deleteEvent()}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}

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
              role="button"
              tabIndex={0}
              onClick={() => openDayView(key)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openDayView(key);
                }
              }}
              className={`min-h-[5.5rem] cursor-pointer rounded-lg border border-[var(--line)] p-1.5 text-left transition hover:border-[var(--accent)]/40 ${
                isSameDay(day, new Date())
                  ? "bg-[var(--accent)]/10"
                  : "bg-[var(--bg)]/40"
              } ${inMonth ? "" : "opacity-40"}`}
            >
              <p className="text-xs text-[var(--muted)]">{format(day, "d")}</p>
              <ul className="mt-1 space-y-0.5">
                {dayEvents.slice(0, limit).map((e) => (
                  <li key={`${e.kind}-${e.id}`}>
                    {renderCalItem(e, "grid", openEditFromDay)}
                  </li>
                ))}
                {dayEvents.length > limit && (
                  <li>
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        openDayView(key);
                      }}
                      className="px-1 text-[10px] text-[var(--muted)] hover:text-[var(--ink)]"
                    >
                      +{dayEvents.length - limit} more
                    </button>
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>

      {dayView && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="day-view-title"
          onClick={closeDayView}
        >
          <div
            className="surface max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl shadow-xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="border-b border-[var(--line)] px-5 py-4">
              <h3 id="day-view-title" className="font-heading text-xl">
                {format(parseISO(dayView), "EEEE, MMMM d, yyyy")}
              </h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {dayViewEvents.length === 0
                  ? "Nothing scheduled this day."
                  : `${dayViewEvents.length} item${
                      dayViewEvents.length === 1 ? "" : "s"
                    }`}
              </p>
            </div>

            <ul className="max-h-[50vh] space-y-2 overflow-y-auto px-5 py-4">
              {dayViewEvents.map((e) => (
                <li key={`${e.kind}-${e.id}`}>
                  {renderCalItem(e, "modal", openEditFromDay)}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-2 border-t border-[var(--line)] px-5 py-4">
              <button
                type="button"
                className="btn btn-primary text-xs"
                onClick={() => openCreateForDay(dayView)}
              >
                + Add event
              </button>
              <button
                type="button"
                className="btn btn-ghost text-xs"
                onClick={closeDayView}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** @deprecated Prefer building AssessmentCalItem on the server page. */
export function buildCalendarEvents(
  classList: (ClassRow & { assessments: AssessmentRow[] })[]
): AssessmentCalItem[] {
  return classList.flatMap((c) =>
    c.assessments
      .filter((a) => a.due_date)
      .map((a) => ({
        kind: "assessment" as const,
        id: a.id,
        title: a.title,
        date: a.due_date!,
        classId: c.id,
        classLabel: c.code || c.name,
        type: a.type,
      }))
  );
}

/** Legacy alias kept for any old imports. */
export type CalendarEvent = AssessmentRow & {
  className: string;
  classId: string;
};
