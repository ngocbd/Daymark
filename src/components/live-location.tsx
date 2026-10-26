import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";

export type LiveFix = {
  status: "starting" | "live" | "denied" | "unavailable";
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  place: string | null;
  updatedAt: number | null;
};

const empty: LiveFix = {
  status: "starting",
  lat: null,
  lng: null,
  accuracy: null,
  place: null,
  updatedAt: null,
};

async function lookupPlace(lat: number, lng: number): Promise<string | null> {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = (await response.json()) as {
    locality?: string;
    city?: string;
    principalSubdivision?: string;
    countryName?: string;
  };
  const parts = [data.locality, data.city, data.principalSubdivision].filter(
    (part, index, all) => part && all.indexOf(part) === index,
  );
  if (parts.length === 0 && data.countryName) return data.countryName;
  return parts.slice(0, 2).join(", ") || null;
}

export function useLiveLocation(): LiveFix {
  const [fix, setFix] = useState<LiveFix>(empty);

  useEffect(() => {
    if (!navigator.geolocation) {
      setFix({ ...empty, status: "unavailable" });
      return;
    }
    let lastLookup = "";
    const giveUp = window.setTimeout(() => {
      setFix((current) => (current.status === "starting" ? { ...current, status: "unavailable" } : current));
    }, 8000);
    const id = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        setFix((current) => ({
          status: "live",
          lat,
          lng,
          accuracy,
          place: current.place,
          updatedAt: Date.now(),
        }));
        const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
        if (key === lastLookup) return;
        lastLookup = key;
        void lookupPlace(lat, lng)
          .then((place) => {
            if (!place) return;
            setFix((current) => (current.lat == null ? current : { ...current, place }));
          })
          .catch(() => {
            /* coordinates still stand without a place name */
          });
      },
      (error) => {
        setFix({
          ...empty,
          status: error.code === error.PERMISSION_DENIED ? "denied" : "unavailable",
        });
      },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 12000 },
    );
    return () => {
      window.clearTimeout(giveUp);
      navigator.geolocation.clearWatch(id);
    };
  }, []);

  return fix;
}

function ring(accuracy: number | null) {
  if (accuracy == null) return 18;
  if (accuracy <= 15) return 92;
  if (accuracy <= 40) return 70;
  if (accuracy <= 100) return 46;
  return 24;
}

export function LiveLocation({ fix }: { fix: LiveFix }) {
  const mapHref =
    fix.lat != null && fix.lng != null
      ? `https://www.openstreetmap.org/?mlat=${fix.lat}&mlon=${fix.lng}#map=17/${fix.lat}/${fix.lng}`
      : null;
  const dash = ring(fix.accuracy);

  return (
    <section className="flex h-full flex-col rounded-card bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Live location</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
          <span
            className={`size-2 rounded-full ${fix.status === "live" ? "bg-primary" : "bg-line"}`}
            aria-hidden="true"
          />
          {fix.status === "live" ? "Live" : fix.status === "starting" ? "Searching" : "No fix"}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <svg viewBox="0 0 72 72" className="size-16 shrink-0" aria-hidden="true">
          <circle cx="36" cy="36" r="28" fill="none" stroke="var(--color-line)" strokeWidth="6" />
          <circle
            cx="36"
            cy="36"
            r="28"
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${dash} 200`}
            transform="rotate(-90 36 36)"
          />
          <circle cx="36" cy="36" r="4" fill="var(--color-primary)" />
        </svg>
        <div className="min-w-0">
          {fix.status === "live" && fix.lat != null && fix.lng != null ? (
            <>
              <p className="truncate text-base font-semibold">{fix.place ?? "Locating place name\u2026"}</p>
              <p className="mt-1 font-mono text-xs tabular-nums text-muted">
                {fix.lat.toFixed(5)}, {fix.lng.toFixed(5)}
              </p>
              <p className="mt-1 text-xs text-muted">
                Accuracy {fix.accuracy != null ? `\u00b1${Math.round(fix.accuracy)} m` : "unknown"}
              </p>
            </>
          ) : (
            <>
              <p className="text-base font-semibold">
                {fix.status === "denied" ? "Location is blocked" : fix.status === "starting" ? "Waiting for a fix" : "Location unavailable"}
              </p>
              <p className="mt-1 text-sm text-muted">
                {fix.status === "denied"
                  ? "Allow location to stamp where this punch happened, or type a site below."
                  : "A site name still saves with the punch if GPS stays quiet."}
              </p>
            </>
          )}
        </div>
      </div>

      {mapHref ? (
        <a
          href={mapHref}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary"
        >
          Open this fix on the map
        </a>
      ) : (
        <p className="mt-4 text-xs text-muted">Updates while this screen is open.</p>
      )}
    </section>
  );
}
