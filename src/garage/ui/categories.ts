import categoriesJson from '../../data/ui/categories.json';

/** parts: slot -> seçenek listesi · paint: boya bölgesi -> boya editörü · wheels: jant editörü · vinyl: vinil editörü · stance: duruş editörü · look: ışıklar & camlar editörü */
export type MenuCategoryKind =
  | 'parts'
  | 'paint'
  | 'wheels'
  | 'vinyl'
  | 'stance'
  | 'look'
  | 'performance'
  | 'drive'
  | 'garage'
  | 'photo';
export type MenuCategory = { id: string; kind: MenuCategoryKind; slots: string[] };

export const menuCategories = categoriesJson as MenuCategory[];

/** Parça kategorisi, araçta o slotlardan en az biri varsa etkin (Mustang'te motor/far gibi slotlar yok). */
export const isCategoryEnabled = (c: MenuCategory, slotIds?: readonly string[]) =>
  c.kind !== 'parts' || (slotIds ? c.slots.some((s) => slotIds.includes(s)) : c.slots.length > 0);

export const categoryKind = (id: string | null): MenuCategoryKind | null =>
  menuCategories.find((c) => c.id === id)?.kind ?? null;
