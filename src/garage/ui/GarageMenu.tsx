import { useCallback, useEffect, useMemo, useState } from 'react';
import { categoryLabel, hasTranslation, partLabel, slotLabel, t } from '../../i18n';
import { useAppStore } from '../../core/store/appStore';
import { useBuildStore } from '../../core/store/stores';
import { getCar } from '../../data/cars';
import { menuCategories } from './categories';
import './garageMenu.css';

type Item = { id: string; label: string; disabled?: boolean; meta?: string; installed?: boolean };

const formatPrice = (price: number) => (price === 0 ? '—' : `$${price.toLocaleString('tr-TR')}`);

/** Most Wanted tarzı atölye menüsü: kategori -> slot -> seçenek. */
export function GarageMenu() {
  const { categoryId, slotId, lastCategoryId, lastSlotId, selectCategory, selectSlot } =
    useAppStore();
  const carId = useBuildStore((s) => s.build.carId);
  const parts = useBuildStore((s) => s.build.parts);
  const { setPart, previewPart, clearPreview } = useBuildStore.getState();
  const car = getCar(carId);

  const level: 'categories' | 'slots' | 'options' = slotId
    ? 'options'
    : categoryId
      ? 'slots'
      : 'categories';

  const items: Item[] = useMemo(() => {
    if (level === 'categories')
      return menuCategories.map((c) => ({
        id: c.id,
        label: categoryLabel(c.id),
        disabled: c.slots.length === 0,
        meta: c.slots.length === 0 ? t('ui.comingSoon') : undefined,
      }));
    if (level === 'slots') {
      const cat = menuCategories.find((c) => c.id === categoryId);
      return (cat?.slots ?? [])
        .filter((id) => id in car.manifest.slots)
        .map((id) => ({ id, label: slotLabel(id), meta: partLabel(id, parts[id] ?? '') }));
    }
    const slot = slotId ? car.manifest.slots[slotId] : undefined;
    return (slot?.options ?? []).map((opt) => ({
      id: opt,
      label: partLabel(slotId as string, opt),
      installed: parts[slotId as string] === opt,
      meta: formatPrice(car.parts[slotId as string]?.[opt]?.price ?? 0),
    }));
  }, [level, categoryId, slotId, car, parts]);

  const installedIndex = Math.max(
    0,
    items.findIndex((i) => i.installed),
  );
  // Seviye değişince vurgu takılı parçaya / ilk öğeye döner (vurgu seviye anahtarına bağlı).
  const levelKey = `${level}|${categoryId ?? ''}|${slotId ?? ''}`;
  const lastId = level === 'categories' ? lastCategoryId : level === 'slots' ? lastSlotId : null;
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
      if (level !== 'options') setHl({ key: '', index: 0 });
      if (level === 'categories') selectCategory(item.id);
      else if (level === 'slots') selectSlot(item.id);
      else if (slotId) setPart(slotId, item.id);
    },
    [items, level, slotId, selectCategory, selectSlot, setPart],
  );

  const back = useCallback(() => {
    clearPreview();
    setHl({ key: '', index: 0 });
    if (level === 'options') selectSlot(null);
    else if (level === 'slots') selectCategory(null);
  }, [level, clearPreview, selectSlot, selectCategory]);

  const move = useCallback(
    (delta: number) => {
      if (items.length === 0) return;
      let i = highlight;
      // Devre dışı öğeleri atla.
      for (let step = 0; step < items.length; step++) {
        i = (i + delta + items.length) % items.length;
        if (!items[i]?.disabled) break;
      }
      setHighlight(i);
      preview(i);
    },
    [items, highlight, preview, setHighlight],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (ctrl && key === 'z' && !e.shiftKey) useBuildStore.getState().undo();
      else if (ctrl && (key === 'y' || (key === 'z' && e.shiftKey)))
        useBuildStore.getState().redo();
      else if (e.key === 'ArrowDown') move(1);
      else if (e.key === 'ArrowUp') move(-1);
      else if (e.key === 'Enter') activate(highlight);
      else if (e.key === 'Escape' || e.key === 'Backspace') back();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move, activate, back, highlight]);

  const title =
    level === 'categories'
      ? car.manifest.displayName
      : level === 'slots'
        ? categoryLabel(categoryId as string)
        : slotLabel(slotId as string);
  const hintKey = slotId ? `slotHint.${slotId}` : '';

  return (
    <div className="gm-root">
      <div className="gm-panel">
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
        <ul
          className="gm-list"
          onMouseLeave={() => level === 'options' && (clearPreview(), setHighlight(installedIndex))}
        >
          {items.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                className={`gm-item${i === highlight ? ' is-active' : ''}${item.installed ? ' is-installed' : ''}`}
                disabled={item.disabled}
                onMouseEnter={() => {
                  if (item.disabled) return;
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
        {hintKey && hasTranslation(hintKey) && <div className="gm-note">{t(hintKey)}</div>}
      </div>
      <div className="gm-hints">
        <span>{t('ui.hint.navigate')}</span>
        <span>{t('ui.hint.confirm')}</span>
        <span>{t('ui.hint.back')}</span>
        <span>{t('ui.hint.undo')}</span>
      </div>
    </div>
  );
}
