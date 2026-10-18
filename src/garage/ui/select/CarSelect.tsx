import { useEffect, useMemo } from 'react';
import { playUiSound } from '../../../audio/uiSound';
import { createDefaultBuild } from '../../../core/build/build';
import { buildStats, statFraction, type BuildStats } from '../../../core/performance/performance';
import { enterCar, previewCar } from '../../../core/store/carSession';
import { useGarageStore } from '../../../core/store/garageStore';
import { useBuildStore } from '../../../core/store/stores';
import { listCars, type CarDefinition } from '../../../data/cars';
import { t } from '../../../i18n';
import './carSelect.css';

const STAT_KEYS: { key: keyof BuildStats; digits: number }[] = [
  { key: 'hp', digits: 0 },
  { key: 'torqueNm', digits: 0 },
  { key: 'weightKg', digits: 0 },
  { key: 'grip', digits: 2 },
];

/** Aracın stok kurulumundaki özet istatistikleri (seçim kartı çubukları). */
function stockStats(car: CarDefinition): BuildStats {
  const build = createDefaultBuild(car.manifest);
  return buildStats(build, car.parts, car.manifest.massKg);
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });

/**
 * Araç seçim ekranı: vitrinde (döner tabla) seçili araç, altta araç kartları ve stok özellikleri.
 * ←/→ (↑/↓), gamepad D-pad ve dokunmatik oklarla gezilir; Enter / A / SEÇ atölyeye geçer.
 */
export function CarSelect() {
  const cars = useMemo(() => listCars(), []);
  const stats = useMemo(() => cars.map(stockStats), [cars]);
  const carId = useBuildStore((s) => s.build.carId);
  const autosaves = useGarageStore((s) => s.autosaves);
  const index = Math.max(
    0,
    cars.findIndex((c) => c.manifest.id === carId),
  );
  const car = cars[index] as CarDefinition;

  const go = (delta: number) => {
    if (cars.length < 2) return;
    playUiSound('move');
    const next = cars[(index + delta + cars.length) % cars.length] as CarDefinition;
    void previewCar(next.manifest.id);
  };
  const choose = () => {
    playUiSound('confirm');
    void enterCar(car.manifest.id);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(-1);
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(1);
      else if (e.key === 'Enter') choose();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const saved = autosaves[car.manifest.id];
  const current = stats[index] as BuildStats;

  return (
    <div className="cs-root">
      <header className="cs-title">
        <span>{t('app.title')}</span>
        <h1>{t('select.title')}</h1>
      </header>

      <section className="cs-panel" aria-live="polite">
        <div className="cs-nav">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={cars.length < 2}
            aria-label={t('select.prev')}
          >
            ‹
          </button>
          <div className="cs-name">
            <small>{t(`car.${car.manifest.id}.tagline`)}</small>
            <strong>{car.manifest.displayName}</strong>
            {saved && (
              <em>
                {t('select.saved')} · {formatDate(saved.updatedAt)}
              </em>
            )}
          </div>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={cars.length < 2}
            aria-label={t('select.next')}
          >
            ›
          </button>
        </div>

        <ul className="cs-stats">
          {STAT_KEYS.map(({ key, digits }) => (
            <li key={key}>
              <span>{t(`stat.${key}`)}</span>
              <strong>{current[key].toFixed(digits)}</strong>
              <i>
                <b style={{ width: `${statFraction(key, current[key]) * 100}%` }} />
              </i>
            </li>
          ))}
          <li>
            <span>{t('select.drivetrain')}</span>
            <strong>{car.manifest.drivetrain}</strong>
          </li>
        </ul>

        <ul className="cs-dots" role="tablist">
          {cars.map((c, i) => (
            <li key={c.manifest.id}>
              <button
                type="button"
                role="tab"
                aria-selected={i === index}
                className={i === index ? 'is-active' : ''}
                onClick={() => void previewCar(c.manifest.id)}
              >
                {c.manifest.displayName}
              </button>
            </li>
          ))}
        </ul>

        <button type="button" className="cs-go" onClick={choose}>
          {saved ? t('select.continue') : t('select.choose')}
        </button>
      </section>

      <p className="cs-hint">{t('select.hint')}</p>
    </div>
  );
}
