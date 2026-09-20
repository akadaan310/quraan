/**
 * At-rest encryption for the local reading ledger.
 *
 * What this does and does not give you, stated plainly, because the
 * difference matters:
 *
 *  - It does guarantee the ledger never leaves the device. Nothing in this
 *    module or its callers sends anything anywhere; there is no endpoint.
 *  - It does mean the records are unreadable to anything that dumps the
 *    origin's IndexedDB — devtools, a backup, another tab's casual poking,
 *    an extension reading storage.
 *  - It does not defend against script running on this origin. The key is
 *    non-extractable, so it cannot be copied out, but any code that can run
 *    here can ask the browser to decrypt with it. Same-origin script is
 *    inside the trust boundary, and no browser-side scheme changes that.
 *
 * So: this is real protection against storage inspection and accidental
 * exfiltration, not against a compromised page. The honest security property
 * is locality — the data has nowhere to go.
 */

const KEY_STORE = "keys";
const KEY_ID = "ledger-key";

export async function loadOrCreateKey(db: IDBDatabase): Promise<CryptoKey> {
  const existing = await readKey(db);
  if (existing) return existing;

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    // Non-extractable: the browser will use it but never hand it back, so it
    // cannot be read out of storage even by code on this origin.
    false,
    ["encrypt", "decrypt"],
  );
  await writeKey(db, key);
  return key;
}

function readKey(db: IDBDatabase): Promise<CryptoKey | null> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(KEY_STORE, "readonly").objectStore(KEY_STORE).get(KEY_ID);
    request.onsuccess = () => resolve((request.result?.key as CryptoKey) ?? null);
    request.onerror = () => reject(request.error);
  });
}

function writeKey(db: IDBDatabase, key: CryptoKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(KEY_STORE, "readwrite");
    transaction.objectStore(KEY_STORE).put({ id: KEY_ID, key });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function seal(key: CryptoKey, value: unknown): Promise<ArrayBuffer> {
  // A fresh 96-bit IV per record: reusing one under AES-GCM is catastrophic,
  // and records are written often enough that it would happen quickly.
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(value)),
  );

  const sealed = new Uint8Array(iv.length + ciphertext.byteLength);
  sealed.set(iv, 0);
  sealed.set(new Uint8Array(ciphertext), iv.length);
  return sealed.buffer;
}

export async function open<T>(key: CryptoKey, sealed: ArrayBuffer): Promise<T | null> {
  try {
    const bytes = new Uint8Array(sealed);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.subarray(0, 12) },
      key,
      bytes.subarray(12),
    );
    return JSON.parse(decoder.decode(plaintext)) as T;
  } catch {
    // A record that will not open is a record from a previous key — the user
    // cleared storage, or the key was regenerated. Drop it rather than
    // failing the read.
    return null;
  }
}
