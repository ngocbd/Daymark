import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useClock } from "@/components/use-clock";
import { Button, Card, Field, Segmented, TextArea, TextInput } from "@/components/ui";
import { useAttendance } from "@/lib/attendance/store";
import type { RequestKind, RequestStatus } from "@/lib/attendance/types";
import { formatShortDate, formatTime } from "@/lib/attendance/time";

export const Route = createFileRoute("/requests")({
  component: RequestsPage,
  head: () => ({ meta: [{ title: "Requests - Daymark" }] }),
});

const kinds: { value: RequestKind; label: string }[] = [
  { value: "leave", label: "Leave" },
  { value: "absence", label: "Absence" },
  { value: "onsite", label: "On site" },
  { value: "shift", label: "Shift" },
];

const kindLabel: Record<RequestKind, string> = {
  leave: "Leave",
  absence: "Absence",
  onsite: "On site",
  shift: "Shift",
};

function RequestsPage() {
  const requests = useAttendance((state) => state.requests);
  const addRequest = useAttendance((state) => state.addRequest);
  const setRequestStatus = useAttendance((state) => state.setRequestStatus);
  const removeRequest = useAttendance((state) => state.removeRequest);
  const now = useClock();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<RequestKind | "all">("all");
  const [kind, setKind] = useState<RequestKind>("leave");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [site, setSite] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const shown = [...requests]
    .filter((request) => filter === "all" || request.kind === filter)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const timed = kind === "onsite" || kind === "shift";

  function submit() {
    if (!startDate) {
      setError("Choose a start date.");
      return;
    }
    const end = endDate || startDate;
    if (end < startDate) {
      setError("The end date can't be before the start.");
      return;
    }
    if (timed && endTime <= startTime) {
      setError("End time has to be after the start.");
      return;
    }
    if (!reason.trim()) {
      setError("Add a short reason.");
      return;
    }
    setError("");
    void addRequest({
      kind,
      startDate,
      endDate: end,
      startTime: timed ? startTime : "",
      endTime: timed ? endTime : "",
      site: site.trim(),
      reason: reason.trim(),
    });
    setOpen(false);
    setReason("");
    setSite("");
  }

  return (
    <AppShell>
      <h1 className="font-display text-4xl tracking-tight">Requests</h1>
      <p className="mt-1 text-sm text-muted">
        Leave, absence, on-site, and shift changes live on this device. Approving a shift or on-site request adds it to the roster.
      </p>

      <div className="mt-4">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[{ value: "all", label: "All" }, ...kinds]}
        />
      </div>

      <Button className="mt-4" variant={open ? "ghost" : "primary"} onClick={() => setOpen((value) => !value)}>
        {open ? "Close form" : "New request"}
      </Button>

      {open ? (
        <Card className="mt-3 grid gap-3">
          <Segmented value={kind} onChange={setKind} options={kinds} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              <TextInput type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </Field>
            <Field label="To">
              <TextInput type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </Field>
          </div>
          {timed ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start">
                <TextInput type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
              </Field>
              <Field label="End">
                <TextInput type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
              </Field>
            </div>
          ) : null}
          {timed ? (
            <Field label="Site">
              <TextInput value={site} placeholder="Where" onChange={(event) => setSite(event.target.value)} />
            </Field>
          ) : null}
          <Field label="Reason">
            <TextArea value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          {error ? <p className="text-sm text-clay">{error}</p> : null}
          <Button onClick={submit}>File request</Button>
        </Card>
      ) : null}

      {now == null ? (
        <p className="mt-6 text-sm text-muted">Reading this device...</p>
      ) : shown.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No requests in this view.</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {shown.map((request) => (
            <li key={request.id} className="rounded-card bg-surface p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {kindLabel[request.kind]} | {formatShortDate(request.startDate)}
                    {request.endDate !== request.startDate ? ` - ${formatShortDate(request.endDate)}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {request.startTime ? `${request.startTime}-${request.endTime}` : "All day"}
                    {request.site ? ` | ${request.site}` : ""}
                  </p>
                  <p className="mt-1 text-sm">{request.reason}</p>
                  <p className={`mt-2 text-xs font-semibold ${statusTone(request.status)}`}>
                    {request.status} | filed {formatTime(request.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Remove request"
                  className="grid size-11 place-items-center text-muted"
                  onClick={() => void removeRequest(request.id)}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              {request.status === "pending" ? (
                <div className="mt-3 flex gap-2">
                  <Button variant="soft" onClick={() => void setRequestStatus(request.id, "approved")}>
                    Approve
                  </Button>
                  <Button variant="line" onClick={() => void setRequestStatus(request.id, "declined")}>
                    Decline
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

function statusTone(status: RequestStatus) {
  if (status === "approved") return "text-primary";
  if (status === "declined") return "text-clay";
  return "text-gold";
}
