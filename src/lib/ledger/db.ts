import { loadOrCreateKey, open, seal } from "./crypto";

/**
 * The local memory ledger.
 *
 * Every signal the reader generates — which verses they lingered on, which
 * words they looked up, where they went next — is written here, sealed, and
 * read back only by this device to shape what it shows them. There is no
 * sync, no endpoint, no identifier.
 */

const DB_NAME = "celestial-mushaf-ledger";
const DB_VERSION = 1;
const EVENTS = "events";
const KEYS = "keys";

export type LedgerEventKind =
  | "verse-dwell"
  | "word-lookup"
  | "page-view"
  | "recitation"
  | "bookmark"
  | "constellation"
  | "reflection";

export interface LedgerEvent {
  kind: LedgerEventKind;
  at: number;
  page: number;
  verseKey?: string;
  /** Milliseconds of attention, for dwell events. */
  dwellMs?: number;
  /** Arabic root, for lookups. */
  root?: string;
  note?: string;
}

/** Rows older than this fall out of the ledger on the next compaction. */
const RETENTION_DAYS = 400;
const MAX_EVENTS = 20_000;

export class Ledger {
  private constructor(
    private db: IDBDatabase,
    private key: CryptoKey,
  ) {}

  static async open(): Promise<Ledger | null> {
    if (typeof indexedDB === "undefined") return null;
    try {
      const db = await openDatabase();
      const key = await loadOrCreateKey(db);
      const ledger = new Ledger(db, key);
      void ledger.compact();
      return ledger;
    } catch {
      // Private browsing, blocked storage, or a quota refusal. The reader
      // still works; it simply does not remember.
      return null;
    }
  }

  async record(event: LedgerEvent): Promise<void> {
    const sealed = await seal(this.key, event);
    await new Promise<void>((resolve, reject) => {
      const transaction = this.db.transaction(EVENTS, "readwrite");
      // `at` stays in the clear so the store can be indexed and compacted
      // without decrypting every row. A bare timestamp says nothing about
      // what was read.
      transaction.objectStore(EVENTS).add({ at: event.at, sealed });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async read(since = 0): Promise<LedgerEvent[]> {
    const rows = await new Promise<{ at: number; sealed: ArrayBuffer }[]>(
      (resolve, reject) => {
        const request = this.db
          .transaction(EVENTS, "readonly")
          .objectStore(EVENTS)
          .index("at")
          .getAll(IDBKeyRange.lowerBound(since));
        request.onsuccess = () => resolve(request.result ?? []);
        request.onerror = () => reject(request.error);
      },
    );

    const events = await Promise.all(rows.map((row) => open<LedgerEvent>(this.key, row.sealed)));
    return events.filter((event): event is LedgerEvent => event !== null);
  }

  /** Forget everything, immediately and irreversibly. */
  async clear(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const transaction = this.db.transaction(EVENTS, "readwrite");
      transaction.objectStore(EVENTS).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async count(): Promise<number> {
    return new Promise((resolve) => {
      const request = this.db.transaction(EVENTS, "readonly").objectStore(EVENTS).count();
      request.onsuccess = () => resolve(request.result ?? 0);
      request.onerror = () => resolve(0);
    });
  }

  /** Drop rows past the retention window, oldest first if still over budget. */
  private async compact(): Promise<void> {
    const cutoff = Date.now() - RETENTION_DAYS * 86_400_000;
    await new Promise<void>((resolve) => {
      const transaction = this.db.transaction(EVENTS, "readwrite");
      const store = transaction.objectStore(EVENTS);
      store.index("at").openCursor(IDBKeyRange.upperBound(cutoff)).onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (!cursor) return;
        cursor.delete();
        cursor.continue();
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });

    const total = await this.count();
    if (total <= MAX_EVENTS) return;

    let toDrop = total - MAX_EVENTS;
    await new Promise<void>((resolve) => {
      const transaction = this.db.transaction(EVENTS, "readwrite");
      transaction.objectStore(EVENTS).index("at").openCursor().onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (!cursor || toDrop <= 0) return;
        cursor.delete();
        toDrop -= 1;
        cursor.continue();
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(EVENTS)) {
        const store = db.createObjectStore(EVENTS, { keyPath: "id", autoIncrement: true });
        store.createIndex("at", "at");
      }
      if (!db.objectStoreNames.contains(KEYS)) {
        db.createObjectStore(KEYS, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("ledger blocked by another tab"));
  });
}
