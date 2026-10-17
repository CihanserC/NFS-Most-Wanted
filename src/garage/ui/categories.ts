import categoriesJson from '../../data/ui/categories.json';

export type MenuCategory = { id: string; slots: string[] };

export const menuCategories: MenuCategory[] = categoriesJson;

export const categoryOfSlot = (slotId: string): MenuCategory | undefined =>
  menuCategories.find((c) => c.slots.includes(slotId));
