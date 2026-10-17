import { memo, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { normalizeHex } from '../../core/color/color';
import {
  duplicateLayers,
  expandToGroups,
  groupLayers,
  moveLayers,
  nudgeLayers,
  removeLayers,
  ungroupLayers,
  type MoveDirection,
} from '../../core/vinyl/group';
import {
  exceedsLimit,
  parseVinylGroup,
  serializeVinylGroup,
  VinylImportError,
} from '../../core/vinyl/exchange';
import {
  addLayer,
  createLayer,
  LayerLimitError,
  MAX_TEXT_LENGTH,
  updateLayer,
} from '../../core/vinyl/layers';
import { vinylConfig } from '../../core/vinyl/projection';
import { MASK_MODES, VINYL_SIDES, type VinylLayer } from '../../core/vinyl/types';
import { useAppStore } from '../../core/store/appStore';
import { useBuildStore, useVinylLayer } from '../../core/store/stores';
import { getCar } from '../../data/cars';
import { paintPalette } from '../../data/paints';
import { t } from '../../i18n';
import {
  hasVinylShape,
  SHAPE_CATEGORIES,
  shapeAspect,
  TEXT_SHAPE_ID,
  VINYL_SHAPES,
  type ShapeCategory,
  type VinylShape,
} from '../shapes/library';
import { layoutText, STROKE_FONTS } from '../shapes/strokeFont';
import { instantiateSet, VINYL_SETS } from '../sets/presets';
import { textToGlyphLayers } from '../sets/textConvert';
import '../../garage/ui/paint/paintEditor.css';
import './vinylEditor.css';

const RAD_TO_DEG = 180 / Math.PI;

/** Şekil önizleme ikonu (dolgu, gradyan veya çizgi fontu). */
function ShapeIcon({
  shape,
  text,
  fontId,
}: {
  shape?: VinylShape;
  text?: string;
  fontId?: string;
}) {
  if (shape && shape.kind !== 'glyph')
    return (
      <svg viewBox="-55 -55 110 110" aria-hidden>
        {shape.kind === 'gradient' && (
          <defs>
            <linearGradient id={`g-${shape.id}`}>
              <stop offset="0" stopColor="currentColor" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
        )}
        <path
          d={shape.path}
          fillRule={shape.kind === 'fill' ? shape.fillRule : undefined}
          fill={shape.kind === 'gradient' ? `url(#g-${shape.id})` : 'currentColor'}
        />
      </svg>
    );
  const layout = layoutText(shape?.kind === 'glyph' ? shape.char : (text ?? ''), fontId);
  if (!layout) return null;
  // Yerel birim kutuyu (y yukarı) ikona sığdır, oranı koru
  const k = 90 / Math.max(layout.aspect, 1);
  const sx = layout.aspect * k;
  const sy = k;
  return (
    <svg viewBox="-55 -55 110 110" aria-hidden>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={layout.weight * sy}
        strokeLinecap={layout.cap}
        strokeLinejoin={layout.join}
      >
        {layout.polylines.map((line, i) => (
          <polyline key={i} points={line.map(([x, y]) => `${x * sx},${-y * sy}`).join(' ')} />
        ))}
      </g>
    </svg>
  );
}

/** Seçili katmanın sürüklenebilir sayısal özelliği (önizleme + bırakınca tek undo adımı). */
function LayerSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onPreview,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onPreview: (v: number) => void;
}) {
  const commit = () => useBuildStore.getState().commitVinylPreview();
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
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
    </label>
  );
}

function Fold({
  title,
  children,
  open = false,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="ve-fold" open={open}>
      <summary>{title}</summary>
      {children}
    </details>
  );
}

export function VinylEditor() {
  const saved = useBuildStore((s) => s.build.vinyl);
  const carId = useBuildStore((s) => s.build.carId);
  const { setVinyl, clearVinylPreview } = useBuildStore.getState();
  const app = useAppStore();
  const {
    selectLayers,
    setVinylTool,
    setVinylShape,
    setVinylView,
    setVinylColor,
    setVinylSnap,
    setVinylText,
    setVinylFont,
  } = useAppStore.getState();
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [category, setCategory] = useState<ShapeCategory>('basic');
  const [json, setJson] = useState('');
  const box = getCar(carId).vinylBox;

  useEffect(() => () => clearVinylPreview(), [clearVinylPreview]);

  const ids = app.selectedLayerIds;
  // Kayıtlı hali; sürükleme önizlemesi sadece SelectedLayerPanel'i yeniden çizer.
  const selection = useMemo(() => saved.filter((l) => ids.includes(l.id)), [saved, ids]);
  const single = selection.length === 1 ? (selection[0] as VinylLayer) : null;
  const atLimit = saved.length >= vinylConfig.layerLimit;

  // Silinen/geri alınan katmanlar seçimden düşer.
  useEffect(() => {
    const alive = ids.filter((id) => saved.some((l) => l.id === id));
    if (alive.length !== ids.length) selectLayers(alive);
  }, [saved, ids, selectLayers]);

  const tryApply = (fn: () => void) => {
    try {
      fn();
      setMessage(null);
    } catch (e) {
      if (e instanceof LayerLimitError || e instanceof VinylImportError)
        setMessage({ ok: false, text: e.message });
      else throw e;
    }
  };

  const order = (dir: MoveDirection) => {
    if (ids.length) setVinyl(moveLayers(saved, ids, dir));
  };
  const duplicate = () =>
    tryApply(() => {
      const r = duplicateLayers(saved, ids);
      setVinyl(r.layers);
      selectLayers(r.copyIds);
    });
  const remove = () => {
    setVinyl(removeLayers(saved, ids));
    selectLayers([]);
  };
  const group = () => {
    const r = groupLayers(saved, ids);
    if (r.groupId) setVinyl(r.layers);
  };
  const ungroup = () => setVinyl(ungroupLayers(saved, ids));
  const nudge = (du: number, dv: number) => {
    if (ids.length) setVinyl(nudgeLayers(saved, ids, du, dv));
  };

  // Klavye kısayolları (metin girişindeyken değil)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target;
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return;
      const onInput = el instanceof HTMLInputElement;
      if (onInput && !['range', 'checkbox', 'button', 'file'].includes(el.type)) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const step = e.shiftKey ? vinylConfig.nudge.bigStep : vinylConfig.nudge.step;
      let handled = true;
      if (e.key === 'Delete' && ids.length) remove();
      else if (ctrl && key === 'd' && ids.length) duplicate();
      else if (ctrl && key === 'g' && e.shiftKey) ungroup();
      else if (ctrl && key === 'g') group();
      else if (ctrl && key === 'a') selectLayers(saved.map((l) => l.id));
      else if (e.key === ']') order(ctrl ? 'top' : 'up');
      else if (e.key === '[') order(ctrl ? 'bottom' : 'down');
      else if (!ctrl && key === 'm') setVinylSnap(!useAppStore.getState().vinylSnap);
      else if (!ctrl && key === 'v') setVinylTool('select');
      else if (!ctrl && key === 'p') setVinylTool('place');
      else if (onInput) handled = false;
      else if (e.key === 'ArrowLeft') nudge(-step, 0);
      else if (e.key === 'ArrowRight') nudge(step, 0);
      else if (e.key === 'ArrowUp') nudge(0, step);
      else if (e.key === 'ArrowDown') nudge(0, -step);
      else handled = false;
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const commitPatch = (patch: Partial<VinylLayer>) => {
    if (selection.length === 0) return;
    let next = saved;
    for (const l of selection) next = updateLayer(next, l.id, patch);
    setVinyl(next);
  };
  const pickColor = (hex: string) => {
    setVinylColor(hex);
    commitPatch({ color: hex });
  };

  // ---- Yazı aracı ----
  const textLayer = single?.shapeId === TEXT_SHAPE_ID ? single : null;
  const addText = () =>
    tryApply(() => {
      const aspect = shapeAspect(TEXT_SHAPE_ID, app.vinylText, app.vinylFontId);
      const layer = createLayer(TEXT_SHAPE_ID, app.vinylView, [0.5, 0.5], {
        text: app.vinylText,
        fontId: app.vinylFontId,
        color: app.vinylColor,
        scale: [aspect, 1],
      });
      setVinyl(addLayer(saved, layer));
      selectLayers([layer.id]);
    });
  const updateText = () => {
    if (!textLayer) return;
    const aspect = shapeAspect(TEXT_SHAPE_ID, app.vinylText, app.vinylFontId);
    setVinyl(
      updateLayer(saved, textLayer.id, {
        text: app.vinylText,
        fontId: app.vinylFontId,
        scale: [textLayer.scale[1] * aspect, textLayer.scale[1]],
      }),
    );
  };
  const convertText = () =>
    tryApply(() => {
      if (!textLayer) return;
      const glyphs = textToGlyphLayers(textLayer, box.surfaces[textLayer.side]);
      if (exceedsLimit(saved.length - 1, glyphs.length)) throw new LayerLimitError();
      const i = saved.indexOf(textLayer);
      setVinyl([...saved.slice(0, i), ...glyphs, ...saved.slice(i + 1)]);
      selectLayers(glyphs.map((g) => g.id));
    });

  // ---- Hazır setler ----
  const applySet = (setId: string) =>
    tryApply(() => {
      const set = VINYL_SETS.find((s) => s.id === setId);
      if (!set) return;
      const layers = instantiateSet(set);
      if (exceedsLimit(saved.length, layers.length)) throw new LayerLimitError();
      setVinyl([...saved, ...layers]);
      selectLayers(layers.map((l) => l.id));
    });

  // ---- Dışa / içe aktarma (seçim varsa seçim + grupları, yoksa hepsi) ----
  const exportLayers = selection.length
    ? saved.filter((l) => expandToGroups(saved, ids).includes(l.id))
    : saved;
  const doExport = async () => {
    const text = serializeVinylGroup(exportLayers);
    setJson(text);
    try {
      await navigator.clipboard.writeText(text);
      setMessage({
        ok: true,
        text: t('vinyl.exported').replace('{n}', String(exportLayers.length)),
      });
    } catch {
      setMessage({ ok: true, text: t('paint.exportedNoClipboard') });
    }
  };
  const downloadExport = () => {
    const blob = new Blob([serializeVinylGroup(exportLayers)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vinil-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const doImport = (text: string) =>
    tryApply(() => {
      const layers = parseVinylGroup(text, hasVinylShape);
      if (exceedsLimit(saved.length, layers.length)) throw new LayerLimitError();
      setVinyl([...saved, ...layers]);
      selectLayers(layers.map((l) => l.id));
      setMessage({ ok: true, text: t('vinyl.imported').replace('{n}', String(layers.length)) });
    });

  const shapes = VINYL_SHAPES.filter((s) => s.category === category);

  return (
    <div className="pe ve">
      <section>
        <div className="pe-types ve-tools">
          {(['place', 'select'] as const).map((tool) => (
            <button
              key={tool}
              type="button"
              className={`pe-type${app.vinylTool === tool ? ' is-active' : ''}`}
              onClick={() => setVinylTool(tool)}
            >
              {t(`vinyl.tool.${tool}`)}
            </button>
          ))}
          <button
            type="button"
            className={`pe-type${app.vinylSnap ? ' is-active' : ''}`}
            onClick={() => setVinylSnap(!app.vinylSnap)}
            title={t('vinyl.snapHint')}
          >
            {t('vinyl.snap')}
          </button>
        </div>
        <p className="we-info">{t(`vinyl.hint.${app.vinylTool}`)}</p>
        <div className="pe-tabs">
          {VINYL_SIDES.map((side) => (
            <button
              key={side}
              type="button"
              className={`pe-tab${app.vinylView === side ? ' is-active' : ''}`}
              onClick={() => setVinylView(side)}
            >
              {t(`vinylSide.${side}`)}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>{t('vinyl.shapes')}</h3>
        <div className="pe-tabs">
          {SHAPE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`pe-tab${category === c ? ' is-active' : ''}`}
              onClick={() => setCategory(c)}
            >
              {t(`shapeCategory.${c}`)}
            </button>
          ))}
        </div>
        <div className="ve-shapes">
          {shapes.map((s) => (
            <button
              key={s.id}
              type="button"
              title={t(`vinylShape.${s.id}`)}
              aria-label={t(`vinylShape.${s.id}`)}
              className={app.vinylShapeId === s.id ? 'is-active' : ''}
              onClick={() => {
                setVinylShape(s.id);
                setVinylTool('place');
              }}
            >
              <ShapeIcon shape={s} />
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>{t('vinyl.color')}</h3>
        <div className="we-color">
          <input
            className="we-hex"
            value={hexDraft ?? single?.color ?? app.vinylColor}
            maxLength={7}
            spellCheck={false}
            onFocus={() => setHexDraft(single?.color ?? app.vinylColor)}
            onChange={(e) => setHexDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            onBlur={() => {
              const hex = hexDraft ? normalizeHex(hexDraft) : null;
              if (hex) pickColor(hex);
              setHexDraft(null);
            }}
          />
          <div className="we-swatches">
            {paintPalette.map((c) => (
              <button
                key={c.id}
                type="button"
                title={t(`palette.${c.id}`)}
                aria-label={t(`palette.${c.id}`)}
                style={{ background: c.hex }}
                onClick={() => pickColor(c.hex)}
              />
            ))}
          </div>
        </div>
      </section>

      <Fold title={t('vinyl.textTool')} open={!!textLayer}>
        <div className="ve-text">
          <input
            value={app.vinylText}
            maxLength={MAX_TEXT_LENGTH}
            onChange={(e) => setVinylText(e.target.value)}
            placeholder={t('vinyl.textPlaceholder')}
          />
          <div className="pe-types ve-fonts">
            {STROKE_FONTS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`pe-type${app.vinylFontId === f.id ? ' is-active' : ''}`}
                onClick={() => setVinylFont(f.id)}
              >
                <ShapeIcon text="AB" fontId={f.id} />
                <span>{t(`font.${f.id}`)}</span>
              </button>
            ))}
          </div>
          <div className="ve-actions">
            <button
              type="button"
              className="gm-chip"
              onClick={addText}
              disabled={atLimit || !layoutText(app.vinylText)}
            >
              {t('vinyl.addText')}
            </button>
            {textLayer && (
              <>
                <button type="button" className="gm-chip" onClick={updateText}>
                  {t('vinyl.updateText')}
                </button>
                <button type="button" className="gm-chip" onClick={convertText}>
                  {t('vinyl.convertText')}
                </button>
              </>
            )}
          </div>
        </div>
      </Fold>

      {single && <SelectedLayerPanel id={single.id} />}

      {selection.length > 0 && (
        <section>
          {selection.length > 1 && (
            <h3>
              {t('vinyl.multi').replace('{n}', String(selection.length))}
              {selection.some((l) => l.groupId) ? ` · ${t('vinyl.grouped')}` : ''}
            </h3>
          )}
          <div className="ve-actions">
            <button
              type="button"
              className="gm-chip"
              onClick={() => order('top')}
              title={t('vinyl.toTop')}
            >
              ⤒
            </button>
            <button
              type="button"
              className="gm-chip"
              onClick={() => order('up')}
              title={t('vinyl.up')}
            >
              ↑
            </button>
            <button
              type="button"
              className="gm-chip"
              onClick={() => order('down')}
              title={t('vinyl.down')}
            >
              ↓
            </button>
            <button
              type="button"
              className="gm-chip"
              onClick={() => order('bottom')}
              title={t('vinyl.toBottom')}
            >
              ⤓
            </button>
            <button type="button" className="gm-chip" onClick={duplicate} disabled={atLimit}>
              {t('vinyl.duplicate')}
            </button>
            <button type="button" className="gm-chip" onClick={remove}>
              {t('vinyl.delete')}
            </button>
            {selection.length > 1 && (
              <button type="button" className="gm-chip" onClick={group}>
                {t('vinyl.group')}
              </button>
            )}
            {selection.some((l) => l.groupId) && (
              <button type="button" className="gm-chip" onClick={ungroup}>
                {t('vinyl.ungroup')}
              </button>
            )}
          </div>
        </section>
      )}

      <Fold title={t('vinyl.presets')}>
        <div className="pe-presets">
          {VINYL_SETS.map((s) => (
            <button key={s.id} type="button" className="pe-preset" onClick={() => applySet(s.id)}>
              {t(`vinylSet.${s.id}`)}
            </button>
          ))}
        </div>
      </Fold>

      <Fold title={t('vinyl.exchange')}>
        <p className="we-info">
          {selection.length
            ? t('vinyl.exportSelection').replace('{n}', String(exportLayers.length))
            : t('vinyl.exportAll')}
        </p>
        <textarea
          className="ve-json"
          value={json}
          spellCheck={false}
          onChange={(e) => setJson(e.target.value)}
        />
        <div className="ve-actions">
          <button
            type="button"
            className="gm-chip"
            onClick={doExport}
            disabled={exportLayers.length === 0}
          >
            {t('paint.export')}
          </button>
          <button
            type="button"
            className="gm-chip"
            onClick={downloadExport}
            disabled={exportLayers.length === 0}
          >
            {t('vinyl.download')}
          </button>
          <button
            type="button"
            className="gm-chip"
            onClick={() => doImport(json)}
            disabled={!json.trim()}
          >
            {t('paint.import')}
          </button>
          <label className="gm-chip ve-file">
            {t('vinyl.importFile')}
            <input
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) doImport(await file.text());
              }}
            />
          </label>
        </div>
      </Fold>

      {message && <p className={message.ok ? 'pe-ok' : 'pe-err'}>{message.text}</p>}

      <section>
        <h3>
          {t('vinyl.layers')}{' '}
          <em className="ve-count">
            {saved.length} / {vinylConfig.layerLimit}
          </em>
        </h3>
        {saved.length === 0 && <p className="we-info">{t('vinyl.empty')}</p>}
        <LayerList layers={saved} selectedIds={ids} />
        <p className="we-info ve-keys">{t('vinyl.shortcuts')}</p>
      </section>
    </div>
  );
}

/**
 * Katman listesi. Sürükleme önizlemesi sırasında her karede yeniden çizilmesin diye sadece
 * kayıtlı listeye ve seçime bağlı (memo); 200+ katmanda editörü akıcı tutar.
 * Tık: katmanı (grupluysa tüm grubu) seçer · Ctrl/Shift: seçime ekle · Alt: tek üye.
 */
const LayerList = memo(function LayerList({
  layers,
  selectedIds,
}: {
  layers: VinylLayer[];
  selectedIds: string[];
}) {
  const { setVinyl } = useBuildStore.getState();
  const { selectLayers } = useAppStore.getState();
  const selected = new Set(selectedIds);
  const groupIndex = new Map<string, number>();
  for (const l of layers)
    if (l.groupId && !groupIndex.has(l.groupId)) groupIndex.set(l.groupId, groupIndex.size + 1);

  const click = (l: VinylLayer, e: MouseEvent) => {
    const picked =
      e.altKey || !l.groupId
        ? [l.id]
        : layers.filter((x) => x.groupId === l.groupId).map((x) => x.id);
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      const next = new Set(selectedIds);
      const removing = picked.every((id) => next.has(id));
      for (const id of picked) {
        if (removing) next.delete(id);
        else next.add(id);
      }
      selectLayers(layers.filter((x) => next.has(x.id)).map((x) => x.id));
    } else selectLayers(picked);
  };

  return (
    <ul className="ve-layers">
      {[...layers].reverse().map((l, i) => (
        <li key={l.id} className={selected.has(l.id) ? 'is-selected' : ''}>
          <button
            type="button"
            className="ve-icon"
            title={t(l.visible ? 'vinyl.hide' : 'vinyl.show')}
            onClick={() => setVinyl(updateLayer(layers, l.id, { visible: !l.visible }))}
          >
            {l.visible ? '◉' : '○'}
          </button>
          <button
            type="button"
            className="ve-icon"
            title={t(l.locked ? 'vinyl.unlock' : 'vinyl.lock')}
            onClick={() => setVinyl(updateLayer(layers, l.id, { locked: !l.locked }))}
          >
            {l.locked ? '■' : '□'}
          </button>
          <button type="button" className="ve-name" onClick={(e) => click(l, e)}>
            <i style={{ background: l.color, opacity: l.opacity }} />#{layers.length - i}{' '}
            {l.shapeId === TEXT_SHAPE_ID ? `“${l.text ?? ''}”` : t(`vinylShape.${l.shapeId}`)} ·{' '}
            {t(`vinylSide.${l.side}`)}
            {l.mirrorToOppositeSide ? ' ⇋' : ''}
            {l.maskMode !== 'none' ? ` [${t(`maskMode.${l.maskMode}`)}]` : ''}
            {l.groupId ? <b className="ve-group">G{groupIndex.get(l.groupId)}</b> : null}
          </button>
        </li>
      ))}
    </ul>
  );
});

/**
 * Tek seçili katmanın özellikleri. Kendi başına seçili katmana abone olur; kaydırıcı
 * sürüklenirken sadece bu panel yeniden çizilir.
 */
function SelectedLayerPanel({ id }: { id: string }) {
  const selected = useVinylLayer(id);
  if (!selected) return null;
  // Sürüklenen değer önizleme listesine değil, kayıtlı listeye uygulanır (tek undo adımı).
  const drag = (patch: Partial<VinylLayer>) => {
    const { build, previewVinyl } = useBuildStore.getState();
    previewVinyl(updateLayer(build.vinyl, id, patch));
  };
  const commitPatch = (patch: Partial<VinylLayer>) => {
    const { build, setVinyl } = useBuildStore.getState();
    setVinyl(updateLayer(build.vinyl, id, patch));
  };
  const name =
    selected.shapeId === TEXT_SHAPE_ID
      ? `“${selected.text ?? ''}”`
      : t(`vinylShape.${selected.shapeId}`);
  const { scale: sl, skew: kl } = vinylConfig.limits;
  return (
    <section>
      <h3>
        {t('vinyl.selected')}: {name} · {t(`vinylSide.${selected.side}`)}
      </h3>
      <div className="pe-types ve-masks">
        {MASK_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            className={`pe-type${selected.maskMode === mode ? ' is-active' : ''}`}
            onClick={() => commitPatch({ maskMode: mode })}
            title={t(`maskHint.${mode}`)}
          >
            {t(`maskMode.${mode}`)}
          </button>
        ))}
      </div>
      <LayerSlider
        label={t('vinyl.opacity')}
        value={selected.opacity}
        min={0}
        max={1}
        step={0.01}
        format={(v) => `${Math.round(v * 100)}%`}
        onPreview={(v) => drag({ opacity: v })}
      />
      <LayerSlider
        label={t('vinyl.rotation')}
        value={selected.rotationDeg}
        min={0}
        max={359}
        step={1}
        format={(v) => `${Math.round(v)}°`}
        onPreview={(v) => drag({ rotationDeg: v })}
      />
      <LayerSlider
        label={t('vinyl.scaleX')}
        value={selected.scale[0]}
        min={sl.min}
        max={sl.max}
        step={0.01}
        format={(v) => `×${v.toFixed(2)}`}
        onPreview={(v) => drag({ scale: [v, selected.scale[1]] })}
      />
      <LayerSlider
        label={t('vinyl.scaleY')}
        value={selected.scale[1]}
        min={sl.min}
        max={sl.max}
        step={0.01}
        format={(v) => `×${v.toFixed(2)}`}
        onPreview={(v) => drag({ scale: [selected.scale[0], v] })}
      />
      <LayerSlider
        label={t('vinyl.skewX')}
        value={selected.skew[0]}
        min={kl.min}
        max={kl.max}
        step={0.01}
        format={(v) => `${Math.round(v * RAD_TO_DEG)}°`}
        onPreview={(v) => drag({ skew: [v, selected.skew[1]] })}
      />
      <LayerSlider
        label={t('vinyl.skewY')}
        value={selected.skew[1]}
        min={kl.min}
        max={kl.max}
        step={0.01}
        format={(v) => `${Math.round(v * RAD_TO_DEG)}°`}
        onPreview={(v) => drag({ skew: [selected.skew[0], v] })}
      />
      <div className="we-row ve-checks">
        {(
          [
            ['flipX', 'vinyl.flipX'],
            ['flipY', 'vinyl.flipY'],
            ['mirrorToOppositeSide', 'vinyl.mirror'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="we-check">
            <input
              type="checkbox"
              checked={selected[key]}
              onChange={(e) => commitPatch({ [key]: e.target.checked })}
            />
            {t(label)}
          </label>
        ))}
      </div>
    </section>
  );
}
