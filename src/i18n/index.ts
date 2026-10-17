import { tr } from './tr';

export type Locale = 'tr';

const dictionaries: Record<Locale, Record<string, string>> = { tr };

let activeLocale: Locale = 'tr';

export function setLocale(locale: Locale): void {
  activeLocale = locale;
}

export function hasTranslation(key: string, locale: Locale = activeLocale): boolean {
  return key in dictionaries[locale];
}

/** Çeviri bulunamazsa anahtarın kendisini döndürür ki eksikler ekranda göze batsın. */
export function t(key: string): string {
  return dictionaries[activeLocale][key] ?? key;
}

export const slotLabel = (slotId: string) => t(`slot.${slotId}`);
export const partLabel = (slotId: string, optionId: string) => t(`part.${slotId}.${optionId}`);
export const categoryLabel = (categoryId: string) => t(`category.${categoryId}`);
