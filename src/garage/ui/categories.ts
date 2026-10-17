import categoriesJson from '../../data/ui/categories.json';

/** parts: slot -> seçenek listesi · paint: boya bölgesi -> boya editörü */
export type MenuCategoryKind = 'parts' | 'paint';
export type MenuCategory = { id: string; kind: MenuCategoryKind; slots: string[] };

export const menuCategories = categoriesJson as MenuCategory[];

export const isCategoryEnabled = (c: MenuCategory) => c.kind === 'paint' || c.slots.length > 0;
