/** Import/export helpers: CSV, JSON, iCal and file download. */
import { DAY_NAMES, type AppState, type Session } from "./types";

export function download(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCSV = (rows: (string | number)[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\n");

/** Minimal RFC-4180 CSV parser returning objects keyed by header. */
export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  if (!head) return [];
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

export function describe(state: AppState, s: Session) {
  const p = state.settings.periods;
  return {
    day: DAY_NAMES[s.day], start: p[s.period]?.start ?? "", end: p[s.period + s.length - 1]?.end ?? "",
    cls: state.classes.find((c) => c.id === s.classId)?.name ?? "?",
    subject: state.subjects.find((x) => x.id === s.subjectId),
    lecturer: state.lecturers.find((l) => l.id === s.lecturerId)?.name ?? "?",
    room: state.rooms.find((r) => r.id === s.roomId)?.name ?? "?",
  };
}

export function sessionsCSV(state: AppState, sessions: Session[]) {
  const rows: (string | number)[][] = [["Class", "Day", "Start", "End", "Subject code", "Subject", "Type", "Lecturer", "Room"]];
  [...sessions].sort((a, b) => a.day - b.day || a.period - b.period).forEach((s) => {
    const d = describe(state, s);
    rows.push([d.cls, d.day, d.start, d.end, d.subject?.code ?? "", d.subject?.name ?? "", d.subject?.type ?? "", d.lecturer, d.room]);
  });
  return toCSV(rows);
}

const icsEsc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
/** Weekly recurring iCal events, starting from the next occurrence of each weekday. */
export function sessionsICS(state: AppState, sessions: Session[], calName: string) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date, hm: string) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${hm.replace(":", "")}00`;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ClashFree Timetable//EN", `X-WR-CALNAME:${icsEsc(calName)}`];
  for (const s of sessions) {
    const d = describe(state, s);
    const date = new Date(now); const jsDay = (s.day + 1) % 7;
    date.setDate(now.getDate() + ((jsDay - now.getDay() + 7) % 7));
    lines.push("BEGIN:VEVENT", `UID:${s.id}@clashfree`, `DTSTAMP:${fmt(now, "00:00")}Z`.replace("T0000Z", "T000000Z"),
      `DTSTART:${fmt(date, d.start)}`, `DTEND:${fmt(date, d.end)}`, "RRULE:FREQ=WEEKLY;COUNT=16",
      `SUMMARY:${icsEsc(`${d.subject?.code} ${d.subject?.name} (${d.cls})`)}`, `LOCATION:${icsEsc(d.room)}`,
      `DESCRIPTION:${icsEsc(`Lecturer: ${d.lecturer}`)}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function printTimetable(title: string) {
  const old = document.title; document.title = title;
  window.print();
  setTimeout(() => (document.title = old), 500);
}
