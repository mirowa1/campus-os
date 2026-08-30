import ExcelJS from "exceljs";
import { format, parseISO } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseSyllabusWithClaude } from "@/lib/claude";
import { extractSyllabusContent } from "@/lib/extract";
import type {
  AssessmentRow,
  ClassMeetingRow,
  ClassRow,
  ParsedClassMeeting,
  ParsedSyllabus,
} from "@/lib/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function formatTime(value: string): string {
  return value.slice(0, 5);
}

function formatShortDate(value: string | null): string {
  if (!value) return "";
  try {
    return format(parseISO(value), "MMM d");
  } catch {
    return value;
  }
}

function formatDateRange(
  start: string | null,
  end: string | null
): string {
  const startLabel = formatShortDate(start);
  const endLabel = formatShortDate(end);
  if (startLabel && endLabel) return `${startLabel}–${endLabel}`;
  return startLabel || endLabel;
}

function classLabel(row: Pick<ClassRow, "code" | "name">): string {
  return [row.code, row.name].filter(Boolean).join(" — ") || row.name;
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 40);
}

function styleHeaderRow(sheet: ExcelJS.Worksheet, columnCount: number) {
  const row = sheet.getRow(1);
  row.font = { bold: true };
  for (let i = 1; i <= columnCount; i++) {
    sheet.getColumn(i).width = 18;
  }
}

type AssessmentCfLayout = {
  ref: string;
  dueDateCol: string;
  scoreCol: string;
  titleCol: string;
  firstDataRow: number;
};

const CF_COLORS = {
  gray: "FFD9D9D9",
  red: "FFF4A6A6",
  yellow: "FFFDE9A0",
  green: "FFC6E8B5",
} as const;

function dueDateCellValue(dueDate: string | null): Date | "" {
  if (!dueDate) return "";
  try {
    return parseISO(dueDate);
  } catch {
    return "";
  }
}

function fillPattern(argb: string): ExcelJS.Fill {
  const color = { argb };
  return {
    type: "pattern",
    pattern: "solid",
    fgColor: color,
    bgColor: color,
  };
}

function addAssessmentLegend(sheet: ExcelJS.Worksheet, legendCol: number) {
  const entries: [number, string, boolean?][] = [
    [1, "Color key", true],
    [2, "Gray — Completed (score entered)"],
    [3, "Red — Overdue"],
    [4, "Yellow — Due within 7 days"],
    [5, "Green — Upcoming"],
  ];
  for (const [row, text, bold] of entries) {
    const cell = sheet.getCell(row, legendCol);
    cell.value = text;
    if (bold) cell.font = { bold: true };
  }
  sheet.getColumn(legendCol).width = 28;
}

function applyAssessmentConditionalFormatting(
  sheet: ExcelJS.Worksheet,
  layout: AssessmentCfLayout
) {
  const row = layout.firstDataRow;
  const t = layout.titleCol;
  const d = layout.dueDateCol;
  const s = layout.scoreCol;
  const guard = `$${t}${row}<>"No data"`;

  sheet.addConditionalFormatting({
    ref: layout.ref,
    rules: [
      {
        type: "expression",
        priority: 1,
        formulae: [`AND(${guard},$${s}${row}<>"")`],
        style: { fill: fillPattern(CF_COLORS.gray) },
      },
      {
        type: "expression",
        priority: 2,
        formulae: [
          `AND(${guard},$${s}${row}="",$${d}${row}<>"",$${d}${row}<TODAY())`,
        ],
        style: { fill: fillPattern(CF_COLORS.red) },
      },
      {
        type: "expression",
        priority: 3,
        formulae: [
          `AND(${guard},$${s}${row}="",$${d}${row}<>"",$${d}${row}>=TODAY(),$${d}${row}<=TODAY()+7)`,
        ],
        style: { fill: fillPattern(CF_COLORS.yellow) },
      },
      {
        type: "expression",
        priority: 4,
        formulae: [
          `AND(${guard},$${s}${row}="",$${d}${row}<>"",$${d}${row}>TODAY()+7)`,
        ],
        style: { fill: fillPattern(CF_COLORS.green) },
      },
    ],
  });
}

function finishAssessmentSheet(
  sheet: ExcelJS.Worksheet,
  columnCount: number,
  dueDateColIndex: number,
  cf: AssessmentCfLayout | null,
  legendCol: number
) {
  styleHeaderRow(sheet, columnCount);
  sheet.getColumn(dueDateColIndex).numFmt = "mmm d, yyyy";
  addAssessmentLegend(sheet, legendCol);
  if (cf) {
    applyAssessmentConditionalFormatting(sheet, cf);
  }
}

function groupMeetingsForDisplay(
  meetings: ClassMeetingRow[] | ParsedClassMeeting[]
): string[] {
  const groups = new Map<string, number[]>();

  for (const meeting of meetings) {
    const key = [
      meeting.start_time,
      meeting.end_time,
      meeting.location ?? "",
      meeting.term_start_date ?? "",
      meeting.term_end_date ?? "",
    ].join("|");
    const days = groups.get(key) ?? [];
    days.push(meeting.day_of_week);
    groups.set(key, days);
  }

  return Array.from(groups.entries()).map(([key, days]) => {
    const [startTime, endTime, location, termStart, termEnd] = key.split("|");
    const dayStr = Array.from(new Set(days))
      .sort((a, b) => a - b)
      .map((day) => DAY_LABELS[day] ?? String(day))
      .join("/");
    const parts = [`${dayStr}, ${formatTime(startTime)}–${formatTime(endTime)}`];
    if (location) parts.push(location);
    const dateRange = formatDateRange(
      termStart || null,
      termEnd || null
    );
    if (dateRange) parts.push(dateRange);
    return parts.join(", ");
  });
}

function populateUploadWorkbook(
  workbook: ExcelJS.Workbook,
  parsed: ParsedSyllabus
) {
  const courseSheet = workbook.addWorksheet("Course");
  courseSheet.addRow(["Name", "Code", "Term"]);
  courseSheet.addRow([parsed.name, parsed.code ?? "", parsed.term ?? ""]);
  styleHeaderRow(courseSheet, 3);

  const assessmentsSheet = workbook.addWorksheet("Assessments");
  assessmentsSheet.addRow([
    "Title",
    "Type",
    "Due Date",
    "Weight %",
    "Score",
  ]);
  if (parsed.assessments.length === 0) {
    assessmentsSheet.addRow(["No data", "", "", "", ""]);
    finishAssessmentSheet(assessmentsSheet, 5, 3, null, 7);
  } else {
    for (const assessment of parsed.assessments) {
      assessmentsSheet.addRow([
        assessment.title,
        assessment.type,
        dueDateCellValue(assessment.due_date),
        assessment.weight_percent,
        "",
      ]);
    }
    const lastRow = parsed.assessments.length + 1;
    finishAssessmentSheet(assessmentsSheet, 5, 3, {
      ref: `A2:E${lastRow}`,
      dueDateCol: "C",
      scoreCol: "E",
      titleCol: "A",
      firstDataRow: 2,
    }, 7);
  }

  const scheduleSheet = workbook.addWorksheet("Schedule");
  scheduleSheet.addRow(["Schedule"]);
  const scheduleEntries = groupMeetingsForDisplay(parsed.meetings ?? []);
  if (scheduleEntries.length === 0) {
    scheduleSheet.addRow(["No data"]);
  } else {
    for (const entry of scheduleEntries) {
      scheduleSheet.addRow([entry]);
    }
  }
  styleHeaderRow(scheduleSheet, 1);
}

function populateClassesWorkbook(
  workbook: ExcelJS.Workbook,
  classes: ClassRow[],
  assessments: AssessmentRow[],
  meetings: ClassMeetingRow[]
) {
  const courseSheet = workbook.addWorksheet("Course");
  courseSheet.addRow(["Class", "Name", "Code", "Term"]);
  for (const cls of classes) {
    courseSheet.addRow([
      classLabel(cls),
      cls.name,
      cls.code ?? "",
      cls.term ?? "",
    ]);
  }
  styleHeaderRow(courseSheet, 4);

  const assessmentsSheet = workbook.addWorksheet("Assessments");
  assessmentsSheet.addRow([
    "Class",
    "Title",
    "Type",
    "Due Date",
    "Weight %",
    "Score",
    "Max Score",
  ]);

  let dataRowCount = 0;

  for (const cls of classes) {
    const label = classLabel(cls);
    const classAssessments = assessments.filter((a) => a.class_id === cls.id);
    if (classAssessments.length === 0) {
      assessmentsSheet.addRow([label, "No data", "", "", "", "", ""]);
      continue;
    }
    for (const assessment of classAssessments) {
      assessmentsSheet.addRow([
        label,
        assessment.title,
        assessment.type,
        dueDateCellValue(assessment.due_date),
        assessment.weight_percent,
        assessment.score ?? "",
        assessment.max_score,
      ]);
      dataRowCount++;
    }
  }

  const cf =
    dataRowCount > 0
      ? {
          ref: `A2:G${assessmentsSheet.rowCount}`,
          dueDateCol: "D",
          scoreCol: "F",
          titleCol: "B",
          firstDataRow: 2,
        }
      : null;
  finishAssessmentSheet(assessmentsSheet, 7, 4, cf, 9);

  const scheduleSheet = workbook.addWorksheet("Schedule");
  scheduleSheet.addRow(["Class", "Schedule"]);

  for (const cls of classes) {
    const label = classLabel(cls);
    const classMeetings = meetings.filter((m) => m.class_id === cls.id);
    const entries = groupMeetingsForDisplay(classMeetings);
    if (entries.length === 0) {
      scheduleSheet.addRow([label, "No data"]);
      continue;
    }
    for (const entry of entries) {
      scheduleSheet.addRow([label, entry]);
    }
  }
  styleHeaderRow(scheduleSheet, 2);
}

export async function buildWorkbookFromFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<{ workbook: ExcelJS.Workbook; downloadName: string }> {
  const extracted = await extractSyllabusContent(buffer, mimeType, fileName);
  const parsed =
    extracted.kind === "image"
      ? await parseSyllabusWithClaude({
          imageBase64: extracted.base64,
          mediaType: extracted.mediaType,
        })
      : await parseSyllabusWithClaude({ text: extracted.text });

  const workbook = new ExcelJS.Workbook();
  populateUploadWorkbook(workbook, parsed);
  const slug = sanitizeFileName(parsed.code || parsed.name || "class");
  return { workbook, downloadName: `${slug || "class"}-export.xlsx` };
}

export async function buildWorkbookFromClasses(
  supabase: SupabaseClient,
  userId: string,
  classIds: string[]
): Promise<{ workbook: ExcelJS.Workbook; downloadName: string }> {
  const { data: classes, error } = await supabase
    .from("classes")
    .select("*")
    .eq("user_id", userId)
    .in("id", classIds);

  if (error) throw error;

  const ordered = classIds
    .map((id) => (classes ?? []).find((row) => row.id === id))
    .filter(Boolean) as ClassRow[];

  if (ordered.length !== classIds.length) {
    throw new Error("One or more classes not found");
  }

  const ids = ordered.map((row) => row.id);
  const [{ data: assessments }, { data: meetings }] = await Promise.all([
    supabase.from("assessments").select("*").in("class_id", ids),
    supabase.from("class_meetings").select("*").in("class_id", ids),
  ]);

  const workbook = new ExcelJS.Workbook();
  populateClassesWorkbook(
    workbook,
    ordered,
    (assessments ?? []) as AssessmentRow[],
    (meetings ?? []) as ClassMeetingRow[]
  );

  return {
    workbook,
    downloadName: `coursework-export-${format(new Date(), "yyyy-MM-dd")}.xlsx`,
  };
}

export async function workbookToBuffer(
  workbook: ExcelJS.Workbook
): Promise<Buffer> {
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function xlsxResponse(body: Buffer, downloadName: string): Response {
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${downloadName}"`,
    },
  });
}
