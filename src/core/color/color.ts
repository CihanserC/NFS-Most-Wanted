/** Renk dönüşümleri (sRGB hex <-> RGB 0..1 <-> HSV 0..1). Saf fonksiyonlar. */
export type RGB = { r: number; g: number; b: number };
export type HSV = { h: number; s: number; v: number };

const HEX_RE = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_RE.test(value.trim());
}

/** "#ABC", "abc", "#aabbcc" -> "#aabbcc". Geçersizse null. */
export function normalizeHex(value: string): string | null {
  const m = HEX_RE.exec(value.trim());
  if (!m) return null;
  let hex = (m[1] as string).toLowerCase();
  if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c);
  return `#${hex}`;
}

export function hexToRgb(hex: string): RGB {
  const n = normalizeHex(hex);
  if (!n) throw new Error(`Geçersiz renk: ${hex}`);
  const v = parseInt(n.slice(1), 16);
  return { r: ((v >> 16) & 255) / 255, g: ((v >> 8) & 255) / 255, b: (v & 255) / 255 };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const to = (x: number) =>
    Math.round(Math.min(1, Math.max(0, x)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function rgbToHsv({ r, g, b }: RGB): HSV {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToRgb({ h, s, v }: HSV): RGB {
  const hh = (((h % 1) + 1) % 1) * 6;
  const c = v * s;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    hh < 1
      ? [c, x, 0]
      : hh < 2
        ? [x, c, 0]
        : hh < 3
          ? [0, c, x]
          : hh < 4
            ? [0, x, c]
            : hh < 5
              ? [x, 0, c]
              : [c, 0, x];
  return { r: r + m, g: g + m, b: b + m };
}

export const hexToHsv = (hex: string): HSV => rgbToHsv(hexToRgb(hex));
export const hsvToHex = (hsv: HSV): string => rgbToHex(hsvToRgb(hsv));

/** sRGB hex -> lineer RGB, isteğe bağlı parlaklık çarpanıyla (bloom için HDR emissive renkler). */
export function hexToLinearRgb(hex: string, intensity = 1): [number, number, number] {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4) * intensity;
  return [lin(r), lin(g), lin(b)];
}
