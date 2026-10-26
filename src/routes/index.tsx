import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { FaceScan, type FaceScanHandle } from "@/components/face-scan";
import { LiveLocation, useLiveLocation } from "@/components/live-location";
import { useClock } from "@/components/use-clock";
import { Button, Card, TextInput } from "@/components/ui";
import { useAttendance } from "@/lib/attendance/store";
import type { Punch, PunchKind } from "@/lib/attendance/types";
import {
  formatClock,
  formatDuration,
  formatLongDate,
  formatShortDate,
  formatTime,
  isClockedIn,
  openSession,
  shiftStanding,
  ymd,
} from "@/lib/attendance/time";

export const Route = createFileRoute("/")({
  component: TodayPage,
  head: () => ({ meta: [{ title: "Today · Daymark" }] }),
});

const kindLabel: Record<PunchKind, string> = {
  in: "Clock in",
  out: "Clock out",
  ping: "Check-in",
};

function TodayPage() {
  const punches = useAttendance((state) => state.punches);
  const shifts = useAttendance((state) => state.shifts);
  const addPunch = useAttendance((state) => state.addPunch);
  const removePunch = useAttendance((state) => state.removePunch);
  const now = useClock();
  const fix = useLiveLocation();
  const faceRef = useRef<FaceScanHandle>(null);
  const [place, setPlace] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<PunchKind | null>(null);
  const [busy, setBusy] = useState(false);

  const clockedIn = isClockedIn(punches);
  const open = openSession(punches);
  const elapsed = open && now ? (now.getTime() - new Date(open.start).getTime()) / 60000 : null;
  const today = now ? ymd(now) : null;
  const todayShift = today ? shifts.find((shift) => shift.date === today) : undefined;
  const standing = today && todayShift ? shiftStanding(todayShift, punches, today) : null;
  const todayPunches = today
    ? [...punches].filter((punch) => ymd(new Date(punch.at)) === today).reverse()
    : [];

  async function commit(kind: PunchKind) {
    setBusy(true);
    const face = faceRef.current?.capture() ?? null;
    const phase = faceRef.current?.getPhase();
    try {
      await addPunch({
        kind,
        lat: fix.lat,
        lng: fix.lng,
        accuracy: fix.accuracy,
        place: (fix.place || place).trim() || null,
        face,
        faceOk: phase === "locked" && Boolean(face),
        note: note.trim(),
      });
      setNote("");
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  function ask(kind: PunchKind) {
    const phase = faceRef.current?.getPhase();
    const missingFace = phase !== "locked";
    const missingPlace = fix.lat == null && place.trim() === "" && !fix.place;
    if (missingFace || missingPlace) {
      setPending(kind);
      return;
    }
    void commit(kind);
  }

  const pendingGaps = pending
    ? [
        faceRef.current?.getPhase() === "locked" ? null : "a locked face",
        fix.lat != null || place.trim() || fix.place ? null : "a location",
      ].filter(Boolean)
    : [];

  return (
    <AppShell>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted">{now ? formatLongDate(now) : "Today"}</p>
          <p className="mt-1 font-display text-6xl leading-none tracking-tight tabular-nums">
            {now ? formatClock(now) : "\u2013\u2013:\u2013\u2013"}
          </p>
          <p className="mt-3 text-sm font-medium">
            {clockedIn ? (
              <span className="text-primary">
                On the clock{elapsed != null ? ` \u00b7 ${formatDuration(elapsed)}` : ""}
              </span>
            ) : (
              <span className="text-muted">Off the clock</span>
            )}
          </p>
        </div>
      </div>

      {todayShift ? (
        <Card className="mt-5">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Today\u2019s shift</p>
          <p className="mt-1 text-base font-semibold">
            {todayShift.start}\u2013{todayShift.end}
            {todayShift.site ? ` \u00b7 ${todayShift.site}` : ""}
          </p>
          <p className="mt-1 text-sm text-muted">
            {todayShift.label}
            {standing?.standing === "late" ? ` \u00b7 Late ${standing.late}m` : ""}
            {standing?.standing === "on-time" ? " \u00b7 On time" : ""}
            {standing?.standing === "due" ? " \u00b7 Not clocked in yet" : ""}
            {standing?.standing === "open" ? " \u00b7 Shift in progress" : ""}
            {standing?.standing === "missed" ? " \u00b7 Missed" : ""}
          </p>
        </Card>
      ) : null}

      <div className="mt-5 grid gap-2">
        {clockedIn ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="clay" className="h-14 text-base" disabled={busy} onClick={() => ask("out")}>
              Clock out
            </Button>
            <Button variant="line" className="h-14 text-base" disabled={busy} onClick={() => ask("ping")}>
              <MapPin className="size-4" aria-hidden="true" />
              Check in here
            </Button>
          </div>
        ) : (
          <Button className="h-14 text-base" disabled={busy} onClick={() => ask("in")}>
            Clock in
          </Button>
        )}
        <p className="text-xs text-muted">
          {clockedIn
            ? "Check-in stamps a live location and face without ending the shift."
            : "Clock in stamps the time, the live fix, and a face photo on this device."}
        </p>
      </div>

      {pending ? (
        <Card className="mt-3 bg-gold-soft">
          <p className="text-sm font-medium text-gold">
            This {kindLabel[pending].toLowerCase()} is missing {pendingGaps.join(" and ") || "a full proof"}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void commit(pending)}>
              Save anyway
            </Button>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Go back
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="mt-4 grid gap-3">
        <TextInput
          aria-label="Site name"
          placeholder="Site name, if GPS is quiet"
          value={place}
          onChange={(event) => setPlace(event.target.value)}
        />
        <TextInput
          aria-label="Note"
          placeholder="Note (optional)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <FaceScan ref={faceRef} />
        <LiveLocation fix={fix} />
      </div>

      <section className="mt-6">
        <h2 className="text-sm font-semibold">Today\u2019s punches</h2>
        {now == null ? (
          <p className="mt-3 text-sm text-muted">Reading this device\u2026</p>
        ) : todayPunches.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing stamped yet today.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {todayPunches.map((punch) => (
              <PunchRow key={punch.id} punch={punch} onRemove={() => void removePunch(punch.id)} />
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}

function PunchRow({ punch, onRemove }: { punch: Punch; onRemove: () => void }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-surface p-2 shadow-card">
      {punch.face ? (
        <img src={punch.face} alt="" className="thumb size-14 rounded-xl object-cover" />
      ) : (
        <div className="grid size-14 place-items-center rounded-xl bg-paper text-xs text-muted">No face</div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {kindLabel[punch.kind]} \u00b7 <span className="tabular-nums">{formatTime(punch.at)}</span>
        </p>
        <p className="truncate text-xs text-muted">
          {punch.place ?? "No place"}
          {punch.faceOk ? " \u00b7 Face locked" : punch.face ? " \u00b7 Photo only" : ""}
          {punch.note ? ` \u00b7 ${punch.note}` : ""}
        </p>
        <p className="text-xs text-muted">{formatShortDate(ymd(new Date(punch.at)))}</p>
      </div>
      <button type="button" aria-label="Remove punch" onClick={onRemove} className="grid size-11 place-items-center text-muted">
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}
