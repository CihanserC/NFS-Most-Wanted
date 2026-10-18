import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { hexToHsv, hsvToHex, hsvToRgb, type HSV } from '../../../core/color/color';
import { t } from '../../../i18n';

const SIZE = 168;
/** Klavye adımları: ton ve doygunluk (Shift ile büyük adım) */
const HUE_STEP = 0.01;
const SAT_STEP = 0.02;
const BIG = 5;
const RADIUS = SIZE / 2;

type Props = {
  hex: string;
  /** Sürükleme sırasında (geçici). */
  onChange: (hex: string) => void;
  /** Sürükleme bitince (kalıcı). */
  onCommit: () => void;
};

/**
 * HSV renk tekerleği: açı = ton, yarıçap = doygunluk; altındaki kaydırıcı = parlaklık.
 * Siyah/gri renklerde ton bilgisi kaybolmasın diye son HSV değeri yerelde tutulur.
 */
export function ColorWheel({ hex, onChange, onCommit }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState(() => ({ hsv: hexToHsv(hex), source: hex }));
  const [dragging, setDragging] = useState(false);

  // Renk dışarıdan değiştiyse (palet, preset, undo) yerel HSV'yi güncelle.
  let hsv = state.hsv;
  if (state.source !== hex) {
    hsv = hexToHsv(hex);
    if (hsv.s === 0 || hsv.v === 0)
      hsv = { ...hsv, h: state.hsv.h, s: hsv.v === 0 ? state.hsv.s : hsv.s };
    setState({ hsv, source: hex });
  }

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(SIZE, SIZE);
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const dx = x - RADIUS + 0.5;
        const dy = y - RADIUS + 0.5;
        const r = Math.hypot(dx, dy) / RADIUS;
        const i = (y * SIZE + x) * 4;
        if (r > 1) continue;
        const h = (Math.atan2(dy, dx) / (2 * Math.PI) + 1) % 1;
        const c = hsvToRgb({ h, s: r, v: hsv.v });
        img.data[i] = c.r * 255;
        img.data[i + 1] = c.g * 255;
        img.data[i + 2] = c.b * 255;
        img.data[i + 3] = r > 0.985 ? (1 - r) * 255 * 66 : 255;
      }
    ctx.putImageData(img, 0, 0);
  }, [hsv.v]);

  const update = (next: HSV) => {
    const nextHex = hsvToHex(next);
    setState({ hsv: next, source: nextHex });
    onChange(nextHex);
  };

  const pick = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = ((e.clientX - rect.left) / rect.width) * SIZE - RADIUS;
    const dy = ((e.clientY - rect.top) / rect.height) * SIZE - RADIUS;
    update({
      h: (Math.atan2(dy, dx) / (2 * Math.PI) + 1) % 1,
      s: Math.min(1, Math.hypot(dx, dy) / RADIUS),
      v: hsv.v,
    });
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = e.shiftKey ? BIG : 1;
    let next: HSV | null = null;
    if (e.key === 'ArrowLeft') next = { ...hsv, h: (hsv.h - HUE_STEP * k + 1) % 1 };
    else if (e.key === 'ArrowRight') next = { ...hsv, h: (hsv.h + HUE_STEP * k) % 1 };
    else if (e.key === 'ArrowUp') next = { ...hsv, s: Math.min(1, hsv.s + SAT_STEP * k) };
    else if (e.key === 'ArrowDown') next = { ...hsv, s: Math.max(0, hsv.s - SAT_STEP * k) };
    if (!next) return;
    e.preventDefault();
    // Menü ok tuşlarıyla gezinmesin
    e.stopPropagation();
    update(next);
  };

  const end = () => {
    if (!dragging) return;
    setDragging(false);
    onCommit();
  };

  const angle = hsv.h * 2 * Math.PI;
  const markerX = 50 + Math.cos(angle) * hsv.s * 50;
  const markerY = 50 + Math.sin(angle) * hsv.s * 50;

  return (
    <div className="cw">
      <div
        className="cw-disc"
        tabIndex={0}
        role="group"
        aria-label={t('paint.wheel')}
        onKeyDown={onKey}
        onKeyUp={(e) => e.key.startsWith('Arrow') && onCommit()}
        onBlur={onCommit}
      >
        <canvas
          ref={canvas}
          width={SIZE}
          height={SIZE}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging(true);
            pick(e);
          }}
          onPointerMove={(e) => dragging && pick(e)}
          onPointerUp={end}
          onPointerCancel={end}
        />
        <span
          className="cw-marker"
          style={{ left: `${markerX}%`, top: `${markerY}%`, background: hex }}
        />
      </div>
      <label className="pe-slider">
        <span>{t('paint.value')}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.005}
          value={hsv.v}
          onChange={(e) => update({ ...hsv, v: Number(e.target.value) })}
          onPointerUp={onCommit}
          onKeyUp={onCommit}
          onBlur={onCommit}
        />
      </label>
    </div>
  );
}
