import categoriesJson from '../../data/ui/categories.json';

/** parts: slot -> seçenek listesi · paint: boya bölgesi -> boya editörü · wheels: jant editörü · vinyl: vinil editörü · stance: duruş editörü · look: ışıklar & camlar editörü */
export type MenuCategoryKind = 'parts' | 'paint' | 'wheels' | 'vinyl' | 'stance' | 'look';
export type MenuCategory = { id: string; kind: MenuCategoryKind; slots: string[] };

export const menuCategories = categoriesJson as MenuCategory[];

export const isCategoryEnabled = (c: MenuCategory) => c.kind !== 'parts' || c.slots.length > 0;

export const categoryKind = (id: string | null): MenuCategoryKind | null =>
  menuCategories.find((c) => c.id === id)?.kind ?? null;
