import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, CalendarDays, ClipboardList, Clock, Download, Settings, Trash2, Upload } from "lucide-react";
import { Button, Field, SelectInput, TextInput } from "@/components/ui";
import { parseBackup, useAttendance } from "@/lib/attendance/store";
import { isClockedIn } from "@/lib/attendance/time";
import { cn } from "@/lib/cn";

const tabs = [
  { to: "/", label: "Today", icon: Clock },
  { to: "/hours", label: "Hours", icon: BarChart3 },
  { to: "/roster", label: "Roster", icon: CalendarDays },
  { to: "/requests", label: "Requests", icon: ClipboardList },
] as const;

function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
      <rect width="32" height="32" rx="10" fill="var(--color-primary)" />
      <circle cx="16" cy="16" r="7" fill="none" stroke="var(--color-on-primary)" strokeWidth="2" />
      <path d="M16 11.5V16l2.8 1.8" fill="none" stroke="var(--color-on-primary)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const hydrate = useAttendance((state) => state.hydrate);
  const profile = useAttendance((state) => state.profile);
  const setProfile = useAttendance((state) => state.setProfile);
  const punches = useAttendance((state) => state.punches);
  const shifts = useAttendance((state) => state.shifts);
  const requests = useAttendance((state) => state.requests);
  const storageBlocked = useAttendance((state) => state.storageBlocked);
  const loadSample = useAttendance((state) => state.loadSample);
  const importBackup = useAttendance((state) => state.importBackup);
  const eraseAll = useAttendance((state) => state.eraseAll);
  const [open, setOpen] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const onShift = isClockedIn(punches);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  function exportLog() {
    const blob = new Blob(
      [JSON.stringify({ version: 1, profile, punches, shifts, requests }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "daymark-backup.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-dvh bg-paper text-ink">
      {onShift ? <div className="h-1 bg-primary" /> : <div className="h-1 bg-transparent" />}
      <header className="sticky top-0 z-20 border-b border-line/80 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Mark />
            <div>
              <p className="font-display text-xl leading-none">Daymark</p>
              <p className="mt-1 text-xs text-muted">{profile.name.trim() || "On this device only"}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Settings"
            onClick={() => {
              setConfirmErase(false);
              setOpen(true);
            }}
            className="grid size-11 place-items-center rounded-full text-ink"
          >
            <Settings className="size-5" />
          </button>
        </div>
      </header>

      {storageBlocked ? (
        <p className="mx-auto max-w-3xl px-4 pt-3 text-sm text-clay">
          This browser blocked local storage. Punches stay in memory until you reload.
        </p>
      ) : null}

      <main className="mx-auto w-full max-w-3xl px-4 pt-5 pb-28">{children}</main>

      <nav className="dock fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur" aria-label="Primary">
        <ul className="mx-auto grid max-w-3xl grid-cols-4">
          {tabs.map((tab) => {
            const active = tab.to === "/" ? pathname === "/" : pathname.startsWith(tab.to);
            const Icon = tab.icon;
            return (
              <li key={tab.to}>
                <Link
                  to={tab.to}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium",
                    active ? "text-primary" : "text-muted",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {open ? (
        <div className="fixed inset-0 z-40 grid items-end bg-ink/40 sm:items-center sm:px-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            className="max-h-[88dvh] w-full overflow-y-auto rounded-t-card bg-surface p-5 shadow-dock sm:mx-auto sm:max-w-md sm:rounded-card"
          >
            <div className="flex items-center justify-between">
              <h2 id="settings-title" className="font-display text-2xl">
                This device
              </h2>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
            <p className="mt-1 text-sm text-muted">
              Clock-ins, photos, shifts, and requests are saved in this browser. They are not uploaded.
            </p>

            <div className="mt-5 grid gap-4">
              <Field label="Your name" hint="Printed on this log only.">
                <TextInput
                  value={profile.name}
                  placeholder="Alex Rivera"
                  onChange={(event) => void setProfile({ name: event.target.value })}
                />
              </Field>
              <Field label="Standard day" hint="Used when a day has no rostered shift.">
                <SelectInput
                  value={String(profile.dayMinutes)}
                  onChange={(event) => void setProfile({ dayMinutes: Number(event.target.value) })}
                >
                  <option value={420}>7 hours</option>
                  <option value={480}>8 hours</option>
                  <option value={540}>9 hours</option>
                </SelectInput>
              </Field>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="line" onClick={() => void loadSample()}>
                  Load a sample week
                </Button>
                <Button variant="line" onClick={exportLog}>
                  <Download className="size-4" aria-hidden="true" />
                  Export backup
                </Button>
                <Button variant="line" onClick={() => fileRef.current?.click()}>
                  <Upload className="size-4" aria-hidden="true" />
                  Import backup
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    void file.text().then((text) => {
                      try {
                        const backup = parseBackup(JSON.parse(text) as unknown);
                        if (!backup) return;
                        void importBackup(backup);
                      } catch {
                        /* leave the current log untouched */
                      }
                    });
                  }}
                />
              </div>
              {confirmErase ? (
                <div className="rounded-2xl bg-clay-soft p-3">
                  <p className="text-sm text-clay">Erase every punch, shift, and request on this device?</p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="clay"
                      onClick={() => {
                        void eraseAll();
                        setConfirmErase(false);
                        setOpen(false);
                      }}
                    >
                      Erase
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmErase(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="ghost" className="text-clay" onClick={() => setConfirmErase(true)}>
                  <Trash2 className="size-4" aria-hidden="true" />
                  Erase local log
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
