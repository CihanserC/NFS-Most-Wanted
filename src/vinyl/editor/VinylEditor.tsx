import { memo, useEffect, useState } from 'react';
import { normalizeHex } from '../../core/color/color';
import {
  duplicateLayer,
  LayerLimitError,
  moveLayer,
  removeLayer,
  updateLayer,
  type MoveDirection,
} from '../../core/vinyl/layers';
import { vinylConfig } from '../../core/vinyl/projection';
import { VINYL_SIDES, type VinylLayer } from '../../core/vinyl/types';
import { useAppStore } from '../../core/store/appStore';
import { useBuildStore, useVinylLayer } from '../../core/store/stores';
import { paintPalette } from '../../data/paints';
import { t } from '../../i18n';
import { VINYL_SHAPES } from '../shapes/library';
import '../../garage/ui/paint/paintEditor.css';
import './vinylEditor.css';

const RAD_TO_DEG = 180 / Math.PI;

function ShapeIcon({ path, fillRule }: { path: string; fillRule?: 'nonzero' | 'evenodd' }) {
  return (
    <svg viewBox="-55 -55 110 110" aria-hidden>
      <path d={path} fillRule={fillRule} />
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

export function VinylEditor() {
  const saved = useBuildStore((s) => s.build.vinyl);
  const { setVinyl, clearVinylPreview } = useBuildStore.getState();
  const app = useAppStore();
  const { selectLayer, setVinylTool, setVinylShape, setVinylView, setVinylColor } =
    useAppStore.getState();
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => () => clearVinylPreview(), [clearVinylPreview]);

  // Kayıtlı hali; sürükleme önizlemesi sadece SelectedLayerPanel'i yeniden çizer.
  const selected = saved.find((l) => l.id === app.selectedLayerId);

  // Seçili katman silinirse/geri alınırsa seçimi bırak.
  useEffect(() => {
    if (app.selectedLayerId && !saved.some((l) => l.id === app.selectedLayerId)) selectLayer(null);
  }, [saved, app.selectedLayerId, selectLayer]);

  // Delete: seçili katmanı sil (metin girişindeyken değil).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement && t.type !== 'range' && t.type !== 'checkbox') return;
      if (t instanceof HTMLTextAreaElement) return;
      if (e.key === 'Delete' && app.selectedLayerId) {
        setVinyl(removeLayer(saved, app.selectedLayerId));
        selectLayer(null);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [app.selectedLayerId, saved, setVinyl, selectLayer]);

  const commitPatch = (patch: Partial<VinylLayer>) => {
    if (selected) setVinyl(updateLayer(saved, selected.id, patch));
  };

  const order = (dir: MoveDirection) => selected && setVinyl(moveLayer(saved, selected.id, dir));
  const duplicate = () => {
    if (!selected) return;
    try {
      const r = duplicateLayer(saved, selected.id);
      setVinyl(r.layers);
      selectLayer(r.copyId);
    } catch (e) {
      if (e instanceof LayerLimitError) setMessage(e.message);
      else throw e;
    }
  };
  const remove = () => {
    if (!selected) return;
    setVinyl(removeLayer(saved, selected.id));
    selectLayer(null);
  };
  const pickColor = (hex: string) => {
    setVinylColor(hex);
    if (selected) commitPatch({ color: hex });
  };

  const shapeName = (id: string) => t(`vinylShape.${id}`);
  const atLimit = saved.length >= vinylConfig.layerLimit;

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
        </div>
        <p className="we-info">{t(`vinyl.hint.${app.vinylTool}`)}</p>
        <h3>{t('vinyl.view')}</h3>
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
        <div className="ve-shapes">
          {VINYL_SHAPES.map((s) => (
            <button
              key={s.id}
              type="button"
              title={shapeName(s.id)}
              aria-label={shapeName(s.id)}
              className={app.vinylShapeId === s.id ? 'is-active' : ''}
              onClick={() => {
                setVinylShape(s.id);
                setVinylTool('place');
                if (selected) commitPatch({ shapeId: s.id });
              }}
            >
              <ShapeIcon path={s.path} fillRule={s.fillRule} />
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>{t('vinyl.color')}</h3>
        <div className="we-color">
          <input
            className="we-hex"
            value={hexDraft ?? selected?.color ?? app.vinylColor}
            maxLength={7}
            spellCheck={false}
            onFocus={() => setHexDraft(selected?.color ?? app.vinylColor)}
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

      {selected && (
        <SelectedLayerPanel
          id={selected.id}
          onOrder={order}
          onDuplicate={duplicate}
          onRemove={remove}
          canDuplicate={!atLimit}
        />
      )}

      <section>
        <h3>
          {t('vinyl.layers')}{' '}
          <em className="ve-count">
            {saved.length} / {vinylConfig.layerLimit}
          </em>
        </h3>
        {message && <p className="pe-err">{message}</p>}
        {saved.length === 0 && <p className="we-info">{t('vinyl.empty')}</p>}
        <LayerList layers={saved} selectedId={app.selectedLayerId} />
      </section>
    </div>
  );
}

/**
 * Katman listesi. Sürükleme önizlemesi sırasında her karede yeniden çizilmesin diye sadece
 * kayıtlı listeye ve seçime bağlı (memo); 200+ katmanda editörü akıcı tutar.
 */
const LayerList = memo(function LayerList({
  layers,
  selectedId,
}: {
  layers: VinylLayer[];
  selectedId: string | null;
}) {
  const { setVinyl } = useBuildStore.getState();
  const { selectLayer } = useAppStore.getState();
  return (
    <ul className="ve-layers">
      {[...layers].reverse().map((l, i) => (
        <li key={l.id} className={l.id === selectedId ? 'is-selected' : ''}>
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
          <button type="button" className="ve-name" onClick={() => selectLayer(l.id)}>
            <i style={{ background: l.color, opacity: l.opacity }} />#{layers.length - i}{' '}
            {t(`vinylShape.${l.shapeId}`)} · {t(`vinylSide.${l.side}`)}
            {l.mirrorToOppositeSide ? ' ⇋' : ''}
          </button>
        </li>
      ))}
    </ul>
  );
});

/**
 * Seçili katmanın özellikleri. Kendi başına seçili katmana abone olur; kaydırıcı
 * sürüklenirken sadece bu panel yeniden çizilir.
 */
function SelectedLayerPanel({
  id,
  onOrder,
  onDuplicate,
  onRemove,
  canDuplicate,
}: {
  id: string;
  onOrder: (dir: MoveDirection) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  canDuplicate: boolean;
}) {
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
  return (
    <section>
      <h3>
        {t('vinyl.selected')}: {t(`vinylShape.${selected.shapeId}`)} ·{' '}
        {t(`vinylSide.${selected.side}`)}
      </h3>
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
        min={vinylConfig.limits.scale.min}
        max={vinylConfig.limits.scale.max}
        step={0.01}
        format={(v) => `×${v.toFixed(2)}`}
        onPreview={(v) => drag({ scale: [v, selected.scale[1]] })}
      />
      <LayerSlider
        label={t('vinyl.scaleY')}
        value={selected.scale[1]}
        min={vinylConfig.limits.scale.min}
        max={vinylConfig.limits.scale.max}
        step={0.01}
        format={(v) => `×${v.toFixed(2)}`}
        onPreview={(v) => drag({ scale: [selected.scale[0], v] })}
      />
      <LayerSlider
        label={t('vinyl.skewX')}
        value={selected.skew[0]}
        min={vinylConfig.limits.skew.min}
        max={vinylConfig.limits.skew.max}
        step={0.01}
        format={(v) => `${Math.round(v * RAD_TO_DEG)}°`}
        onPreview={(v) => drag({ skew: [v, selected.skew[1]] })}
      />
      <LayerSlider
        label={t('vinyl.skewY')}
        value={selected.skew[1]}
        min={vinylConfig.limits.skew.min}
        max={vinylConfig.limits.skew.max}
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
      <div className="ve-actions">
        <button
          type="button"
          className="gm-chip"
          onClick={() => onOrder('top')}
          title={t('vinyl.toTop')}
        >
          ⤒
        </button>
        <button
          type="button"
          className="gm-chip"
          onClick={() => onOrder('up')}
          title={t('vinyl.up')}
        >
          ↑
        </button>
        <button
          type="button"
          className="gm-chip"
          onClick={() => onOrder('down')}
          title={t('vinyl.down')}
        >
          ↓
        </button>
        <button
          type="button"
          className="gm-chip"
          onClick={() => onOrder('bottom')}
          title={t('vinyl.toBottom')}
        >
          ⤓
        </button>
        <button type="button" className="gm-chip" onClick={onDuplicate} disabled={!canDuplicate}>
          {t('vinyl.duplicate')}
        </button>
        <button type="button" className="gm-chip" onClick={onRemove}>
          {t('vinyl.delete')}
        </button>
      </div>
    </section>
  );
}
