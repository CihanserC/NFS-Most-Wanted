import type { CarManifest } from '../../core/manifest/types';

const ABSOLUTE = /^([a-z]+:)?\/\//i;

/**
 * Manifestteki model yolunu tam URL'ye çevirir. Yol `public/` köküne göredir
 * (ör. "assets/cars/vanta_stallion_70.glb"). Geliştirmede `?model=<yol>` ile geçici model denenebilir.
 * Model yoksa null: prosedürel placeholder çizilir.
 */
export function resolveModelUrl(
  manifest: Pick<CarManifest, 'model'>,
  search: string = typeof location === 'undefined' ? '' : location.search,
  base: string = import.meta.env.BASE_URL,
): string | null {
  const override = import.meta.env.DEV ? new URLSearchParams(search).get('model') : null;
  const path = override ?? manifest.model;
  if (!path) return null;
  return ABSOLUTE.test(path) ? path : `${base}${path.replace(/^\/+/, '')}`;
}
