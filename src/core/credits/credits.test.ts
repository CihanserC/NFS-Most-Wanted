import { describe, expect, it } from 'vitest';
import creditsJson from '../../../public/assets/CREDITS.json';
import { validateCredits } from './credits';

const entry = {
  name: 'Örnek Model',
  author: 'Yapımcı',
  source: 'https://example.com/model',
  license: 'CC-BY-4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  usedFor: 'Gövde',
};

describe('CREDITS.json', () => {
  it('depodaki dosya geçerli (şimdilik boş)', () => {
    const result = validateCredits(creditsJson);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.assets).toHaveLength(0);
  });

  it('geçerli girdi kabul edilir', () => {
    expect(validateCredits({ version: 1, assets: [entry] }).ok).toBe(true);
    expect(validateCredits({ version: 1, assets: [{ ...entry, license: 'CC0' }] }).ok).toBe(true);
  });

  it('eksik alan, izin verilmeyen lisans ve geçersiz bağlantı hata verir', () => {
    const result = validateCredits({
      version: 1,
      assets: [
        { ...entry, author: '', license: 'CC-BY-NC-4.0' },
        { ...entry, source: 'dosya.txt' },
      ],
    });
    expect(result.ok).toBe(false);
    const errors = result.ok ? '' : result.errors.join('\n');
    expect(errors).toContain('assets[0].author');
    expect(errors).toContain('assets[0].license');
    expect(errors).toContain('assets[1].source');
  });

  it('biçim hataları', () => {
    expect(validateCredits(null).ok).toBe(false);
    expect(validateCredits({ version: 2, assets: [] }).ok).toBe(false);
    expect(validateCredits({ version: 1, assets: 'x' }).ok).toBe(false);
  });
});
