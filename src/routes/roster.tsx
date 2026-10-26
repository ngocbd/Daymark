import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useClock } from "@/components/use-clock";
import { Button, Card, Field, TextInput } from "@/components/ui";
import { useAttendance } from "@/lib/attendance/store";
import {
  addDays,
  formatShortDate,
  shiftMinutes,
  shiftStanding,
  startOfWeek,
  weekDates,
  ymd,
} from "@/lib/attendance/time";

export const Route = createFileRoute("/roster")({
  component: RosterPage,
  head: () => ({ meta: [{ title: "Roster - Daymark" }] }),
});

const standingCopy = {
  upcoming: "Upcoming",
  due: "Due today",
  "on-time": "On time",
  late: "Late",
  missed: "Missed",
  open: "In progress",
} as const;

function RosterPage() {
  const shifts = useAttendance((state) => state.shifts);
  const punches = useAttendance((state) => state.punches);
  const addShift = useAttendance((state) => state.addShift);
  const removeShift = useAttendance((state) => state.removeShift);
  const now = useClock();
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [site, setSite] = useState("");
  const [label, setLabel] = useState("On site");
  const [error, setError] = useState("");

  const anchor = now ? addDays(startOfWeek(now), offset * 7) : null;
  const days = anchor ? weekDates(anchor) : [];
  const keys = days.map((day) => ymd(day));
  const visible = shifts
    .filter((shift) => keys.includes(shift.date))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const today = now ? ymd(now) : "";

  function submit() {
    if (!date) {
      setError("Pick a date.");
      return;
    }
    if (end <= start) {
      setError("End time has to be after the start. Overnight shifts aren't in this roster.");
      return;
    }
    setError("");
    void addShift({ date, start, end, site: site.trim(), label: label.trim() || "Shift", note: "" });
    setOpen(false);
    setSite("");
  }

  return (
    <AppShell>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl tracking-tight">Roster</h1>
          <p className="mt-1 text-sm text-muted">
            {anchor ? `${formatShortDate(ymd(days[0]!))} - ${formatShortDate(ymd(days[6]!))}` : "This week"}
          </p>
        </div>
        <div className="flex gap-1">
          <button type="button" aria-label="Previous week" className="grid size-11 place-items-center rounded-full bg-surface shadow-card" onClick={() => setOffset((n) => n - 1)}>
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" aria-label="Next week" className="grid size-11 place-items-center rounded-full bg-surface shadow-card" onClick={() => setOffset((n) => n + 1)}>
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      <Button className="mt-4" variant={open ? "ghost" : "primary"} onClick={() => setOpen((value) => !value)}>
        {open ? "Close" : "Add shift"}
      </Button>

      {open ? (
        <Card className="mt-3 grid gap-3">
          <Field label="Date">
            <TextInput type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <TextInput type="time" value={start} onChange={(event) => setStart(event.target.value)} />
            </Field>
            <Field label="End">
              <TextInput type="time" value={end} onChange={(event) => setEnd(event.target.value)} />
            </Field>
          </div>
          <Field label="Site">
            <TextInput value={site} placeholder="Head office" onChange={(event) => setSite(event.target.value)} />
          </Field>
          <Field label="Label">
            <TextInput value={label} onChange={(event) => setLabel(event.target.value)} />
          </Field>
          {error ? <p className="text-sm text-clay">{error}</p> : null}
          <Button onClick={submit}>Save shift</Button>
        </Card>
      ) : null}

      {now == null ? (
        <p className="mt-6 text-sm text-muted">Reading this device...</p>
      ) : visible.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No shifts this week. Add one, or approve a shift or on-site request.</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {visible.map((shift) => {
            const standing = shiftStanding(shift, punches, today);
            const tone =
              standing.standing === "late" || standing.standing === "missed"
                ? "text-clay"
                : standing.standing === "on-time" || standing.standing === "open"
                  ? "text-primary"
                  : "text-muted";
            return (
              <li key={shift.id} className="flex items-center gap-3 rounded-card bg-surface p-4 shadow-card">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {formatShortDate(shift.date)} | {shift.start}-{shift.end}
                  </p>
                  <p className="truncate text-sm text-muted">
                    {shift.label}
                    {shift.site ? ` | ${shift.site}` : ""} | {formatDurationSafe(shiftMinutes(shift))}
                  </p>
                  <p className={`text-xs font-medium ${tone}`}>
                    {standingCopy[standing.standing]}
                    {standing.standing === "late" ? ` ${standing.late}m` : ""}
                  </p>
                </div>
                <button type="button" aria-label="Remove shift" className="grid size-11 place-items-center text-muted" onClick={() => void removeShift(shift.id)}>
                  <Trash2 className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}

function formatDurationSafe(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
