import { useState } from 'react';
import {
  BRAKE_LEVELS,
  buildStats,
  dynoCurve,
  ENGINE_LEVELS,
  engineSpec,
  hasSupercharger,
  statFraction,
  SUSPENSION_LEVELS,
  TRANSMISSIONS,
  type BuildStats,
  type PerformanceConfig,
} from '../../../core/performance/performance';
import { useBuildStore } from '../../../core/store/stores';
import { getCar } from '../../../data/cars';
import { t } from '../../../i18n';
import { Choice, Section } from '../controls';
import './performanceEditor.css';

const STAT_KEYS: { key: keyof BuildStats; digits: number; lowerIsBetter?: boolean }[] = [
  { key: 'hp', digits: 0 },
  { key: 'torqueNm', digits: 0 },
  { key: 'weightKg', digits: 0, lowerIsBetter: true },
  { key: 'grip', digits: 2 },
  { key: 'braking', digits: 2 },
];

const DYNO = { w: 300, h: 110, pad: 6 };

function StatBar({
  stat,
  value,
  saved,
  lowerIsBetter,
  digits,
}: {
  stat: keyof BuildStats;
  value: number;
  saved: number;
  lowerIsBetter?: boolean;
  digits: number;
}) {
  const delta = value - saved;
  const better = lowerIsBetter ? delta < 0 : delta > 0;
  return (
    <div className="pf-stat">
      <div className="pf-stat-head">
        <span>{t(`stat.${stat}`)}</span>
        <strong>
          {value.toFixed(digits)}
          {Math.abs(delta) > 1e-6 && (
            <em className={better ? 'is-up' : 'is-down'}>
              {' '}
              {delta > 0 ? '+' : ''}
              {delta.toFixed(digits)}
            </em>
          )}
        </strong>
      </div>
      <div className="pf-bar">
        <span style={{ width: `${statFraction(stat, value) * 100}%` }} />
        <i style={{ left: `${statFraction(stat, saved) * 100}%` }} />
      </div>
    </div>
  );
}

function Dyno({ perf, supercharged }: { perf: PerformanceConfig; supercharged: boolean }) {
  const spec = engineSpec(perf, supercharged);
  const points = dynoCurve(spec, 28);
  const maxHp = Math.max(...points.map((p) => p.hp), 1);
  const maxTq = Math.max(...points.map((p) => p.torque), 1);
  const x = (rpm: number) =>
    DYNO.pad + ((rpm - spec.idleRpm) / (spec.redlineRpm - spec.idleRpm)) * (DYNO.w - DYNO.pad * 2);
  const y = (v: number, max: number) => DYNO.h - DYNO.pad - (v / max) * (DYNO.h - DYNO.pad * 2);
  const line = (pick: (p: (typeof points)[number]) => number, max: number) =>
    points.map((p) => `${x(p.rpm).toFixed(1)},${y(pick(p), max).toFixed(1)}`).join(' ');
  return (
    <svg
      className="pf-dyno"
      viewBox={`0 0 ${DYNO.w} ${DYNO.h}`}
      role="img"
      aria-label={t('perf.dyno')}
    >
      <polyline points={line((p) => p.torque, maxTq)} className="is-torque" />
      <polyline points={line((p) => p.hp, maxHp)} className="is-hp" />
      <text x={DYNO.pad} y={12} className="is-hp">
        {Math.round(maxHp)} hp
      </text>
      <text x={DYNO.w - DYNO.pad} y={12} textAnchor="end" className="is-torque">
        {Math.round(maxTq)} Nm
      </text>
    </svg>
  );
}

/** Performans: motor, şanzıman, fren, süspansiyon seçimi + istatistik çubukları ve dyno. */
export function PerformanceEditor() {
  const build = useBuildStore((s) => s.build);
  const { setPerformance } = useBuildStore.getState();
  const car = getCar(build.carId);
  const [hover, setHover] = useState<Partial<PerformanceConfig> | null>(null);
  const supercharged = hasSupercharger(build.parts);

  const preview: PerformanceConfig = { ...build.performance, ...hover };
  const statsFor = (performance: PerformanceConfig) =>
    buildStats({ ...build, performance }, car.parts, car.manifest.massKg);
  const saved = buildStats(build, car.parts, car.manifest.massKg);
  const shown = statsFor(preview);

  const choice = <K extends keyof PerformanceConfig>(
    key: K,
    options: readonly PerformanceConfig[K][],
    labelPrefix: string,
  ) => (
    <Choice
      options={options}
      value={build.performance[key]}
      label={(o) => t(`${labelPrefix}.${o}`)}
      onPreview={(o) => setHover({ [key]: o } as Partial<PerformanceConfig>)}
      onPick={(o) => {
        setHover(null);
        setPerformance({ [key]: o } as Partial<PerformanceConfig>);
      }}
      onLeave={() => setHover(null)}
    />
  );

  return (
    <div className="pe we pf">
      <Section title={t('perf.stats')}>
        {STAT_KEYS.map(({ key, digits, lowerIsBetter }) => (
          <StatBar
            key={key}
            stat={key}
            value={shown[key]}
            saved={saved[key]}
            digits={digits}
            lowerIsBetter={lowerIsBetter}
          />
        ))}
        <Dyno perf={preview} supercharged={supercharged} />
        <p className="we-info">{t(supercharged ? 'perf.supercharger' : 'perf.supercharger.off')}</p>
      </Section>
      <Section title={t('perf.engine')}>{choice('engine', ENGINE_LEVELS, 'perfEngine')}</Section>
      <Section title={t('perf.transmission')}>
        {choice('transmission', TRANSMISSIONS, 'perfTransmission')}
      </Section>
      <Section title={t('perf.brakes')}>{choice('brakes', BRAKE_LEVELS, 'perfBrakes')}</Section>
      <Section title={t('perf.suspension')}>
        {choice('suspension', SUSPENSION_LEVELS, 'perfSuspension')}
      </Section>
    </div>
  );
}
