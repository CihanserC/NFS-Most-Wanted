import { describe, expect, it } from 'vitest';
import { RENDERED_SLOT_IDS } from '../car/slots/slotIds';
import { hasTranslation, LOCALES, translationKeys } from '../i18n';
import { getCar } from './cars';
import categories from './ui/categories.json';

const { manifest } = getCar('vanta_stallion_70');
const slotIds = Object.keys(manifest.slots);

describe('veri tutarlılığı', () => {
  it('her manifest slotu tam olarak bir menü kategorisinde', () => {
    for (const id of slotIds)
      expect(
        categories.filter((c) => c.slots.includes(id)),
        id,
      ).toHaveLength(1);
  });

  it('kategoriler sadece var olan slotlara referans verir', () => {
    for (const c of categories)
      for (const id of c.slots) expect(slotIds, `${c.id}/${id}`).toContain(id);
  });

  it('her manifest slotunun prosedürel çizimi var', () => {
    for (const id of slotIds) expect(RENDERED_SLOT_IDS as readonly string[]).toContain(id);
  });

  it('İngilizce ve Türkçe sözlükler aynı anahtarları içerir (eksik çeviri yok)', () => {
    const en = new Set(translationKeys('en'));
    const tr = new Set(translationKeys('tr'));
    expect([...en].filter((k) => !tr.has(k))).toEqual([]);
    expect([...tr].filter((k) => !en.has(k))).toEqual([]);
  });

  it('tüm kategori, slot ve parça adlarının her dilde çevirisi var', () => {
    const keys = [
      ...categories.map((c) => `category.${c.id}`),
      ...slotIds.map((id) => `slot.${id}`),
      ...Object.entries(manifest.slots).flatMap(([id, s]) =>
        s.options.map((o) => `part.${id}.${o}`),
      ),
    ];
    for (const locale of LOCALES)
      expect(keys.filter((k) => !hasTranslation(k, locale))).toEqual([]);
  });
});
