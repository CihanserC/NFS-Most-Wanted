/** Garajdaki bir kayıt slotu: build + küçük önizleme görseli. */
export type GarageSlot = {
  id: string;
  name: string;
  updatedAt: string;
  carId: string;
  /** data: URL (JPEG), yoksa null */
  thumbnail: string | null;
  /** Serileştirilmiş BuildState (JSON metni; yüklerken migration + doğrulama yapılır) */
  json: string;
};

/** Kalıcı depolama arayüzü: IndexedDB gerçeklemesi + bellek yedeği (erişim yoksa). */
export interface GarageStorage {
  readonly kind: 'indexeddb' | 'memory';
  listSlots(): Promise<GarageSlot[]>;
  getSlot(id: string): Promise<GarageSlot | null>;
  putSlot(slot: GarageSlot): Promise<void>;
  removeSlot(id: string): Promise<void>;
  getMeta<T = unknown>(key: string): Promise<T | null>;
  setMeta(key: string, value: unknown): Promise<void>;
}

const DB_NAME = 'muscle-garage';
const DB_VERSION = 1;
const SLOTS = 'slots';
const META = 'meta';

const promisify = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB isteği başarısız'));
  });

const done = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB işlemi başarısız'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB işlemi iptal edildi'));
  });

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SLOTS)) db.createObjectStore(SLOTS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB açılamadı'));
    request.onblocked = () => reject(new Error('IndexedDB başka bir sekme tarafından engellendi'));
  });
}

const isSlot = (v: unknown): v is GarageSlot =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as GarageSlot).id === 'string' &&
  typeof (v as GarageSlot).json === 'string' &&
  typeof (v as GarageSlot).name === 'string';

/** Tarayıcı IndexedDB'si üzerinde kalıcı garaj. Veritabanı ilk kullanımda açılır. */
export function createIdbStorage(factory: IDBFactory): GarageStorage {
  let db: Promise<IDBDatabase> | null = null;
  const open = () => (db ??= openDatabase(factory));
  return {
    kind: 'indexeddb',
    async listSlots() {
      const database = await open();
      const all = await promisify(database.transaction(SLOTS).objectStore(SLOTS).getAll());
      return (all as unknown[]).filter(isSlot);
    },
    async getSlot(id) {
      const database = await open();
      const value = await promisify(database.transaction(SLOTS).objectStore(SLOTS).get(id));
      return isSlot(value) ? value : null;
    },
    async putSlot(slot) {
      const database = await open();
      const tx = database.transaction(SLOTS, 'readwrite');
      tx.objectStore(SLOTS).put(slot);
      await done(tx);
    },
    async removeSlot(id) {
      const database = await open();
      const tx = database.transaction(SLOTS, 'readwrite');
      tx.objectStore(SLOTS).delete(id);
      await done(tx);
    },
    async getMeta<T>(key: string) {
      const database = await open();
      const value = await promisify(database.transaction(META).objectStore(META).get(key));
      return (value ?? null) as T | null;
    },
    async setMeta(key, value) {
      const database = await open();
      const tx = database.transaction(META, 'readwrite');
      tx.objectStore(META).put(value, key);
      await done(tx);
    },
  };
}

/** Yedek: bu oturumla sınırlı bellek içi depo (IndexedDB yoksa/çalışmıyorsa). */
export function createMemoryStorage(): GarageStorage {
  const slots = new Map<string, GarageSlot>();
  const meta = new Map<string, unknown>();
  return {
    kind: 'memory',
    listSlots: () => Promise.resolve([...slots.values()].map((s) => ({ ...s }))),
    getSlot: (id) => Promise.resolve(slots.has(id) ? { ...(slots.get(id) as GarageSlot) } : null),
    putSlot: (slot) => {
      slots.set(slot.id, { ...slot });
      return Promise.resolve();
    },
    removeSlot: (id) => {
      slots.delete(id);
      return Promise.resolve();
    },
    getMeta: <T>(key: string) => Promise.resolve((meta.get(key) ?? null) as T | null),
    setMeta: (key, value) => {
      meta.set(key, structuredClone(value));
      return Promise.resolve();
    },
  };
}

/** IndexedDB varsa onu, yoksa/açılamazsa bellek yedeğini döndürür. */
export async function openGarageStorage(
  factory: IDBFactory | undefined = typeof indexedDB === 'undefined' ? undefined : indexedDB,
): Promise<GarageStorage> {
  if (!factory) return createMemoryStorage();
  try {
    const storage = createIdbStorage(factory);
    // Açılabildiğini ve yazılabildiğini doğrula (gizli pencerelerde başarısız olabilir).
    await storage.setMeta('probe', Date.now());
    return storage;
  } catch (error) {
    console.warn('[Garage] IndexedDB kullanılamıyor, kayıtlar bu oturumla sınırlı:', error);
    return createMemoryStorage();
  }
}
