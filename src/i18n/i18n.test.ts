import { afterEach, describe, expect, it } from 'vitest';
import { formatNumber, formatPercent, getLocale, setLocale, t, DEFAULT_LOCALE } from './index';

afterEach(() => setLocale('en'));

describe('dil desteği', () => {
  it('varsayılan dil İngilizce', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(getLocale()).toBe('en');
    expect(t('drive.pause.title')).toBe('Paused');
  });

  it('dil değişince çeviriler değişir', () => {
    setLocale('tr');
    expect(t('drive.pause.title')).toBe('Duraklatıldı');
  });

  it('yer tutucular doldurulur; bilinmeyen anahtar kendisi döner', () => {
    expect(t('vinyl.multi', { n: 3 })).toBe('3 layers selected');
    expect(t('nope.key')).toBe('nope.key');
  });

  it('sayı ve yüzde biçimi dile göre', () => {
    expect(formatNumber(1400)).toBe('1,400');
    expect(formatPercent(0.5)).toBe('50%');
    setLocale('tr');
    expect(formatNumber(1400)).toBe('1.400');
    expect(formatPercent(0.5)).toBe('%50');
  });
});
