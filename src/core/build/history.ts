/** Saf, değişmez (immutable) undo/redo geçmişi. */
export type History<T> = { past: T[]; future: T[] };

export const DEFAULT_HISTORY_LIMIT = 100;

export const emptyHistory = <T>(): History<T> => ({ past: [], future: [] });

/** Yeni bir değişiklik yapılmadan önceki durumu kaydeder; redo yığını temizlenir. */
export function record<T>(h: History<T>, previous: T, limit = DEFAULT_HISTORY_LIMIT): History<T> {
  const past = [...h.past, previous];
  return { past: past.length > limit ? past.slice(past.length - limit) : past, future: [] };
}

export function undo<T>(h: History<T>, present: T): { history: History<T>; present: T } | null {
  const previous = h.past[h.past.length - 1];
  if (previous === undefined) return null;
  return {
    history: { past: h.past.slice(0, -1), future: [present, ...h.future] },
    present: previous,
  };
}

export function redo<T>(h: History<T>, present: T): { history: History<T>; present: T } | null {
  const [next, ...rest] = h.future;
  if (next === undefined) return null;
  return { history: { past: [...h.past, present], future: rest }, present: next };
}
