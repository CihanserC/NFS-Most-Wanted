import { useEffect, useState } from 'react';
import { normalizeHex } from '../../../core/color/color';
import {
  PaintImportError,
  paintReferenceZone,
  paintTargets,
  parsePaintExport,
  serializePaintMap,
} from '../../../core/paint/paint';
import { FLAKE_PAINT_TYPES, PAINT_TYPES, type PaintConfig } from '../../../core/paint/types';
import { usePaintPresetStore } from '../../../core/store/paintPresetStore';
import { useBuildStore, useEffectivePaint } from '../../../core/store/stores';
import { paintPalette, paintPresets } from '../../../data/paints';
import { t } from '../../../i18n';
import { ColorWheel } from './ColorWheel';
import './paintEditor.css';

type ColorField = 'color' | 'secondaryColor' | 'tertiaryColor' | 'flakeColor';
type SliderField = 'gloss' | 'flakeSize' | 'flakeDensity';

/** Boya tipine göre düzenlenebilir renkler ve etiketleri. */
function colorTargets(p: PaintConfig): { field: ColorField; label: string }[] {
  const out: { field: ColorField; label: string }[] = [{ field: 'color', label: t('paint.color') }];
  if (p.type === 'pearl') out.push({ field: 'secondaryColor', label: t('paint.pearlColor') });
  if (p.type === 'chameleon')
    out.push(
      { field: 'secondaryColor', label: t('paint.color2') },
      { field: 'tertiaryColor', label: t('paint.color3') },
    );
  if (FLAKE_PAINT_TYPES.includes(p.type))
    out.push({ field: 'flakeColor', label: t('paint.flakeColor') });
  return out;
}

/** Arka plan swatch'ı için kaba bir boya önizlemesi (CSS). */
function swatchStyle(p: PaintConfig) {
  if (p.type === 'chameleon')
    return {
      background: `linear-gradient(135deg, ${p.color}, ${p.secondaryColor}, ${p.tertiaryColor})`,
    };
  if (p.type === 'chrome')
    return {
      background: `linear-gradient(160deg, #fff 0%, ${p.color} 45%, #222 55%, ${p.color} 100%)`,
    };
  if (p.type === 'pearl')
    return { background: `linear-gradient(135deg, ${p.color} 40%, ${p.secondaryColor})` };
  return { background: p.color };
}

export function PaintEditor({ zone: selected, zones }: { zone: string; zones: string[] }) {
  // "Tüm araç" seçiliyse düzenleme bütün bölgelere gider; gösterilen değerler gövdeden okunur
  const zone = paintReferenceZone(selected, zones);
  const targets = paintTargets(selected, zones);
  const fanout = (config: PaintConfig) => Object.fromEntries(targets.map((z) => [z, config]));
  const paint = useEffectivePaint()[zone];
  const saved = useBuildStore((s) => s.build.paint);
  const { setPaint, previewPaint, commitPaintPreview, clearPaintPreview } =
    useBuildStore.getState();
  const userPresets = usePaintPresetStore((s) => s.presets);
  const { add: addPreset, remove: removePreset } = usePaintPresetStore.getState();

  const [target, setTarget] = useState<ColorField>('color');
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');
  const [json, setJson] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Editörden çıkılırken onaylanmamış önizleme kalmasın.
  useEffect(() => () => clearPaintPreview(), [clearPaintPreview]);

  if (!paint) return null;

  // Yerleşim kayıtlı boyaya göre belirlenir: hover önizlemesi türü değiştirince bölümler
  // açılıp kapanmasın (içerik kayar, fare başka öğeye düşer ve titreme olur).
  const base = saved[zone] ?? paint;
  const colorFields = colorTargets(base);
  const activeTarget = colorFields.some((x) => x.field === target) ? target : 'color';
  const hasFlakes = FLAKE_PAINT_TYPES.includes(base.type);

  const preview = (patch: Partial<PaintConfig>) => previewPaint(fanout({ ...paint, ...patch }));
  const commit = (patch: Partial<PaintConfig>) => setPaint(fanout({ ...paint, ...patch }));
  // Hover önizlemesi kayıtlı boya üzerinden yapılır ki birikmesin.
  const hoverPreview = (patch: Partial<PaintConfig>) => previewPaint(fanout({ ...base, ...patch }));
  const hoverCommit = (patch: Partial<PaintConfig>) => setPaint(fanout({ ...base, ...patch }));

  const slider = (field: SliderField, label: string) => (
    <label className="pe-slider" key={field}>
      <span>
        {label} <em>{Math.round(paint[field] * 100)}</em>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={paint[field]}
        onChange={(e) => preview({ [field]: Number(e.target.value) })}
        onPointerUp={commitPaintPreview}
        onKeyUp={commitPaintPreview}
        onBlur={commitPaintPreview}
      />
    </label>
  );

  const exportJson = async () => {
    const text = serializePaintMap(saved);
    setJson(text);
    try {
      await navigator.clipboard.writeText(text);
      setMessage({ ok: true, text: t('paint.exported') });
    } catch {
      setMessage({ ok: true, text: t('paint.exportedNoClipboard') });
    }
  };

  const importJson = () => {
    try {
      setPaint(parsePaintExport(json, zones));
      setMessage({ ok: true, text: t('paint.imported') });
    } catch (e) {
      const detail = e instanceof PaintImportError ? `: ${e.message}` : '';
      setMessage({ ok: false, text: `${t('paint.importError')}${detail}` });
    }
  };

  return (
    <div className="pe">
      <section>
        <h3>{t('paint.type')}</h3>
        <div className="pe-types" onMouseLeave={clearPaintPreview}>
          {PAINT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={`pe-type${base.type === type ? ' is-active' : ''}`}
              onMouseEnter={() => hoverPreview({ type })}
              onClick={() => hoverCommit({ type })}
            >
              {t(`paintType.${type}`)}
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="pe-tabs">
          {colorFields.map(({ field, label }) => (
            <button
              key={field}
              type="button"
              className={`pe-tab${activeTarget === field ? ' is-active' : ''}`}
              onClick={() => setTarget(field)}
            >
              <i style={{ background: paint[field] }} />
              {label}
            </button>
          ))}
        </div>
        <div className="pe-color">
          <ColorWheel
            hex={paint[activeTarget]}
            onChange={(hex) => preview({ [activeTarget]: hex })}
            onCommit={commitPaintPreview}
          />
          <div className="pe-color-side">
            <label className="pe-hex">
              <span>{t('paint.hex')}</span>
              <input
                value={hexDraft ?? paint[activeTarget]}
                spellCheck={false}
                maxLength={7}
                onFocus={() => setHexDraft(paint[activeTarget])}
                onChange={(e) => setHexDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                onBlur={() => {
                  const hex = hexDraft ? normalizeHex(hexDraft) : null;
                  if (hex) commit({ [activeTarget]: hex });
                  setHexDraft(null);
                }}
              />
            </label>
            <span className="pe-label">{t('paint.palette')}</span>
            <div className="pe-palette" onMouseLeave={clearPaintPreview}>
              {paintPalette.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={t(`palette.${c.id}`)}
                  aria-label={t(`palette.${c.id}`)}
                  style={{ background: c.hex }}
                  onMouseEnter={() => hoverPreview({ [activeTarget]: c.hex })}
                  onClick={() => hoverCommit({ [activeTarget]: c.hex })}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        {slider('gloss', t('paint.gloss'))}
        {hasFlakes && slider('flakeSize', t('paint.flakeSize'))}
        {hasFlakes && slider('flakeDensity', t('paint.flakeDensity'))}
      </section>

      <section>
        <h3>{t('paint.presets')}</h3>
        <div className="pe-presets" onMouseLeave={clearPaintPreview}>
          {paintPresets.map((p) => (
            <button
              key={p.id}
              type="button"
              className="pe-preset"
              onMouseEnter={() => previewPaint(fanout(p.paint))}
              onClick={() => setPaint(fanout(p.paint))}
            >
              <i style={swatchStyle(p.paint)} />
              {t(`paintPreset.${p.id}`)}
            </button>
          ))}
        </div>
        <h3>{t('paint.myPresets')}</h3>
        <div className="pe-presets" onMouseLeave={clearPaintPreview}>
          {userPresets.map((p) => (
            <span key={p.id} className="pe-preset is-user">
              <button
                type="button"
                onMouseEnter={() => previewPaint(fanout(p.paint))}
                onClick={() => setPaint(fanout(p.paint))}
              >
                <i style={swatchStyle(p.paint)} />
                {p.name}
              </button>
              <button
                type="button"
                className="pe-x"
                aria-label={t('paint.deletePreset')}
                onClick={() => removePreset(p.id)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <form
          className="pe-row"
          onSubmit={(e) => {
            e.preventDefault();
            const name = presetName.trim();
            if (!name) return;
            addPreset(name, base);
            setPresetName('');
          }}
        >
          <input
            value={presetName}
            maxLength={40}
            placeholder={t('paint.presetName')}
            onChange={(e) => setPresetName(e.target.value)}
          />
          <button type="submit" className="gm-chip" disabled={!presetName.trim()}>
            {t('paint.savePreset')}
          </button>
        </form>
      </section>

      <section>
        {targets.length === 1 && (
          <button
            type="button"
            className="gm-chip pe-wide"
            onClick={() => setPaint(Object.fromEntries(zones.map((z) => [z, base])))}
          >
            {t('paint.applyAll')}
          </button>
        )}
        <details className="pe-json">
          <summary>{t('paint.json')}</summary>
          <textarea value={json} spellCheck={false} onChange={(e) => setJson(e.target.value)} />
          <div className="pe-row">
            <button type="button" className="gm-chip" onClick={exportJson}>
              {t('paint.export')}
            </button>
            <button type="button" className="gm-chip" onClick={importJson} disabled={!json.trim()}>
              {t('paint.import')}
            </button>
          </div>
          {message && <p className={message.ok ? 'pe-ok' : 'pe-err'}>{message.text}</p>}
        </details>
      </section>
    </div>
  );
}
