/**
 * Parametre -> sonuç önbelleği. Prosedürel geometri üreticileri aynı parametrelerle
 * tekrar çağrıldığında aynı nesneyi döndürür.
 */
export function memoize<A extends unknown[], R>(
  keyOf: (...args: A) => string,
  build: (...args: A) => R,
): ((...args: A) => R) & { cache: Map<string, R> } {
  const cache = new Map<string, R>();
  const fn = (...args: A): R => {
    const key = keyOf(...args);
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const value = build(...args);
    cache.set(key, value);
    return value;
  };
  return Object.assign(fn, { cache });
}
