import { demoEmails, sentDemoEmails, type DemoEmail } from "../demo-data";
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

export async function listEmails(args: {
  mailbox?: string;
  maxResults?: number;
  query?: string;
}) {
  const maxResults = args.maxResults ?? 8;
  const mailbox = args.mailbox || "INBOX";

  if (preferDemoMode()) {
    const q = args.query?.toLowerCase();
    const all = [...demoEmails, ...sentDemoEmails];
    const filtered = q
      ? all.filter(
          (m) =>
            m.subject.toLowerCase().includes(q) ||
            m.from.toLowerCase().includes(q) ||
            m.snippet.toLowerCase().includes(q) ||
            m.body.toLowerCase().includes(q),
        )
      : all;
    return {
      mode: "demo" as const,
      emails: filtered.slice(0, maxResults).map((m) => ({
        id: m.id,
        from: m.from,
        to: m.to,
        subject: m.subject,
        snippet: m.snippet,
        date: m.date,
      })),
    };
  }

  const query = args.query ? escapeAppleScript(args.query.toLowerCase()) : "";
  const script = `
set output to "["
set firstItem to true
set maxCount to ${maxResults}
set counter to 0
set queryText to "${query}"
tell application "Mail"
  set targetBox to inbox
  try
    if "${escapeAppleScript(mailbox)}" is not "INBOX" then
      set targetBox to mailbox "${escapeAppleScript(mailbox)}"
    end if
  end try
  set msgs to messages of targetBox
  repeat with m in msgs
    set subj to subject of m
    set senderAddr to sender of m
    if queryText is "" or subj contains queryText or senderAddr contains queryText then
      if firstItem is false then set output to output & ","
      set firstItem to false
      set msgId to id of m as string
      set msgDate to (date received of m) as «class isot» as string
      set msgSnippet to content of m
      if (length of msgSnippet) > 160 then set msgSnippet to text 1 thru 160 of msgSnippet
      set output to output & "{\\"id\\":\\"" & msgId & "\\",\\"from\\":\\"" & my jsEscape(senderAddr) & "\\",\\"to\\":\\"\\",\\"subject\\":\\"" & my jsEscape(subj) & "\\",\\"snippet\\":\\"" & my jsEscape(msgSnippet) & "\\",\\"date\\":\\"" & msgDate & "\\"}"
      set counter to counter + 1
      if counter ≥ maxCount then exit repeat
    end if
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
  return { mode: "apple" as const, emails: parseJsonArray(raw) };
}

export async function readEmail(args: { id: string }) {
  if (preferDemoMode()) {
    const mail = [...demoEmails, ...sentDemoEmails].find((m) => m.id === args.id);
    if (!mail) throw new Error("E-post hittades inte i demodata");
    return { mode: "demo" as const, email: mail };
  }

  const id = escapeAppleScript(args.id);
  const script = `
tell application "Mail"
  set m to first message of inbox whose id is ${id}
  set subj to subject of m
  set senderAddr to sender of m
  set msgDate to (date received of m) as «class isot» as string
  set msgBody to content of m
  return "{\\"id\\":\\"${id}\\",\\"from\\":\\"" & my jsEscape(senderAddr) & "\\",\\"to\\":\\"\\",\\"subject\\":\\"" & my jsEscape(subj) & "\\",\\"date\\":\\"" & msgDate & "\\",\\"snippet\\":\\"" & my jsEscape(text 1 thru (my minLen(msgBody, 160))) & "\\",\\"body\\":\\"" & my jsEscape(msgBody) & "\\"}"
end tell

on minLen(t, n)
  if (length of t) < n then return length of t
  return n
end minLen

on jsEscape(t)
  set t to my replaceText(t, "\\\\", "\\\\\\\\")
  set t to my replaceText(t, "\\"", "\\\\\\"")
  set t to my replaceText(t, return, "\\\\n")
  set t to my replaceText(t, linefeed, "\\\\n")
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
  return { mode: "apple" as const, email: JSON.parse(raw) };
}

export async function composeOrSendEmail(args: {
  to: string;
  subject: string;
  body: string;
  send?: boolean;
}) {
  if (preferDemoMode()) {
    const mail: DemoEmail = {
      id: `mail-sent-${Date.now()}`,
      from: "demo@icloud.com",
      to: args.to,
      subject: args.subject,
      snippet: args.body.slice(0, 120),
      date: new Date().toISOString(),
      body: args.body,
    };
    sentDemoEmails.unshift(mail);
    return {
      mode: "demo" as const,
      email: mail,
      status: args.send === false ? "draft_demo" : "sent_demo",
    };
  }

  const to = escapeAppleScript(args.to);
  const subject = escapeAppleScript(args.subject);
  const body = escapeAppleScript(args.body);
  const shouldSend = args.send !== false;

  const script = `
tell application "Mail"
  set newMessage to make new outgoing message with properties {subject:"${subject}", content:"${body}", visible:true}
  tell newMessage
    make new to recipient at end of to recipients with properties {address:"${to}"}
  end tell
  ${shouldSend ? "send newMessage\n  return \"sent\"" : 'return "draft"'}
end tell
`;

  const status = await runOsascript(script);
  return {
    mode: "apple" as const,
    status,
    to: args.to,
    subject: args.subject,
  };
}
