import { openDB, type IDBPDatabase } from "idb";
import type { EventLogRecord, EventType, HistoryRecord } from "@/lib/types";

const DB_NAME = "pptx-checker";
const DB_VERSION = 1;
export const HISTORY_LIMIT = 200;
export const EVENT_LOG_LIMIT = 1000;

type CheckerDB = {
  history: {
    key: string;
    value: HistoryRecord;
    indexes: { filename: string };
  };
  settings: {
    key: string;
    value: unknown;
  };
  event_log: {
    key: number;
    value: EventLogRecord;
  };
};

let dbPromise: Promise<IDBPDatabase<CheckerDB> | null> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<CheckerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const history = db.createObjectStore("history", { keyPath: "id" });
        history.createIndex("filename", "filename");
        db.createObjectStore("settings");
        db.createObjectStore("event_log", { autoIncrement: true });
      },
    }).catch(() => null);
  }
  return dbPromise;
}

export async function getSetting<T>(key: string): Promise<T | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const value = await db.get("settings", key);
    return (value as T | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.put("settings", value, key);
  } catch {
    // IndexedDB is optional: the check flow continues without persistence.
  }
}

export async function historyKey(filename: string, createdAt: string) {
  const bytes = new TextEncoder().encode(`${filename}${createdAt}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export async function saveHistory(record: HistoryRecord): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.put("history", record);
    const all = await db.getAll("history");
    if (all.length <= HISTORY_LIMIT) return;
    const oldest = [...all].sort((a, b) =>
      a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
    );
    const extra = oldest.slice(0, all.length - HISTORY_LIMIT);
    const tx = db.transaction("history", "readwrite");
    await Promise.all(extra.map((item) => tx.store.delete(item.id)));
    await tx.done;
  } catch {
    // Persistence is best-effort.
  }
}

export async function logEvent(
  type: EventType,
  payload: Record<string, unknown> = {},
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.add("event_log", { ts: Date.now(), type, payload });
    const keys = await db.getAllKeys("event_log");
    if (keys.length <= EVENT_LOG_LIMIT) return;
    const oldest = [...keys]
      .map((key) => Number(key))
      .sort((a, b) => a - b)
      .slice(0, keys.length - EVENT_LOG_LIMIT);
    const tx = db.transaction("event_log", "readwrite");
    await Promise.all(oldest.map((key) => tx.store.delete(key)));
    await tx.done;
  } catch {
    // Persistence is best-effort.
  }
}
