import { google } from "googleapis";
import { prisma } from "@/lib/db";

export function getGoogleAuth() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getCalendarClient(accessToken: string, refreshToken: string) {
  const auth = getGoogleAuth();
  auth.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return google.calendar({ version: "v3", auth });
}

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

interface CalendarEventInput {
  summary: string;
  description: string;
  start: Date;
  end: Date;
  attendeeEmail: string;
  attendeeName: string;
}

/**
 * Load Google OAuth tokens from the database.
 * Returns null if the user hasn't connected their Google Calendar yet.
 */
async function getGoogleTokens(): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  const [accessRow, refreshRow] = await Promise.all([
    prisma.agentConfig.findUnique({ where: { key: "google_access_token" } }),
    prisma.agentConfig.findUnique({ where: { key: "google_refresh_token" } }),
  ]);

  if (!accessRow?.value || !refreshRow?.value) return null;

  return {
    accessToken: accessRow.value,
    refreshToken: refreshRow.value,
  };
}

/**
 * Create a Google Calendar event and return the event ID.
 * Returns null if Google Calendar is not connected.
 */
export async function createCalendarEvent(
  input: CalendarEventInput
): Promise<string | null> {
  const tokens = await getGoogleTokens();
  if (!tokens) return null;

  try {
    const calendar = getCalendarClient(tokens.accessToken, tokens.refreshToken);
    const event = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: input.summary,
        description: input.description,
        start: {
          dateTime: input.start.toISOString(),
          timeZone: process.env.AGENT_CALENDAR_TIMEZONE ?? "America/New_York",
        },
        end: {
          dateTime: input.end.toISOString(),
          timeZone: process.env.AGENT_CALENDAR_TIMEZONE ?? "America/New_York",
        },
        attendees: [{ email: input.attendeeEmail, displayName: input.attendeeName }],
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 },
            { method: "popup", minutes: 10 },
          ],
        },
      },
    });

    return event.data.id ?? null;
  } catch (err) {
    console.error("Failed to create Google Calendar event:", err);
    return null;
  }
}

/**
 * Update an existing Google Calendar event (for reschedules).
 */
export async function updateCalendarEvent(
  eventId: string,
  input: CalendarEventInput
): Promise<boolean> {
  const tokens = await getGoogleTokens();
  if (!tokens) return false;

  try {
    const calendar = getCalendarClient(tokens.accessToken, tokens.refreshToken);
    await calendar.events.update({
      calendarId: "primary",
      eventId,
      requestBody: {
        summary: input.summary,
        description: input.description,
        start: {
          dateTime: input.start.toISOString(),
          timeZone: process.env.AGENT_CALENDAR_TIMEZONE ?? "America/New_York",
        },
        end: {
          dateTime: input.end.toISOString(),
          timeZone: process.env.AGENT_CALENDAR_TIMEZONE ?? "America/New_York",
        },
        attendees: [{ email: input.attendeeEmail, displayName: input.attendeeName }],
      },
    });
    return true;
  } catch (err) {
    console.error("Failed to update Google Calendar event:", err);
    return false;
  }
}

/**
 * Delete a Google Calendar event (for cancellations).
 */
export async function deleteCalendarEvent(
  eventId: string
): Promise<boolean> {
  const tokens = await getGoogleTokens();
  if (!tokens) return false;

  try {
    const calendar = getCalendarClient(tokens.accessToken, tokens.refreshToken);
    await calendar.events.delete({
      calendarId: "primary",
      eventId,
    });
    return true;
  } catch (err) {
    console.error("Failed to delete Google Calendar event:", err);
    return false;
  }
}
