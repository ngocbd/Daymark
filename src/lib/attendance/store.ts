import { create } from "zustand";
import * as db from "@/lib/attendance/db";
import { buildSample } from "@/lib/attendance/sample";
import { eachDate } from "@/lib/attendance/time";
import {
  DEFAULT_PROFILE,
  type AttendanceRequest,
  type Backup,
  type Profile,
  type Punch,
  type RequestStatus,
  type Shift,
} from "@/lib/attendance/types";

type LogState = {
  ready: boolean;
  storageBlocked: boolean;
  profile: Profile;
  punches: Punch[];
  shifts: Shift[];
  requests: AttendanceRequest[];
  hydrate: () => Promise<void>;
  setProfile: (patch: Partial<Profile>) => Promise<void>;
  addPunch: (punch: Omit<Punch, "id" | "at"> & { at?: string }) => Promise<Punch>;
  removePunch: (id: string) => Promise<void>;
  addShift: (shift: Omit<Shift, "id">) => Promise<void>;
  removeShift: (id: string) => Promise<void>;
  addRequest: (request: Omit<AttendanceRequest, "id" | "createdAt" | "status">) => Promise<void>;
  setRequestStatus: (id: string, status: RequestStatus) => Promise<void>;
  removeRequest: (id: string) => Promise<void>;
  loadSample: () => Promise<void>;
  importBackup: (backup: Backup) => Promise<void>;
  eraseAll: () => Promise<void>;
};

let hydrating: Promise<void> | null = null;

async function persist(work: () => Promise<void>, onFail: () => void) {
  try {
    await work();
  } catch {
    onFail();
  }
}

function sortPunches(punches: Punch[]) {
  return [...punches].sort((a, b) => a.at.localeCompare(b.at));
}

function isBackup(value: unknown): value is Backup {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<Backup>;
  return row.version === 1 && Array.isArray(row.punches) && Array.isArray(row.shifts) && Array.isArray(row.requests);
}

export function parseBackup(value: unknown): Backup | null {
  return isBackup(value) ? value : null;
}

function shiftsFromRequest(request: AttendanceRequest): Shift[] {
  if (request.kind !== "shift" && request.kind !== "onsite") return [];
  const start = request.startTime || "09:00";
  const end = request.endTime || "17:00";
  return eachDate(request.startDate, request.endDate).map((date) => ({
    id: `req-${request.id}-${date}`,
    date,
    start,
    end,
    site: request.site || (request.kind === "onsite" ? "On site" : "Shift"),
    label: request.kind === "onsite" ? "On site" : "Shift",
    note: request.reason,
  }));
}

export const useAttendance = create<LogState>((set, get) => ({
  ready: false,
  storageBlocked: false,
  profile: DEFAULT_PROFILE,
  punches: [],
  shifts: [],
  requests: [],

  hydrate: () => {
    if (get().ready) return Promise.resolve();
    if (hydrating) return hydrating;
    hydrating = (async () => {
      try {
        const data = await db.readAll();
        set({
          ready: true,
          storageBlocked: false,
          profile: data.profile ?? DEFAULT_PROFILE,
          punches: sortPunches(data.punches),
          shifts: data.shifts,
          requests: data.requests,
        });
      } catch {
        set({ ready: true, storageBlocked: true });
      }
    })();
    return hydrating;
  },

  setProfile: async (patch) => {
    const profile = { ...get().profile, ...patch };
    set({ profile });
    await persist(
      () => db.saveProfile(profile),
      () => set({ storageBlocked: true }),
    );
  },

  addPunch: async (input) => {
    const punch: Punch = {
      id: crypto.randomUUID(),
      at: input.at ?? new Date().toISOString(),
      kind: input.kind,
      lat: input.lat,
      lng: input.lng,
      accuracy: input.accuracy,
      place: input.place,
      face: input.face,
      faceOk: input.faceOk,
      note: input.note,
    };
    set({ punches: sortPunches([...get().punches, punch]) });
    await persist(
      () => db.putRow("punches", punch),
      () => set({ storageBlocked: true }),
    );
    return punch;
  },

  removePunch: async (id) => {
    set({ punches: get().punches.filter((punch) => punch.id !== id) });
    await persist(
      () => db.deleteRow("punches", id),
      () => set({ storageBlocked: true }),
    );
  },

  addShift: async (input) => {
    const shift: Shift = { ...input, id: crypto.randomUUID() };
    set({ shifts: [...get().shifts, shift] });
    await persist(
      () => db.putRow("shifts", shift),
      () => set({ storageBlocked: true }),
    );
  },

  removeShift: async (id) => {
    set({ shifts: get().shifts.filter((shift) => shift.id !== id) });
    await persist(
      () => db.deleteRow("shifts", id),
      () => set({ storageBlocked: true }),
    );
  },

  addRequest: async (input) => {
    const request: AttendanceRequest = {
      ...input,
      id: crypto.randomUUID(),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    set({ requests: [request, ...get().requests] });
    await persist(
      () => db.putRow("requests", request),
      () => set({ storageBlocked: true }),
    );
  },

  setRequestStatus: async (id, status) => {
    const current = get().requests.find((request) => request.id === id);
    if (!current) return;
    const next = { ...current, status };
    let shifts = get().shifts;
    if (status === "approved" && current.status !== "approved") {
      const created = shiftsFromRequest(next).filter((shift) => !shifts.some((row) => row.id === shift.id));
      shifts = [...shifts, ...created];
      set({
        requests: get().requests.map((request) => (request.id === id ? next : request)),
        shifts,
      });
      await persist(
        async () => {
          await db.putRow("requests", next);
          for (const shift of created) await db.putRow("shifts", shift);
        },
        () => set({ storageBlocked: true }),
      );
      return;
    }
    set({ requests: get().requests.map((request) => (request.id === id ? next : request)) });
    await persist(
      () => db.putRow("requests", next),
      () => set({ storageBlocked: true }),
    );
  },

  removeRequest: async (id) => {
    set({ requests: get().requests.filter((request) => request.id !== id) });
    await persist(
      () => db.deleteRow("requests", id),
      () => set({ storageBlocked: true }),
    );
  },

  loadSample: async () => {
    const sample = buildSample(new Date());
    const oldPunches = get().punches.filter((punch) => punch.id.startsWith("sample-"));
    const oldShifts = get().shifts.filter((shift) => shift.id.startsWith("sample-"));
    const oldRequests = get().requests.filter((request) => request.id.startsWith("sample-"));
    const punches = sortPunches([
      ...get().punches.filter((punch) => !punch.id.startsWith("sample-")),
      ...sample.punches,
    ]);
    const shifts = [...get().shifts.filter((shift) => !shift.id.startsWith("sample-")), ...sample.shifts];
    const requests = [
      ...get().requests.filter((request) => !request.id.startsWith("sample-")),
      ...sample.requests,
    ];
    set({ punches, shifts, requests });
    await persist(
      async () => {
        for (const punch of oldPunches) {
          if (!sample.punches.some((row) => row.id === punch.id)) await db.deleteRow("punches", punch.id);
        }
        for (const shift of oldShifts) {
          if (!sample.shifts.some((row) => row.id === shift.id)) await db.deleteRow("shifts", shift.id);
        }
        for (const request of oldRequests) {
          if (!sample.requests.some((row) => row.id === request.id)) await db.deleteRow("requests", request.id);
        }
        for (const punch of sample.punches) await db.putRow("punches", punch);
        for (const shift of sample.shifts) await db.putRow("shifts", shift);
        for (const request of sample.requests) await db.putRow("requests", request);
      },
      () => set({ storageBlocked: true }),
    );
  },

  importBackup: async (backup) => {
    const profile = {
      name: typeof backup.profile?.name === "string" ? backup.profile.name : "",
      dayMinutes:
        typeof backup.profile?.dayMinutes === "number" ? backup.profile.dayMinutes : DEFAULT_PROFILE.dayMinutes,
    };
    const punches = sortPunches(backup.punches);
    set({
      profile,
      punches,
      shifts: backup.shifts,
      requests: backup.requests,
    });
    await persist(
      () => db.replaceAll({ profile, punches, shifts: backup.shifts, requests: backup.requests }),
      () => set({ storageBlocked: true }),
    );
  },

  eraseAll: async () => {
    set({
      profile: DEFAULT_PROFILE,
      punches: [],
      shifts: [],
      requests: [],
    });
    await persist(
      () => db.clearAll(),
      () => set({ storageBlocked: true }),
    );
  },
}));
