import { useState, type ReactNode } from 'react';
import { normalizeHex } from '../../core/color/color';
import { paintPalette } from '../../data/paints';
import { t } from '../../i18n';
import './paint/paintEditor.css';
import './wheels/wheelsEditor.css';

/** Editörlerin ortak kontrolleri: kaydırıcı, seçenek ızgarası, renk satırı, bölüm. */
type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onPreview: (v: number) => void;
  onCommit: () => void;
};

export function Slider({ label, value, min, max, step, format, onPreview, onCommit }: SliderProps) {
  return (
    <label className="pe-slider">
      <span>
        {label} <em>{format(value)}</em>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onPreview(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onBlur={onCommit}
      />
    </label>
  );
}

export function Choice<T extends string | number>({
  options,
  value,
  label,
  onPreview,
  onPick,
  onLeave,
  disabled,
  columns = 3,
}: {
  options: readonly T[];
  value: T;
  label: (v: T) => string;
  onPreview: (v: T) => void;
  onPick: (v: T) => void;
  onLeave: () => void;
  disabled?: (v: T) => boolean;
  columns?: number;
}) {
  return (
    <div
      className="pe-types"
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      onMouseLeave={onLeave}
    >
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          className={`pe-type${value === o ? ' is-active' : ''}`}
          disabled={disabled?.(o)}
          onMouseEnter={() => !disabled?.(o) && onPreview(o)}
          onClick={() => onPick(o)}
        >
          {label(o)}
        </button>
      ))}
    </div>
  );
}

export function ColorRow({
  value,
  onPreview,
  onPick,
  onLeave,
}: {
  value: string;
  onPreview: (hex: string) => void;
  onPick: (hex: string) => void;
  onLeave: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="we-color">
      <input
        className="we-hex"
        value={draft ?? value}
        maxLength={7}
        spellCheck={false}
        onFocus={() => setDraft(value)}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        onBlur={() => {
          const hex = draft ? normalizeHex(draft) : null;
          if (hex) onPick(hex);
          setDraft(null);
        }}
      />
      <div className="we-swatches" onMouseLeave={onLeave}>
        {paintPalette.map((c) => (
          <button
            key={c.id}
            type="button"
            title={t(`palette.${c.id}`)}
            aria-label={t(`palette.${c.id}`)}
            style={{ background: c.hex }}
            className={value === c.hex ? 'is-active' : ''}
            onMouseEnter={() => onPreview(c.hex)}
            onClick={() => onPick(c.hex)}
          />
        ))}
      </div>
    </div>
  );
}

export const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section>
    <h3>{title}</h3>
    {children}
  </section>
);
