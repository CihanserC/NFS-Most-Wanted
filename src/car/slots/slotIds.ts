/**
 * Prosedürel çizimi olan slotlar. registry.tsx bu listedeki her slot için bir
 * bileşen tanımlamak zorundadır (TypeScript bunu zorlar); testler de manifestteki
 * her slotun burada olduğunu doğrular.
 */
export const RENDERED_SLOT_IDS = [
  'bumper_front',
  'bumper_rear',
  'grille',
  'chin_spoiler',
  'hood',
  'side_skirts',
  'fenders',
  'spoiler_rear',
  'rear_louvers',
  'roof',
  'mirrors',
  'headlights',
  'taillights',
  'exhaust',
  'exhaust_tips',
  'fuel_cap',
  'engine',
  'interior',
] as const;

export type RenderedSlotId = (typeof RENDERED_SLOT_IDS)[number];

export const isRenderedSlot = (id: string): id is RenderedSlotId =>
  (RENDERED_SLOT_IDS as readonly string[]).includes(id);
