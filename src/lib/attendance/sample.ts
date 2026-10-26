import type { AttendanceRequest, Punch, Shift } from "@/lib/attendance/types";
import { addDays, startOfWeek, ymd } from "@/lib/attendance/time";

const SITES = ["Head office", "Client site", "Warehouse"];
const INS = ["08:47", "09:05", "08:55", "09:12", "08:40"];
const OUTS = ["17:10", "17:36", "16:58", "18:05", "17:22"];

function stamp(date: string, hm: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = hm.split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0).toISOString();
}

export function buildSample(now: Date): {
  punches: Punch[];
  shifts: Shift[];
  requests: AttendanceRequest[];
} {
  const week = startOfWeek(now);
  const today = ymd(now);
  const punches: Punch[] = [];
  const shifts: Shift[] = [];

  for (let i = 0; i < 5; i++) {
    const date = ymd(addDays(week, i));
    const site = SITES[i % SITES.length];
    shifts.push({
      id: `sample-shift-${date}`,
      date,
      start: "09:00",
      end: "17:00",
      site,
      label: i % 2 === 0 ? "On site" : "Office",
      note: "Sample week",
    });
    if (date >= today) continue;
    punches.push(
      {
        id: `sample-in-${date}`,
        kind: "in",
        at: stamp(date, INS[i] ?? "09:00"),
        lat: null,
        lng: null,
        accuracy: null,
        place: site,
        face: null,
        faceOk: false,
        note: "Sample week",
      },
      {
        id: `sample-out-${date}`,
        kind: "out",
        at: stamp(date, OUTS[i] ?? "17:00"),
        lat: null,
        lng: null,
        accuracy: null,
        place: site,
        face: null,
        faceOk: false,
        note: "Sample week",
      },
    );
  }

  const nextMon = ymd(addDays(week, 7));
  const nextTue = ymd(addDays(week, 8));
  const nextWed = ymd(addDays(week, 9));
  const nextFri = ymd(addDays(week, 11));

  shifts.push(
    {
      id: `sample-shift-${nextMon}`,
      date: nextMon,
      start: "09:00",
      end: "17:30",
      site: "Head office",
      label: "On site",
      note: "Sample week",
    },
    {
      id: `sample-shift-${nextTue}`,
      date: nextTue,
      start: "10:00",
      end: "16:00",
      site: "Client site",
      label: "Site visit",
      note: "Sample week",
    },
  );

  const requests: AttendanceRequest[] = [
    {
      id: "sample-req-leave",
      kind: "leave",
      status: "pending",
      startDate: nextFri,
      endDate: nextFri,
      startTime: "",
      endTime: "",
      site: "",
      reason: "Personal day",
      createdAt: now.toISOString(),
    },
    {
      id: "sample-req-onsite",
      kind: "onsite",
      status: "pending",
      startDate: nextWed,
      endDate: nextWed,
      startTime: "13:00",
      endTime: "16:30",
      site: "Riverside workshop",
      reason: "Install check",
      createdAt: now.toISOString(),
    },
  ];

  return { punches, shifts, requests };
}
