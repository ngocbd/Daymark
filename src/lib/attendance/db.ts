import type { AttendanceRequest, Profile, Punch, Shift } from "@/lib/attendance/types";

const DB_NAME = "daymark";
const DB_VERSION = 1;

type StoreName = "punches" | "shifts" | "requests" | "meta";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("punches")) db.createObjectStore("punches", { keyPath: "id" });
      if (!db.objectStoreNames.contains("shifts")) db.createObjectStore("shifts", { keyPath: "id" });
      if (!db.objectStoreNames.contains("requests")) db.createObjectStore("requests", { keyPath: "id" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local database"));
  });
}

function wrap<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local database request failed"));
  });
}

async function txStore(name: StoreName, mode: IDBTransactionMode) {
  const db = await openDb();
  const tx = db.transaction(name, mode);
  return tx.objectStore(name);
}

export async function readAll(): Promise<{
  punches: Punch[];
  shifts: Shift[];
  requests: AttendanceRequest[];
  profile: Profile | null;
}> {
  const db = await openDb();
  const tx = db.transaction(["punches", "shifts", "requests", "meta"], "readonly");
  const [punches, shifts, requests, profileRow] = await Promise.all([
    wrap<Punch[]>(tx.objectStore("punches").getAll()),
    wrap<Shift[]>(tx.objectStore("shifts").getAll()),
    wrap<AttendanceRequest[]>(tx.objectStore("requests").getAll()),
    wrap<{ key: string; value: Profile } | undefined>(tx.objectStore("meta").get("profile")),
  ]);
  return {
    punches,
    shifts,
    requests,
    profile: profileRow?.value ?? null,
  };
}

export async function putRow(store: "punches", row: Punch): Promise<void>;
export async function putRow(store: "shifts", row: Shift): Promise<void>;
export async function putRow(store: "requests", row: AttendanceRequest): Promise<void>;
export async function putRow(store: StoreName, row: unknown): Promise<void> {
  const objectStore = await txStore(store, "readwrite");
  await wrap(objectStore.put(row));
}

export async function deleteRow(store: Exclude<StoreName, "meta">, id: string): Promise<void> {
  const objectStore = await txStore(store, "readwrite");
  await wrap(objectStore.delete(id));
}

export async function saveProfile(profile: Profile): Promise<void> {
  const objectStore = await txStore("meta", "readwrite");
  await wrap(objectStore.put({ key: "profile", value: profile }));
}

export async function replaceAll(data: {
  punches: Punch[];
  shifts: Shift[];
  requests: AttendanceRequest[];
  profile: Profile;
}): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["punches", "shifts", "requests", "meta"], "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save backup"));
    tx.objectStore("punches").clear();
    tx.objectStore("shifts").clear();
    tx.objectStore("requests").clear();
    for (const row of data.punches) tx.objectStore("punches").put(row);
    for (const row of data.shifts) tx.objectStore("shifts").put(row);
    for (const row of data.requests) tx.objectStore("requests").put(row);
    tx.objectStore("meta").put({ key: "profile", value: data.profile });
  });
}

export async function clearAll(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["punches", "shifts", "requests", "meta"], "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not erase local data"));
    tx.objectStore("punches").clear();
    tx.objectStore("shifts").clear();
    tx.objectStore("requests").clear();
    tx.objectStore("meta").clear();
  });
}
