import type { AttendanceRequest, Punch, Shift } from "@/lib/attendance/types";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseYmd(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  return x;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function eachDate(start: string, end: string, cap = 62): string[] {
  const out: string[] = [];
  const cur = parseYmd(start);
  const last = end < start ? start : end;
  while (ymd(cur) <= last && out.length < cap) {
    out.push(ymd(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function formatClock(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatLongDate(d: Date): string {
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatShortDate(value: string): string {
  const d = parseYmd(value);
  return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function formatDuration(mins: number): string {
  const rounded = mins > 0 && mins < 0.5 ? 1 : Math.max(0, Math.round(mins));
  const h = Math.floor(rounded / 60);
  const r = rounded % 60;
  return `${h}h ${String(r).padStart(2, "0")}m`;
}

export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export function shiftMinutes(shift: Shift): number {
  return Math.max(0, hmToMinutes(shift.end) - hmToMinutes(shift.start));
}

export type Session = {
  start: string;
  end: string | null;
  open: boolean;
};

export function sessions(punches: Punch[]): Session[] {
  const sorted = [...punches].sort((a, b) => a.at.localeCompare(b.at));
  const out: Session[] = [];
  let open: Punch | null = null;
  for (const punch of sorted) {
    if (punch.kind === "ping") continue;
    if (punch.kind === "in") {
      if (open) continue;
      open = punch;
    } else if (open) {
      out.push({ start: open.at, end: punch.at, open: false });
      open = null;
    }
  }
  if (open) out.push({ start: open.at, end: null, open: true });
  return out;
}

export function isClockedIn(punches: Punch[]): boolean {
  const list = sessions(punches);
  return list.length > 0 && list[list.length - 1].open;
}

export function openSession(punches: Punch[]): Session | null {
  const list = sessions(punches);
  const last = list[list.length - 1];
  return last?.open ? last : null;
}

function splitSession(start: Date, end: Date): { date: string; minutes: number }[] {
  const out: { date: string; minutes: number }[] = [];
  let cursor = new Date(start);
  while (cursor < end) {
    const boundary = new Date(cursor);
    boundary.setHours(24, 0, 0, 0);
    const sliceEnd = boundary < end ? boundary : end;
    const minutes = (sliceEnd.getTime() - cursor.getTime()) / 60000;
    if (minutes > 0) out.push({ date: ymd(cursor), minutes });
    cursor = sliceEnd;
  }
  return out;
}

export function minutesByDay(punches: Punch[], now: Date | null): Map<string, number> {
  const map = new Map<string, number>();
  for (const session of sessions(punches)) {
    if (session.open && !now) continue;
    const start = new Date(session.start);
    const end = session.end ? new Date(session.end) : now;
    if (!end || end <= start) continue;
    for (const slice of splitSession(start, end)) {
      map.set(slice.date, (map.get(slice.date) ?? 0) + slice.minutes);
    }
  }
  return map;
}

export function sumRange(map: Map<string, number>, dates: string[]): number {
  return dates.reduce((total, date) => total + (map.get(date) ?? 0), 0);
}

export type DayMark = "work" | "leave" | "absence" | "off";

export function dayMarks(requests: AttendanceRequest[], from: string, to: string): Map<string, DayMark> {
  const map = new Map<string, DayMark>();
  for (const request of requests) {
    if (request.status !== "approved") continue;
    if (request.kind !== "leave" && request.kind !== "absence") continue;
    const mark: DayMark = request.kind === "leave" ? "leave" : "absence";
    for (const date of eachDate(request.startDate, request.endDate)) {
      if (date < from || date > to) continue;
      if (map.get(date) === "absence") continue;
      map.set(date, mark);
    }
  }
  return map;
}

export type ShiftStanding = "upcoming" | "due" | "on-time" | "late" | "missed" | "open";

export function shiftStanding(
  shift: Shift,
  punches: Punch[],
  today: string,
): { standing: ShiftStanding; late: number } {
  const dayPunches = punches
    .filter((punch) => punch.kind === "in" && ymd(new Date(punch.at)) === shift.date)
    .sort((a, b) => a.at.localeCompare(b.at));
  const first = dayPunches[0];
  if (!first) {
    if (shift.date > today) return { standing: "upcoming", late: 0 };
    if (shift.date === today) return { standing: "due", late: 0 };
    return { standing: "missed", late: 0 };
  }
  const start = parseYmd(shift.date);
  const [h, m] = shift.start.split(":").map(Number);
  start.setHours(h || 0, m || 0, 0, 0);
  const late = Math.round((new Date(first.at).getTime() - start.getTime()) / 60000);
  if (late > 5) return { standing: "late", late };
  const stillOpen = isClockedIn(punches) && ymd(new Date(first.at)) === today && shift.date === today;
  if (stillOpen) return { standing: "open", late: 0 };
  return { standing: "on-time", late: 0 };
}

export function weekDates(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function monthDates(anchor: Date): string[] {
  const start = startOfMonth(anchor);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return eachDate(ymd(start), ymd(end));
}
