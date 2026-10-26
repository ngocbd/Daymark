export type PunchKind = "in" | "out" | "ping";

export type Punch = {
  id: string;
  kind: PunchKind;
  at: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  place: string | null;
  face: string | null;
  faceOk: boolean;
  note: string;
};

export type Shift = {
  id: string;
  date: string;
  start: string;
  end: string;
  site: string;
  label: string;
  note: string;
};

export type RequestKind = "leave" | "absence" | "onsite" | "shift";
export type RequestStatus = "pending" | "approved" | "declined";

export type AttendanceRequest = {
  id: string;
  kind: RequestKind;
  status: RequestStatus;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  site: string;
  reason: string;
  createdAt: string;
};

export type Profile = {
  name: string;
  dayMinutes: number;
};

export type Backup = {
  version: 1;
  profile: Profile;
  punches: Punch[];
  shifts: Shift[];
  requests: AttendanceRequest[];
};

export const DEFAULT_PROFILE: Profile = {
  name: "",
  dayMinutes: 8 * 60,
};
