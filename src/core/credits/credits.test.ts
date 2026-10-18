import { describe, expect, it } from 'vitest';
import creditsJson from '../../../public/assets/CREDITS.json';
import { isNonCommercial, validateCredits } from './credits';

const entry = {
  name: 'Örnek Model',
  author: 'Yapımcı',
  source: 'https://example.com/model',
  license: 'CC-BY-4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  usedFor: 'Gövde',
};

describe('CREDITS.json', () => {
  it('depodaki dosya geçerli; Mustang modeli ticari olmayan lisansla atıflı', () => {
    const result = validateCredits(creditsJson);
    expect(result.ok).toBe(true);
    const assets = result.ok ? result.value.assets : [];
    const mustang = assets.find((a) => a.name.includes('Mustang'));
    expect(mustang?.license).toBe('CC-BY-NC-SA-4.0');
    expect(isNonCommercial(mustang?.license ?? '')).toBe(true);
    expect(isNonCommercial('CC-BY-4.0')).toBe(false);
  });

  it('geçerli girdi kabul edilir', () => {
    expect(validateCredits({ version: 1, assets: [entry] }).ok).toBe(true);
    expect(validateCredits({ version: 1, assets: [{ ...entry, license: 'CC0' }] }).ok).toBe(true);
  });

  it('eksik alan, izin verilmeyen lisans ve geçersiz bağlantı hata verir', () => {
    const result = validateCredits({
      version: 1,
      assets: [
        { ...entry, author: '', license: 'GPL-3.0' },
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
