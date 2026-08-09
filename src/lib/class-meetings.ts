import type { ClassMeetingRow, ClassRow } from "@/lib/types";

export type MeetingCalOccurrence = {
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

/** Expand recurring meetings into dated calendar chips for a visible range. */
export function expandMeetingsToCalItems(
  meetings: ClassMeetingRow[],
  classById: Map<string, ClassRow>,
  rangeStart: Date,
  rangeEnd: Date
): MeetingCalOccurrence[] {
  const out: MeetingCalOccurrence[] = [];

  const cursor = new Date(rangeStart);
  cursor.setHours(12, 0, 0, 0);
  const end = new Date(rangeEnd);
  end.setHours(12, 0, 0, 0);

  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);
    const dow = cursor.getDay();
    for (const m of meetings) {
      if (m.day_of_week !== dow) continue;
      if (m.term_start_date && iso < m.term_start_date) continue;
      if (m.term_end_date && iso > m.term_end_date) continue;
      const c = classById.get(m.class_id);
      const label = c ? c.code || c.name : "Class";
      const timeLabel = `${m.start_time.slice(0, 5)}–${m.end_time.slice(0, 5)}`;
      out.push({
        kind: "meeting",
        id: `${m.id}-${iso}`,
        title: timeLabel,
        date: iso,
        classId: m.class_id,
        classLabel: label,
        startTime: m.start_time,
        endTime: m.end_time,
        location: m.location,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
