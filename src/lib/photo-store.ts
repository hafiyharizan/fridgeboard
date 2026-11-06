/**
 * Idle slideshow photos live only on this device, in IndexedDB. Every
 * function resolves empty / no-op when IndexedDB is unavailable or throws.
 */

const DB_NAME = "fridgeboard";
const STORE = "photos";
export const MAX_PHOTOS = 30;
export const MAX_SIDE = 1920;
const JPEG_QUALITY = 0.85;

/** Size that fits inside max x max, keeping the aspect ratio (never enlarges). */
export function fitWithin(width: number, height: number, max: number) {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** How many of `incoming` photos fit under the cap given `existing` stored ones. */
export function roomForPhotos(existing: number, incoming: number) {
  const accepted = Math.max(0, Math.min(incoming, MAX_PHOTOS - existing));
  return { accepted, skipped: incoming - accepted };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no IndexedDB"));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function listPhotos(): Promise<Blob[]> {
  try {
    return await withStore<Blob[]>("readonly", (store) => store.getAll());
  } catch {
    return [];
  }
}

/** Downscale to MAX_SIDE with a canvas so a tablet's storage isn't filled. */
async function downscale(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_SIDE);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(bitmap, 0, 0, width, height);
      return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    } finally {
      bitmap.close();
    }
  } catch {
    return null; // Not a readable image (or HEIC the browser can't decode): skip it.
  }
}

export async function addPhotos(files: File[]): Promise<void> {
  try {
    const blobs: Blob[] = [];
    for (const file of files) {
      const blob = await downscale(file);
      if (blob) blobs.push(blob);
    }
    if (blobs.length === 0) return;
    const db = await openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        blobs.forEach((blob) => store.add(blob));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  } catch {
    // Storage unavailable or full: nothing added.
  }
}

export async function clearPhotos(): Promise<void> {
  try {
    await withStore("readwrite", (store) => store.clear());
  } catch {
    // Nothing to clear.
  }
}
