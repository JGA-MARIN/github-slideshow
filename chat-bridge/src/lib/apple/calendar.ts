import {
  createdDemoEvents,
  demoEvents,
  type DemoEvent,
} from "../demo-data";
import { preferDemoMode, runOsascript } from "../platform";

function escapeAppleScript(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function parseJsonArray<T>(raw: string): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function listCalendarEvents(args: {
  daysAhead?: number;
  query?: string;
  maxResults?: number;
}) {
  const daysAhead = args.daysAhead ?? 7;
  const maxResults = args.maxResults ?? 12;

  if (preferDemoMode()) {
    const max = Date.now() + daysAhead * 86400000;
    const all = [...demoEvents, ...createdDemoEvents].filter(
      (e) => new Date(e.start).getTime() <= max,
    );
    const filtered = args.query
      ? all.filter((e) =>
          e.summary.toLowerCase().includes(args.query!.toLowerCase()),
        )
      : all;
    return { mode: "demo" as const, events: filtered.slice(0, maxResults) };
  }

  const query = args.query ? escapeAppleScript(args.query.toLowerCase()) : "";
  const script = `
set output to "["
set firstItem to true
set maxCount to ${maxResults}
set counter to 0
set queryText to "${query}"
tell application "Calendar"
  set startDate to current date
  set endDate to startDate + (${daysAhead} * days)
  repeat with cal in calendars
    set evts to (every event of cal whose start date ≥ startDate and start date ≤ endDate)
    repeat with e in evts
      set eventSummary to summary of e
      if queryText is "" or eventSummary contains queryText then
        if firstItem is false then set output to output & ","
        set firstItem to false
        set eventStart to (start date of e) as «class isot» as string
        set eventEnd to (end date of e) as «class isot» as string
        set eventLoc to ""
        try
          set eventLoc to location of e
        end try
        set eventNotes to ""
        try
          set eventNotes to description of e
        end try
        set output to output & "{\\"id\\":\\"" & (uid of e) & "\\",\\"summary\\":\\"" & my jsEscape(eventSummary) & "\\",\\"start\\":\\"" & eventStart & "\\",\\"end\\":\\"" & eventEnd & "\\",\\"location\\":\\"" & my jsEscape(eventLoc) & "\\",\\"description\\":\\"" & my jsEscape(eventNotes) & "\\",\\"calendar\\":\\"" & my jsEscape(name of cal) & "\\"}"
        set counter to counter + 1
        if counter ≥ maxCount then exit repeat
      end if
    end repeat
    if counter ≥ maxCount then exit repeat
  end repeat
end tell
set output to output & "]"
return output

on jsEscape(t)
  set t to my replaceText(t, "\\\\", "\\\\\\\\")
  set t to my replaceText(t, "\\"", "\\\\\\"")
  set t to my replaceText(t, return, " ")
  set t to my replaceText(t, linefeed, " ")
  return t
end jsEscape

on replaceText(theText, oldString, newString)
  set AppleScript's text item delimiters to oldString
  set theItems to text items of theText
  set AppleScript's text item delimiters to newString
  set theText to theItems as text
  set AppleScript's text item delimiters to ""
  return theText
end replaceText
`;

  const raw = await runOsascript(script);
  return { mode: "apple" as const, events: parseJsonArray<DemoEvent>(raw) };
}

export async function createCalendarEvent(args: {
  summary: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  calendarName?: string;
}) {
  if (preferDemoMode()) {
    const event: DemoEvent = {
      id: `evt-created-${Date.now()}`,
      summary: args.summary,
      start: args.start,
      end: args.end,
      location: args.location,
      description: args.description,
    };
    createdDemoEvents.push(event);
    return { mode: "demo" as const, event };
  }

  const summary = escapeAppleScript(args.summary);
  const location = escapeAppleScript(args.location || "");
  const description = escapeAppleScript(args.description || "");
  const calendarName = escapeAppleScript(args.calendarName || "");
  const start = new Date(args.start);
  const end = new Date(args.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Ogiltigt datum. Använd ISO-8601, t.ex. 2026-10-05T12:00:00.");
  }

  const script = `
set monthList to {January, February, March, April, May, June, July, August, September, October, November, December}
set startDate to current date
set year of startDate to ${start.getFullYear()}
set month of startDate to item ${start.getMonth() + 1} of monthList
set day of startDate to ${start.getDate()}
set hours of startDate to ${start.getHours()}
set minutes of startDate to ${start.getMinutes()}
set seconds of startDate to ${start.getSeconds()}
set endDate to current date
set year of endDate to ${end.getFullYear()}
set month of endDate to item ${end.getMonth() + 1} of monthList
set day of endDate to ${end.getDate()}
set hours of endDate to ${end.getHours()}
set minutes of endDate to ${end.getMinutes()}
set seconds of endDate to ${end.getSeconds()}
tell application "Calendar"
  if "${calendarName}" is not "" then
    set targetCal to first calendar whose name is "${calendarName}"
  else
    set targetCal to first calendar
  end if
  set newEvent to make new event at end of events of targetCal with properties {summary:"${summary}", start date:startDate, end date:endDate, location:"${location}", description:"${description}"}
  return uid of newEvent
end tell
`;

  const id = await runOsascript(script);
  return {
    mode: "apple" as const,
    event: {
      id,
      summary: args.summary,
      start: args.start,
      end: args.end,
      location: args.location,
      description: args.description,
    },
  };
}
