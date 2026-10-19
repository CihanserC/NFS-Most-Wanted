import { create } from 'zustand';
import { en } from './en';
import { tr } from './tr';

export const LOCALES = ['en', 'tr'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

const dictionaries: Record<Locale, Record<string, string>> = { en, tr };

/** Dil seçimi tarayıcıda saklanır (oyun ayarı; kayıtlı projelerden bağımsız). */
export const LOCALE_STORAGE_KEY = 'muscle-garage.locale';

/** Dilin kendi adıyla etiketi (seçim listesinde dil değişse de okunabilsin). */
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', tr: 'Türkçe' };

/** Sayı/tarih biçimleri için BCP 47 etiketi */
const LOCALE_TAGS: Record<Locale, string> = { en: 'en-US', tr: 'tr-TR' };

const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale);

function readStoredLocale(): Locale {
  try {
    const v = globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY);
    return isLocale(v) ? v : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

type LocaleState = { locale: Locale; setLocale: (locale: Locale) => void };

/**
 * Etkin dil. Arayüz kökü bu store'a abone olur; dil değişince tüm metinler yeniden çizilir.
 * `t()` her çağrıda güncel dili okur (React dışı kod da doğru dili kullanır).
 */
export const useLocaleStore = create<LocaleState>()((set) => ({
  locale: readStoredLocale(),
  setLocale: (locale) => {
    try {
      globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // Depolama kapalıysa seçim yalnız bu oturumda geçerli
    }
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
    set({ locale });
  },
}));

export const getLocale = (): Locale => useLocaleStore.getState().locale;
export const setLocale = (locale: Locale): void => useLocaleStore.getState().setLocale(locale);
/** React bileşeni için: dil değişince yeniden çizilir. */
export const useLocale = (): Locale => useLocaleStore((s) => s.locale);

export function hasTranslation(key: string, locale: Locale = getLocale()): boolean {
  return key in dictionaries[locale];
}

/** Sözlükteki tüm anahtarlar (testler: iki dil eşit kapsamlı olmalı). */
export const translationKeys = (locale: Locale): string[] => Object.keys(dictionaries[locale]);

/**
 * Çeviri; `{ad}` yer tutucuları params ile doldurulur. Etkin dilde yoksa İngilizceye, o da yoksa
 * anahtarın kendisine düşer (eksikler ekranda göze batsın).
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const text = dictionaries[getLocale()][key] ?? dictionaries.en[key] ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m,
  );
}

/** Etkin dilde sayı (binlik ayraçlı). */
export const formatNumber = (n: number, options?: Intl.NumberFormatOptions): string =>
  n.toLocaleString(LOCALE_TAGS[getLocale()], options);

/** Yüzde: İngilizcede "50%", Türkçede "%50". */
export const formatPercent = (fraction: number): string =>
  getLocale() === 'tr' ? `%${Math.round(fraction * 100)}` : `${Math.round(fraction * 100)}%`;

export const formatDate = (date: Date, options: Intl.DateTimeFormatOptions): string =>
  date.toLocaleString(LOCALE_TAGS[getLocale()], options);

/** Dile duyarlı büyük harf (Türkçede i -> İ; İngilizcede i -> I). */
export const toUpperLocale = (text: string): string =>
  text.toLocaleUpperCase(LOCALE_TAGS[getLocale()]);

export const slotLabel = (slotId: string) => t(`slot.${slotId}`);
export const partLabel = (slotId: string, optionId: string) => t(`part.${slotId}.${optionId}`);
export const categoryLabel = (categoryId: string) => t(`category.${categoryId}`);
