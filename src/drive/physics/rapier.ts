import RAPIER from '@dimforge/rapier3d-compat';

export type Rapier = typeof RAPIER;

let loading: Promise<Rapier> | null = null;

/** Rapier WASM'ı bir kez yükler (compat sürümü WASM'ı JS içine gömer, ayrı dosya gerekmez). */
export function loadRapier(): Promise<Rapier> {
  loading ??= RAPIER.init().then(() => RAPIER);
  return loading;
}
