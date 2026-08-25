import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssessmentRow, ClassMeetingRow, ClassRow } from "@/lib/types";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];
const NOT_CONFIGURED = "Google Calendar sync is not configured";

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

function requireEncryptionKey(): Buffer {
  const hex = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim();
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(NOT_CONFIGURED);
  }
  return Buffer.from(hex, "hex");
}

export function assertGoogleCalendarConfigured() {
  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_REDIRECT_URI ||
    !process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ||
    !/^[0-9a-fA-F]{64}$/.test(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY.trim())
  ) {
    throw new Error(NOT_CONFIGURED);
  }
}

export function encryptToken(plaintext: string): string {
  const key = requireEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptToken(payload: string): string {
  const key = requireEncryptionKey();
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error(NOT_CONFIGURED);
  }
  const iv = Buffer.from(parts[1], "hex");
  const tag = Buffer.from(parts[2], "hex");
  const data = Buffer.from(parts[3], "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8"
  );
}

export function getOAuth2Client() {
  assertGoogleCalendarConfigured();
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getGoogleAuthUrl(state: string) {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Google did not return access and refresh tokens");
  }
  const expiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date)
    : new Date(Date.now() + 3500_000);
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
  };
}

type ConnectionRow = {
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
};

async function getAuthedCalendar(
  supabase: SupabaseClient,
  userId: string
) {
  assertGoogleCalendarConfigured();
  const { data, error } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) {
    throw new Error("Google Calendar is not connected");
  }
  const row = data as ConnectionRow;
  const client = getOAuth2Client();
  let access = decryptToken(row.access_token);
  const refresh = decryptToken(row.refresh_token);
  client.setCredentials({
    access_token: access,
    refresh_token: refresh,
    expiry_date: new Date(row.token_expires_at).getTime(),
  });

  const expiresAt = new Date(row.token_expires_at).getTime();
  if (expiresAt < Date.now() + 60_000) {
    const refreshed = await client.refreshAccessToken();
    const creds = refreshed.credentials;
    if (!creds.access_token) {
      throw new Error("Failed to refresh Google access token");
    }
    access = creds.access_token;
    const newExpiry = creds.expiry_date
      ? new Date(creds.expiry_date)
      : new Date(Date.now() + 3500_000);
    await supabase
      .from("google_calendar_connections")
      .update({
        access_token: encryptToken(access),
        token_expires_at: newExpiry.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    client.setCredentials({
      access_token: access,
      refresh_token: refresh,
      expiry_date: newExpiry.getTime(),
    });
  }

  return google.calendar({ version: "v3", auth: client });
}

function formatTimeForGoogle(time: string): string {
  // HH:MM:SS → HH:MM:SS
  const m = time.match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return "09:00:00";
  return `${m[1]}:${m[2]}:${m[3] ?? "00"}`;
}

function untilUtc(dateStr: string): string {
  // YYYYMMDDTHHMMSSZ end of day
  const d = dateStr.replace(/-/g, "");
  return `${d}T235959Z`;
}

export async function syncClassToGoogleCalendar(opts: {
  supabase: SupabaseClient;
  userId: string;
  classRow: ClassRow;
  assessments: AssessmentRow[];
  meetings: ClassMeetingRow[];
}): Promise<{ created: number; updated: number }> {
  const calendar = await getAuthedCalendar(opts.supabase, opts.userId);
  const label = opts.classRow.code || opts.classRow.name;
  let created = 0;
  let updated = 0;

  for (const a of opts.assessments) {
    if (!a.due_date) continue;
    const { data: existing } = await opts.supabase
      .from("google_calendar_event_map")
      .select("id, google_event_id")
      .eq("user_id", opts.userId)
      .eq("assessment_id", a.id)
      .maybeSingle();

    const body = {
      summary: `${a.title} (${label})`,
      description: `Coursework by CoreMax · ${a.type}`,
      start: { date: a.due_date },
      end: { date: a.due_date },
    };

    if (existing?.google_event_id) {
      await calendar.events.update({
        calendarId: "primary",
        eventId: existing.google_event_id,
        requestBody: body,
      });
      await opts.supabase
        .from("google_calendar_event_map")
        .update({ synced_at: new Date().toISOString() })
        .eq("id", existing.id);
      updated += 1;
    } else {
      const res = await calendar.events.insert({
        calendarId: "primary",
        requestBody: body,
      });
      if (!res.data.id) continue;
      await opts.supabase.from("google_calendar_event_map").insert({
        user_id: opts.userId,
        assessment_id: a.id,
        google_event_id: res.data.id,
      });
      created += 1;
    }
  }

  for (const m of opts.meetings) {
    const { data: existing } = await opts.supabase
      .from("google_calendar_event_map")
      .select("id, google_event_id")
      .eq("user_id", opts.userId)
      .eq("class_meeting_id", m.id)
      .maybeSingle();

    const startDate =
      m.term_start_date ||
      new Date().toISOString().slice(0, 10);
    // Align first occurrence to the meeting weekday on/after startDate
    const first = alignToWeekday(startDate, m.day_of_week);
    const startT = formatTimeForGoogle(m.start_time);
    const endT = formatTimeForGoogle(m.end_time);
    const byday = BYDAY[m.day_of_week] ?? "MO";
    const rrule = m.term_end_date
      ? `RRULE:FREQ=WEEKLY;BYDAY=${byday};UNTIL=${untilUtc(m.term_end_date)}`
      : `RRULE:FREQ=WEEKLY;BYDAY=${byday};COUNT=16`;

    const body = {
      summary: `${label} class`,
      description: m.location
        ? `Coursework by CoreMax · ${m.location}`
        : "Coursework by CoreMax · recurring class meeting",
      location: m.location || undefined,
      start: {
        dateTime: `${first}T${startT}`,
        timeZone: "America/New_York",
      },
      end: {
        dateTime: `${first}T${endT}`,
        timeZone: "America/New_York",
      },
      recurrence: [rrule],
    };

    if (existing?.google_event_id) {
      await calendar.events.update({
        calendarId: "primary",
        eventId: existing.google_event_id,
        requestBody: body,
      });
      await opts.supabase
        .from("google_calendar_event_map")
        .update({ synced_at: new Date().toISOString() })
        .eq("id", existing.id);
      updated += 1;
    } else {
      const res = await calendar.events.insert({
        calendarId: "primary",
        requestBody: body,
      });
      if (!res.data.id) continue;
      await opts.supabase.from("google_calendar_event_map").insert({
        user_id: opts.userId,
        class_meeting_id: m.id,
        google_event_id: res.data.id,
      });
      created += 1;
    }
  }

  return { created, updated };
}

/**
 * Remove Google Calendar events for a class before DB cascade deletes the map rows.
 * Skips if Google is not connected. Treats 404/410 as success (already gone).
 */
export async function deleteClassGoogleEvents(opts: {
  supabase: SupabaseClient;
  userId: string;
  classId: string;
}): Promise<{ deleted: number; skipped: number }> {
  const [{ data: assessments }, { data: meetings }] = await Promise.all([
    opts.supabase.from("assessments").select("id").eq("class_id", opts.classId),
    opts.supabase
      .from("class_meetings")
      .select("id")
      .eq("class_id", opts.classId),
  ]);

  const assessmentIds = (assessments ?? []).map((a) => a.id as string);
  const meetingIds = (meetings ?? []).map((m) => m.id as string);

  const eventIds: string[] = [];

  if (assessmentIds.length > 0) {
    const { data: rows } = await opts.supabase
      .from("google_calendar_event_map")
      .select("google_event_id")
      .eq("user_id", opts.userId)
      .in("assessment_id", assessmentIds);
    for (const r of rows ?? []) {
      if (r.google_event_id) eventIds.push(r.google_event_id as string);
    }
  }

  if (meetingIds.length > 0) {
    const { data: rows } = await opts.supabase
      .from("google_calendar_event_map")
      .select("google_event_id")
      .eq("user_id", opts.userId)
      .in("class_meeting_id", meetingIds);
    for (const r of rows ?? []) {
      if (r.google_event_id) eventIds.push(r.google_event_id as string);
    }
  }

  if (eventIds.length === 0) {
    return { deleted: 0, skipped: 0 };
  }

  const { data: connection } = await opts.supabase
    .from("google_calendar_connections")
    .select("user_id")
    .eq("user_id", opts.userId)
    .maybeSingle();

  if (!connection) {
    return { deleted: 0, skipped: eventIds.length };
  }

  let calendar;
  try {
    calendar = await getAuthedCalendar(opts.supabase, opts.userId);
  } catch (err) {
    console.warn("deleteClassGoogleEvents: could not auth Calendar", err);
    return { deleted: 0, skipped: eventIds.length };
  }

  let deleted = 0;
  let skipped = 0;
  const unique = Array.from(new Set(eventIds));

  for (const eventId of unique) {
    try {
      await calendar.events.delete({
        calendarId: "primary",
        eventId,
      });
      deleted += 1;
    } catch (err: unknown) {
      const status =
        err && typeof err === "object" && "code" in err
          ? (err as { code?: number }).code
          : undefined;
      // Already deleted / gone
      if (status === 404 || status === 410) {
        deleted += 1;
        continue;
      }
      console.warn("deleteClassGoogleEvents: failed for", eventId, err);
      skipped += 1;
    }
  }

  return { deleted, skipped };
}

function alignToWeekday(isoDate: string, dayOfWeek: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  const current = d.getDay();
  const delta = (dayOfWeek - current + 7) % 7;
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}
