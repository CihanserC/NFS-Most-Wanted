import { useEffect, useMemo } from 'react';
import { axleBodies, trackLimitMm } from '../../../car/fitmentBody';
import {
  effectiveTrackMm,
  presetStance,
  stanceData,
  STANCE_PRESETS,
} from '../../../core/stance/stance';
import type { StanceConfig } from '../../../core/stance/stance';
import {
  useBuildStore,
  useEffectiveFitment,
  useEffectiveLook,
  useEffectiveParts,
} from '../../../core/store/stores';
import { checkFitment } from '../../../core/wheels/fitment';
import { AXLES, type Axle } from '../../../core/wheels/types';
import { getCar } from '../../../data/cars';
import { t } from '../../../i18n';
import { Choice, Section, Slider } from '../controls';

const { limits } = stanceData;
const mm = (v: number) => `${v > 0 ? '+' : ''}${v} mm`;
const deg = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}°`;

type Key = keyof StanceConfig;

/** Duruş editörü: sürüş yüksekliği, kamber ve spacer (ön/arka ayrı) + hazır duruşlar. */
export function StanceEditor() {
  const { stance } = useEffectiveLook();
  const saved = useBuildStore((s) => s.build);
  const fitment = useEffectiveFitment();
  const parts = useEffectiveParts();
  const { setLook, previewLook, commitLookPreview, clearLookPreview } = useBuildStore.getState();
  const car = getCar(saved.carId);
  const limitMm = trackLimitMm(car, parts);

  useEffect(() => () => clearLookPreview(), [clearLookPreview]);

  const drag = (key: Key, axle: Axle, v: number) =>
    previewLook({ stance: { ...stance, [key]: { ...stance[key], [axle]: v } } });

  const issues = useMemo(
    () =>
      checkFitment(fitment, axleBodies(car, parts), stance.rideHeightMm, {
        trackMm: {
          front: effectiveTrackMm(stance, 'front', limitMm),
          rear: effectiveTrackMm(stance, 'rear', limitMm),
        },
        camberDeg: stance.camberDeg,
      }),
    [fitment, car, parts, stance, limitMm],
  );

  const sliders: { key: Key; limit: typeof limits.rideHeightMm; format: (v: number) => string }[] =
    [
      { key: 'rideHeightMm', limit: limits.rideHeightMm, format: mm },
      { key: 'camberDeg', limit: limits.camberDeg, format: deg },
      { key: 'trackMm', limit: limits.trackMm, format: (v) => `${v} mm` },
    ];

  return (
    <div className="pe we">
      <section>
        {issues.length > 0 ? (
          <ul className="we-issues">
            {issues.map((i) => (
              <li key={`${i.axle}-${i.code}`}>
                {t(`axle.${i.axle}`)}: {t(`fitment.${i.code}`)} ({i.amountMm} mm)
              </li>
            ))}
          </ul>
        ) : (
          <p className="pe-ok">{t('fitment.ok')}</p>
        )}
      </section>

      <Section title={t('stance.presets')}>
        <Choice
          options={STANCE_PRESETS}
          value={
            STANCE_PRESETS.find(
              (p) => JSON.stringify(presetStance(p)) === JSON.stringify(saved.stance),
            ) ?? ''
          }
          label={(p) => t(`stancePreset.${p}`)}
          onPreview={(p) => previewLook({ stance: presetStance(p) })}
          onPick={(p) => setLook({ stance: presetStance(p) })}
          onLeave={clearLookPreview}
        />
      </Section>

      {sliders.map(({ key, limit, format }) => (
        <Section key={key} title={t(`stance.${key}`)}>
          {AXLES.map((axle) => (
            <Slider
              key={axle}
              label={t(`axle.${axle}`)}
              value={stance[key][axle]}
              min={limit.min}
              max={
                key === 'trackMm' && Number.isFinite(limitMm)
                  ? Math.min(limit.max, limitMm)
                  : limit.max
              }
              step={limit.step}
              format={format}
              onPreview={(v) => drag(key, axle, v)}
              onCommit={commitLookPreview}
            />
          ))}
        </Section>
      ))}
      {Number.isFinite(limitMm) && (
        <p className="we-info">{t('stance.trackLimit').replace('{v}', String(limitMm))}</p>
      )}
    </div>
  );
}
