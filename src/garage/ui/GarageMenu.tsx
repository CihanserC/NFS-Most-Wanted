import { useCallback, useEffect, useMemo, useState } from 'react';
import { categoryLabel, formatNumber, hasTranslation, partLabel, slotLabel, t } from '../../i18n';
import { useAppStore } from '../../core/store/appStore';
import { playUiSound } from '../../audio/uiSound';
import { useBuildStore } from '../../core/store/stores';
import { getCar } from '../../data/cars';
import { isCategoryEnabled, menuCategories } from './categories';
import { PaintEditor } from './paint/PaintEditor';
import { useDriveStore } from '../../core/store/driveStore';
import { GarageEditor } from './garage/GarageEditor';
import { LookEditor } from './look/LookEditor';
import { PhotoEditor } from './photo/PhotoEditor';
import { PerformanceEditor } from './performance/PerformanceEditor';
import { StanceEditor } from './stance/StanceEditor';
import { WheelsEditor } from './wheels/WheelsEditor';
import { VinylEditor } from '../../vinyl/editor/VinylEditor';
import './garageMenu.css';

type Item = { id: string; label: string; disabled?: boolean; meta?: string; installed?: boolean };

/**
 * categories -> (parça kategorisi) slots -> options
 *            -> (boya kategorisi) zones -> paint (editör)
 *            -> (jant kategorisi) wheels (editör)
 *            -> (vinil kategorisi) vinyl (editör)
 */
type Level =
  | 'categories'
  | 'slots'
  | 'options'
  | 'zones'
  | 'paint'
  | 'wheels'
  | 'vinyl'
  | 'stance'
  | 'look'
  | 'performance'
  | 'garage'
  | 'photo';

/** Kendi kontrolleri olan (liste olmayan) seviyeler. */
const EDITOR_LEVELS: readonly Level[] = [
  'paint',
  'wheels',
  'vinyl',
  'stance',
  'look',
  'performance',
  'garage',
  'photo',
];

const formatPrice = (price: number) => (price === 0 ? '—' : `$${formatNumber(price)}`);

/** Most Wanted tarzı atölye menüsü. */
export function GarageMenu() {
  const app = useAppStore();
  const { categoryId, slotId, paintZone, selectCategory, selectSlot, selectPaintZone } = app;
  const carId = useBuildStore((s) => s.build.carId);
  const parts = useBuildStore((s) => s.build.parts);
  const paint = useBuildStore((s) => s.build.paint);
  const { setPart, previewPart, clearPreview, clearPaintPreview, clearFitmentPreview } =
    useBuildStore.getState();
  const car = getCar(carId);
  const category = menuCategories.find((c) => c.id === categoryId);

  const level: Level = !category
    ? 'categories'
    : category.kind === 'wheels'
      ? 'wheels'
      : category.kind === 'vinyl'
        ? 'vinyl'
        : category.kind === 'stance' ||
            category.kind === 'look' ||
            category.kind === 'performance' ||
            category.kind === 'garage' ||
            category.kind === 'photo'
          ? category.kind
          : category.kind === 'paint'
            ? paintZone
              ? 'paint'
              : 'zones'
            : slotId
              ? 'options'
              : 'slots';

  const items: Item[] = useMemo(() => {
    switch (level) {
      case 'categories':
        return menuCategories.map((c) => ({
          id: c.id,
          label: categoryLabel(c.id),
          disabled: !isCategoryEnabled(c, Object.keys(car.manifest.slots)),
          meta: isCategoryEnabled(c, Object.keys(car.manifest.slots))
            ? undefined
            : t(c.slots.length > 0 ? 'ui.notAvailable' : 'ui.comingSoon'),
        }));
      case 'slots':
        return (category?.slots ?? [])
          .filter((id) => id in car.manifest.slots)
          .map((id) => ({ id, label: slotLabel(id), meta: partLabel(id, parts[id] ?? '') }));
      case 'options': {
        const slot = slotId ? car.manifest.slots[slotId] : undefined;
        return (slot?.options ?? []).map((opt) => ({
          id: opt,
          label: partLabel(slotId as string, opt),
          installed: parts[slotId as string] === opt,
          meta: formatPrice(car.parts[slotId as string]?.[opt]?.price ?? 0),
        }));
      }
      case 'zones':
        return car.manifest.paintZones.map((z) => ({
          id: z,
          label: t(`paintZone.${z}`),
          meta: paint[z] ? t(`paintType.${paint[z].type}`) : undefined,
        }));
      case 'paint':
      case 'wheels':
      case 'vinyl':
      case 'stance':
      case 'look':
      case 'performance':
      case 'garage':
      case 'photo':
        return [];
    }
  }, [level, category, slotId, car, parts, paint]);

  const installedIndex = Math.max(
    0,
    items.findIndex((i) => i.installed),
  );
  // Seviye değişince vurgu takılı parçaya / son ziyaret edilen öğeye döner.
  // Takılı parça değişince (geri al/yinele dahil) vurgu yeni takılı öğeye döner.
  const installedOption = level === 'options' && slotId ? (parts[slotId] ?? '') : '';
  const levelKey = `${level}|${categoryId ?? ''}|${slotId ?? ''}|${installedOption}`;
  const lastId =
    level === 'categories'
      ? app.lastCategoryId
      : level === 'slots'
        ? app.lastSlotId
        : level === 'zones'
          ? app.lastPaintZone
          : null;
  const defaultHighlight =
    level === 'options'
      ? installedIndex
      : Math.max(
          0,
          items.findIndex((i) => i.id === lastId),
        );
  const [hl, setHl] = useState({ key: levelKey, index: defaultHighlight });
  const highlight = hl.key === levelKey ? hl.index : defaultHighlight;
  const setHighlight = useCallback((index: number) => setHl({ key: levelKey, index }), [levelKey]);

  const preview = useCallback(
    (index: number) => {
      const item = items[index];
      if (level !== 'options' || !slotId || !item) return;
      if (item.installed) clearPreview();
      else previewPart(slotId, item.id);
    },
    [items, level, slotId, clearPreview, previewPart],
  );

  const activate = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item || item.disabled) return;
      playUiSound('confirm');
      if (level !== 'options') setHl({ key: '', index: 0 });
      if (level === 'categories') {
        // Test Sürüşü bir editör değil, mod geçişidir.
        if (menuCategories.find((c) => c.id === item.id)?.kind === 'drive') {
          clearPreview();
          useDriveStore.getState().begin();
          useAppStore.getState().setMode('drive');
        } else selectCategory(item.id);
      } else if (level === 'slots') selectSlot(item.id);
      else if (level === 'zones') selectPaintZone(item.id);
      else if (level === 'options' && slotId) setPart(slotId, item.id);
    },
    [items, level, slotId, selectCategory, selectSlot, selectPaintZone, setPart, clearPreview],
  );

  const back = useCallback(() => {
    playUiSound('back');
    clearPreview();
    clearPaintPreview();
    clearFitmentPreview();
    useBuildStore.getState().clearVinylPreview();
    useBuildStore.getState().clearLookPreview();
    setHl({ key: '', index: 0 });
    if (level === 'options') selectSlot(null);
    else if (level === 'paint') selectPaintZone(null);
    else if (EDITOR_LEVELS.includes(level) || level === 'slots' || level === 'zones')
      selectCategory(null);
  }, [
    level,
    clearPreview,
    clearPaintPreview,
    clearFitmentPreview,
    selectSlot,
    selectPaintZone,
    selectCategory,
  ]);

  const move = useCallback(
    (delta: number) => {
      if (items.length === 0) return;
      let i = highlight;
      // Devre dışı öğeleri atla.
      for (let step = 0; step < items.length; step++) {
        i = (i + delta + items.length) % items.length;
        if (!items[i]?.disabled) break;
      }
      if (i !== highlight) playUiSound('move');
      setHighlight(i);
      preview(i);
    },
    [items, highlight, preview, setHighlight],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Metin alanlarında tüm tuşlar alana aittir. Kaydırıcı/onay kutusu odaktayken
      // Esc ve geri al/yinele yine çalışır; ok tuşları kontrolün kendisine kalır.
      const t = e.target;
      const textEntry =
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement ||
        (t instanceof HTMLInputElement && !['range', 'checkbox', 'button'].includes(t.type));
      if (textEntry) return;
      const onControl = t instanceof HTMLInputElement;
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (ctrl && key === 'z' && !e.shiftKey) useBuildStore.getState().undo();
      else if (ctrl && (key === 'y' || (key === 'z' && e.shiftKey)))
        useBuildStore.getState().redo();
      else if (e.key === 'Escape') back();
      // Editörlerde ok/Enter/Backspace kontrollerin kendisine kalır.
      else if (EDITOR_LEVELS.includes(level) || onControl) return;
      else if (e.key === 'ArrowDown') move(1);
      else if (e.key === 'ArrowUp') move(-1);
      else if (e.key === 'Enter') activate(highlight);
      else if (e.key === 'Backspace') back();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move, activate, back, highlight, level]);

  const title =
    level === 'categories'
      ? car.manifest.displayName
      : level !== 'options' && level !== 'paint'
        ? categoryLabel(categoryId as string)
        : level === 'paint'
          ? t(`paintZone.${paintZone}`)
          : slotLabel(slotId as string);
  const hintKey = level === 'options' && slotId ? `slotHint.${slotId}` : '';

  return (
    <div className="gm-root">
      <div className={`gm-panel${EDITOR_LEVELS.includes(level) ? ' is-wide' : ''}`}>
        <div className="gm-header">
          {level !== 'categories' && (
            <button type="button" className="gm-back" onClick={back} aria-label={t('ui.back')}>
              ‹
            </button>
          )}
          <div>
            <div className="gm-kicker" lang={level === 'categories' ? undefined : 'en'}>
              {level === 'categories' ? t('app.title') : car.manifest.displayName}
            </div>
            <div className="gm-title" lang={level === 'categories' ? 'en' : undefined}>
              {title}
            </div>
          </div>
        </div>
        {level === 'garage' ? (
          <GarageEditor />
        ) : level === 'photo' ? (
          <PhotoEditor />
        ) : level === 'performance' ? (
          <PerformanceEditor />
        ) : level === 'stance' ? (
          <StanceEditor />
        ) : level === 'look' ? (
          <LookEditor />
        ) : level === 'vinyl' ? (
          <VinylEditor />
        ) : level === 'wheels' ? (
          <WheelsEditor />
        ) : level === 'paint' && paintZone ? (
          <PaintEditor zone={paintZone} zones={car.manifest.paintZones} />
        ) : (
          <ul
            className="gm-list"
            onMouseLeave={() =>
              level === 'options' && (clearPreview(), setHighlight(installedIndex))
            }
          >
            {items.map((item, i) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`gm-item${i === highlight ? ' is-active' : ''}${item.installed ? ' is-installed' : ''}`}
                  disabled={item.disabled}
                  onMouseEnter={() => {
                    if (item.disabled) return;
                    if (i !== highlight) playUiSound('move');
                    setHighlight(i);
                    preview(i);
                  }}
                  onClick={() => activate(i)}
                >
                  <span className="gm-label">{item.label}</span>
                  <span className="gm-meta">{item.installed ? t('ui.installed') : item.meta}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {hintKey && hasTranslation(hintKey) && <div className="gm-note">{t(hintKey)}</div>}
      </div>
      <div className="gm-hints">
        {!EDITOR_LEVELS.includes(level) && <span>{t('ui.hint.navigate')}</span>}
        {!EDITOR_LEVELS.includes(level) && <span>{t('ui.hint.confirm')}</span>}
        <span>{t('ui.hint.back')}</span>
        <span>{t('ui.hint.undo')}</span>
      </div>
    </div>
  );
}
