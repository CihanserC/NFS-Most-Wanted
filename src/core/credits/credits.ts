/** public/assets/CREDITS.json: oyun içi credits ekranında gösterilen üçüncü taraf varlık atıfları. */
export type CreditEntry = {
  name: string;
  author: string;
  source: string;
  license: string;
  licenseUrl?: string;
  usedFor?: string;
  changes?: string;
};

export type CreditsFile = { version: 1; assets: CreditEntry[] };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** Lisans gerektiren atıf: yalnızca atıfla kullanım izni veren (CC-BY, CC0, MIT...) lisanslar kabul edilir. */
const ALLOWED_LICENSE =
  /^(CC0|CC-BY(-4\.0|-3\.0)?|CC-BY-SA(-4\.0|-3\.0)?|MIT|Apache-2\.0|OFL-1\.1|Public Domain)$/i;

export type CreditsResult = { ok: true; value: CreditsFile } | { ok: false; errors: string[] };

/** Atıf dosyasını doğrular; tüm hataları toplar (yol: açıklama). */
export function validateCredits(input: unknown): CreditsResult {
  const errors: string[] = [];
  if (!isObj(input)) return { ok: false, errors: ['credits: nesne olmalı'] };
  if (input.version !== 1) errors.push('version: 1 olmalı');
  if (!Array.isArray(input.assets)) errors.push('assets: dizi olmalı');
  const entries: CreditEntry[] = [];
  if (Array.isArray(input.assets))
    input.assets.forEach((raw: unknown, i) => {
      const p = `assets[${i}]`;
      if (!isObj(raw)) {
        errors.push(`${p}: nesne olmalı`);
        return;
      }
      for (const key of ['name', 'author', 'source', 'license'] as const)
        if (!text(raw[key])) errors.push(`${p}.${key}: boş olmayan metin olmalı`);
      if (text(raw.license) && !ALLOWED_LICENSE.test(raw.license.trim()))
        errors.push(`${p}.license: "${raw.license}" izin verilen lisanslardan değil`);
      if (text(raw.source) && !/^https?:\/\//.test(raw.source))
        errors.push(`${p}.source: http(s) bağlantısı olmalı`);
      for (const key of ['licenseUrl', 'usedFor', 'changes'] as const)
        if (raw[key] !== undefined && !text(raw[key])) errors.push(`${p}.${key}: metin olmalı`);
      entries.push(raw as unknown as CreditEntry);
    });
  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, value: { version: 1, assets: entries } };
}
