import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { HoursChart } from "@/components/hours-chart";
import { useClock } from "@/components/use-clock";
import { Button, Card } from "@/components/ui";
import { useAttendance } from "@/lib/attendance/store";
import {
  dayMarks,
  formatDuration,
  minutesByDay,
  monthDates,
  shiftMinutes,
  sumRange,
  weekDates,
  ymd,
} from "@/lib/attendance/time";

export const Route = createFileRoute("/hours")({
  component: HoursPage,
  head: () => ({ meta: [{ title: "Hours - Daymark" }] }),
});

const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function HoursPage() {
  const punches = useAttendance((state) => state.punches);
  const shifts = useAttendance((state) => state.shifts);
  const requests = useAttendance((state) => state.requests);
  const dayMinutes = useAttendance((state) => state.profile.dayMinutes);
  const loadSample = useAttendance((state) => state.loadSample);
  const now = useClock();

  const map = minutesByDay(punches, now);
  const week = now ? weekDates(now) : [];
  const weekKeys = week.map((day) => ymd(day));
  const monthKeys = now ? monthDates(now) : [];
  const weekTotal = sumRange(map, weekKeys);
  const monthTotal = sumRange(map, monthKeys);
  const todayTotal = now ? (map.get(ymd(now)) ?? 0) : 0;
  const presentDays = monthKeys.filter((date) => (map.get(date) ?? 0) > 0).length;

  let expected = 0;
  if (now) {
    for (const date of weekKeys) {
      const rostered = shifts.filter((shift) => shift.date === date);
      if (rostered.length > 0) expected += rostered.reduce((sum, shift) => sum + shiftMinutes(shift), 0);
      else if ((map.get(date) ?? 0) > 0) expected += dayMinutes;
    }
  }
  const overtime = Math.max(0, weekTotal - expected);
  const marks = now ? dayMarks(requests, weekKeys[0] ?? "", weekKeys[6] ?? "") : new Map();
  const bars = weekKeys.map((date, index) => ({
    label: weekday[index] ?? "",
    hours: Math.round(((map.get(date) ?? 0) / 60) * 10) / 10,
  }));

  return (
    <AppShell>
      <h1 className="font-display text-4xl tracking-tight">Hours</h1>
      <p className="mt-1 text-sm text-muted">Worked time from clock-in and clock-out pairs. Check-ins do not add hours.</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Stat label="Today" value={now ? formatDuration(todayTotal) : "-"} />
        <Stat label="This week" value={now ? formatDuration(weekTotal) : "-"} hint={overtime > 0 ? `${formatDuration(overtime)} over roster` : undefined} />
        <Stat label="This month" value={now ? formatDuration(monthTotal) : "-"} />
        <Stat label="Days on site" value={now ? String(presentDays) : "-"} />
      </div>

      <Card className="mt-4">
        <h2 className="text-sm font-semibold">This week</h2>
        <div className="mt-3">
          <HoursChart data={bars} />
        </div>
        <ul className="mt-2 grid grid-cols-7 gap-1 text-center text-xs text-muted">
          {weekKeys.map((date) => {
            const mark = marks.get(date);
            return (
              <li key={date} className={mark === "leave" ? "text-gold" : mark === "absence" ? "text-clay" : ""}>
                {mark === "leave" ? "Leave" : mark === "absence" ? "Away" : (map.get(date) ?? 0) > 0 ? "Work" : "-"}
              </li>
            );
          })}
        </ul>
      </Card>

      {punches.length === 0 ? (
        <Card className="mt-4">
          <p className="text-sm text-muted">No punches yet. Clock in from Today, or load a sample week to see the summary.</p>
          <Button className="mt-3" variant="soft" onClick={() => void loadSample()}>
            Load a sample week
          </Button>
        </Card>
      ) : null}
    </AppShell>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl leading-none tabular-nums">{value}</p>
      {hint ? <p className="mt-2 text-xs text-gold">{hint}</p> : null}
    </Card>
  );
}
