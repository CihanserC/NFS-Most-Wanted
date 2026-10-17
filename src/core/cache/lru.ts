/**
 * Sınırlı boyutlu (LRU) parametre -> sonuç önbelleği. Kaydırıcıyla çok sayıda varyant
 * üretildiğinde bellek büyümesin diye en eski kullanılan girdi atılır ve onEvict çağrılır
 * (ör. geometry.dispose). Hâlâ sahnede olan bir geometri atılırsa three onu bir sonraki
 * çizimde yeniden yükler; yani atmak güvenlidir, sadece maliyetlidir.
 */
export function lruMemoize<A extends unknown[], R>(
  keyOf: (...args: A) => string,
  build: (...args: A) => R,
  options: { max: number; onEvict?: (value: R) => void },
): ((...args: A) => R) & { cache: Map<string, R>; builds: () => number } {
  const cache = new Map<string, R>();
  let builds = 0;
  const fn = (...args: A): R => {
    const key = keyOf(...args);
    const hit = cache.get(key);
    if (hit !== undefined) {
      // Map ekleme sırasını korur: sona taşı = en son kullanılan.
      cache.delete(key);
      cache.set(key, hit);
      return hit;
    }
    const value = build(...args);
    builds++;
    cache.set(key, value);
    while (cache.size > options.max) {
      const oldestKey = cache.keys().next().value as string;
      const oldest = cache.get(oldestKey) as R;
      cache.delete(oldestKey);
      options.onEvict?.(oldest);
    }
    return value;
  };
  return Object.assign(fn, { cache, builds: () => builds });
}
