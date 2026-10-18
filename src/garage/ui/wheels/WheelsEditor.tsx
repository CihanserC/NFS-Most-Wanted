import { useEffect, useMemo } from 'react';
import { axleBodies } from '../../../car/fitmentBody';
import { checkFitment } from '../../../core/wheels/fitment';
import {
  CALIPER_PISTONS,
  COLORED_FINISHES,
  REAR_ONLY_TIRE_TYPES,
  ROTOR_TYPES,
  TIRE_SIDEWALLS,
  TIRE_TYPES,
  WHEEL_FINISHES,
  WHEEL_STYLES,
  type Axle,
  type FitmentState,
  type TireConfig,
  type WheelConfig,
} from '../../../core/wheels/types';
import { rimMetrics } from '../../../core/wheels/dimensions';
import {
  maxDiscMm,
  tireLook,
  tireOuterDiameterMm,
  wheelLimits,
  wheelStyles,
} from '../../../core/wheels/wheels';
import { useAppStore } from '../../../core/store/appStore';
import { useBuildStore, useEffectiveFitment, useEffectiveParts } from '../../../core/store/stores';
import { getCar } from '../../../data/cars';
import { t } from '../../../i18n';
import { Choice, ColorRow, Section, Slider } from '../controls';
import '../paint/paintEditor.css';
import './wheelsEditor.css';

const inches = (v: number) => `${v}"`;
const mm = (v: number) => `${v} mm`;

/** Jant, lastik ve fren editörü. Ön/arka bağlıyken düzenleme iki aksa birden uygulanır. */
export function WheelsEditor() {
  const fitment = useEffectiveFitment();
  const saved = useBuildStore((s) => s.build);
  const parts = useEffectiveParts();
  const { setFitment, previewFitment, commitFitmentPreview, clearFitmentPreview } =
    useBuildStore.getState();
  const axle = useAppStore((s) => s.wheelAxle);
  const linked = useAppStore((s) => s.wheelsLinked);
  const { setWheelAxle, setWheelsLinked } = useAppStore.getState();
  const car = getCar(saved.carId);

  useEffect(() => () => clearFitmentPreview(), [clearFitmentPreview]);

  const wheel = fitment.wheels[axle];
  const tire = fitment.tires[axle];
  const axles: Axle[] = linked ? ['front', 'rear'] : [axle];

  /** Bağlı modda ön/arka aynı değeri alır; staggered'da sadece seçili aks. */
  const wheelPatch = (patch: Partial<WheelConfig>, base: FitmentState): Partial<FitmentState> => {
    const wheels = { ...base.wheels };
    for (const a of axles) wheels[a] = { ...base.wheels[a], ...patch };
    return { wheels };
  };
  const tirePatch = (patch: Partial<TireConfig>, base: FitmentState): Partial<FitmentState> => {
    const tires = { ...base.tires };
    for (const a of axles) tires[a] = { ...base.tires[a], ...patch };
    return { tires };
  };
  const savedFitment: FitmentState = {
    wheels: saved.wheels,
    tires: saved.tires,
    brakes: saved.brakes,
  };

  // Sürüklemeli kontroller güncel (önizleme dahil) durumdan, hover kontrolleri kayıtlı durumdan türetilir.
  const dragWheel = (p: Partial<WheelConfig>) => previewFitment(wheelPatch(p, fitment));
  const dragTire = (p: Partial<TireConfig>) => previewFitment(tirePatch(p, fitment));
  const hoverWheel = (p: Partial<WheelConfig>) => previewFitment(wheelPatch(p, savedFitment));
  const pickWheel = (p: Partial<WheelConfig>) => setFitment(wheelPatch(p, savedFitment));
  const hoverTire = (p: Partial<TireConfig>) => previewFitment(tirePatch(p, savedFitment));
  const pickTire = (p: Partial<TireConfig>) => setFitment(tirePatch(p, savedFitment));
  const brakePatch = (p: Partial<FitmentState['brakes']>, base: FitmentState) => ({
    brakes: { ...base.brakes, ...p },
  });

  const style = wheelStyles[wheel.style];
  const outer = tireOuterDiameterMm(wheel.diameterIn, tire);
  const look = tireLook(wheel, tire);
  const discMax = Math.min(
    maxDiscMm(fitment.wheels.front.diameterIn),
    maxDiscMm(fitment.wheels.rear.diameterIn),
  );

  const issues = useMemo(
    () => checkFitment(fitment, axleBodies(car, parts)),
    [fitment, car, parts],
  );

  const toggleLinked = (on: boolean) => {
    if (on) {
      // Bağlarken ön ayarlar arkaya kopyalanır (tek undo adımı).
      setFitment({
        wheels: { front: saved.wheels.front, rear: saved.wheels.front },
        tires: {
          front: saved.tires.front,
          rear: { ...saved.tires.front },
        },
      });
    }
    setWheelsLinked(on);
  };

  return (
    <div className="pe we">
      <section>
        <label className="we-check">
          <input
            type="checkbox"
            checked={!linked}
            onChange={(e) => toggleLinked(!e.target.checked)}
          />
          {t('wheels.staggered')}
        </label>
        {!linked && (
          <div className="pe-tabs">
            {(['front', 'rear'] as const).map((a) => (
              <button
                key={a}
                type="button"
                className={`pe-tab${axle === a ? ' is-active' : ''}`}
                onClick={() => setWheelAxle(a)}
              >
                {t(`axle.${a}`)}
              </button>
            ))}
          </div>
        )}
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

      <Section title={t('wheels.style')}>
        <Choice
          options={WHEEL_STYLES}
          value={wheel.style}
          label={(s) => t(`wheelStyle.${s}`)}
          onPreview={(s) =>
            hoverWheel({
              style: s,
              lipIn: wheelStyles[s].lipIn.default,
              spokes: wheelStyles[s].spokes?.default ?? wheel.spokes,
            })
          }
          onPick={(s) =>
            pickWheel({
              style: s,
              lipIn: wheelStyles[s].lipIn.default,
              spokes: wheelStyles[s].spokes?.default ?? wheel.spokes,
            })
          }
          onLeave={clearFitmentPreview}
        />
      </Section>

      <Section title={t('wheels.size')}>
        <Slider
          label={t('wheels.diameter')}
          value={wheel.diameterIn}
          {...wheelLimits.diameterIn}
          format={inches}
          onPreview={(v) => dragWheel({ diameterIn: v })}
          onCommit={commitFitmentPreview}
        />
        <Slider
          label={t('wheels.width')}
          value={wheel.widthIn}
          {...wheelLimits.widthIn}
          format={inches}
          onPreview={(v) => dragWheel({ widthIn: v })}
          onCommit={commitFitmentPreview}
        />
        <Slider
          label={t('wheels.offset')}
          value={wheel.offsetMm}
          {...wheelLimits.offsetMm}
          format={(v) => `ET ${v}`}
          onPreview={(v) => dragWheel({ offsetMm: v })}
          onCommit={commitFitmentPreview}
        />
        <Slider
          label={t('wheels.lip')}
          value={wheel.lipIn}
          min={style.lipIn.min}
          max={style.lipIn.max}
          step={0.25}
          format={inches}
          onPreview={(v) => dragWheel({ lipIn: v })}
          onCommit={commitFitmentPreview}
        />
        {rimMetrics(wheel).effectiveLipIn < wheel.lipIn - 0.01 && (
          <p className="we-info">
            {t('wheels.lipLimited').replace('{v}', rimMetrics(wheel).effectiveLipIn.toFixed(1))}
          </p>
        )}
        {style.spokes && (
          <Slider
            label={t(
              wheel.style === 'drag' || wheel.style === 'steel_dogdish'
                ? 'wheels.holes'
                : 'wheels.spokes',
            )}
            value={wheel.spokes}
            min={style.spokes.min}
            max={style.spokes.max}
            step={1}
            format={String}
            onPreview={(v) => dragWheel({ spokes: v })}
            onCommit={commitFitmentPreview}
          />
        )}
      </Section>

      <Section title={t('wheels.finish')}>
        <Choice
          options={WHEEL_FINISHES}
          value={wheel.finish}
          label={(f) => t(`wheelFinish.${f}`)}
          onPreview={(f) => hoverWheel({ finish: f })}
          onPick={(f) => pickWheel({ finish: f })}
          onLeave={clearFitmentPreview}
        />
        {COLORED_FINISHES.includes(wheel.finish) && (
          <ColorRow
            value={wheel.color}
            onPreview={(c) => hoverWheel({ color: c })}
            onPick={(c) => pickWheel({ color: c })}
            onLeave={clearFitmentPreview}
          />
        )}
        <div className="we-row">
          <label className="we-check">
            <input
              type="checkbox"
              checked={wheel.centerCap}
              onChange={(e) => pickWheel({ centerCap: e.target.checked })}
            />
            {t('wheels.centerCap')}
          </label>
          <label className="we-check">
            <input
              type="checkbox"
              checked={wheel.lugNuts}
              onChange={(e) => pickWheel({ lugNuts: e.target.checked })}
            />
            {t('wheels.lugNuts')}
          </label>
        </div>
      </Section>

      <Section title={t('tires.title')}>
        <Slider
          label={t('tires.width')}
          value={tire.widthMm}
          {...wheelLimits.tireWidthMm}
          format={mm}
          onPreview={(v) => dragTire({ widthMm: v })}
          onCommit={commitFitmentPreview}
        />
        <Slider
          label={t('tires.aspect')}
          value={tire.aspect}
          {...wheelLimits.tireAspect}
          format={(v) => `%${v}`}
          onPreview={(v) => dragTire({ aspect: v })}
          onCommit={commitFitmentPreview}
        />
        <p className="we-info">
          {tire.widthMm}/{tire.aspect}R{wheel.diameterIn} · {t('tires.outerDiameter')}{' '}
          {Math.round(outer)} mm ({(outer / 25.4).toFixed(1)}") · {t(`tireLook.${look.look}`)}
        </p>
        <h3>{t('tires.sidewall')}</h3>
        <Choice
          options={TIRE_SIDEWALLS}
          value={tire.sidewall}
          label={(s) => t(`tireSidewall.${s}`)}
          onPreview={(s) => hoverTire({ sidewall: s })}
          onPick={(s) => pickTire({ sidewall: s })}
          onLeave={clearFitmentPreview}
        />
        <h3>{t('tires.type')}</h3>
        <Choice
          options={TIRE_TYPES}
          value={tire.type}
          label={(s) => t(`tireType.${s}`)}
          disabled={(s) => REAR_ONLY_TIRE_TYPES.includes(s) && (linked || axle === 'front')}
          onPreview={(s) => hoverTire({ type: s })}
          onPick={(s) => pickTire({ type: s })}
          onLeave={clearFitmentPreview}
        />
        {(linked || axle === 'front') && <p className="we-info">{t('tires.dragRearOnly')}</p>}
      </Section>

      <Section title={t('brakes.title')}>
        <Slider
          label={t('brakes.disc')}
          value={fitment.brakes.discMm}
          min={wheelLimits.discMm.min}
          max={discMax}
          step={wheelLimits.discMm.step}
          format={mm}
          onPreview={(v) => previewFitment(brakePatch({ discMm: v }, fitment))}
          onCommit={commitFitmentPreview}
        />
        <Choice
          options={ROTOR_TYPES}
          value={fitment.brakes.rotor}
          label={(r) => t(`rotor.${r}`)}
          onPreview={(r) => previewFitment(brakePatch({ rotor: r }, savedFitment))}
          onPick={(r) => setFitment(brakePatch({ rotor: r }, savedFitment))}
          onLeave={clearFitmentPreview}
        />
        <h3>{t('brakes.caliper')}</h3>
        <Choice
          options={CALIPER_PISTONS}
          value={fitment.brakes.pistons}
          label={(p) => t('brakes.pistons').replace('{n}', String(p))}
          onPreview={(p) => previewFitment(brakePatch({ pistons: p }, savedFitment))}
          onPick={(p) => setFitment(brakePatch({ pistons: p }, savedFitment))}
          onLeave={clearFitmentPreview}
        />
        <ColorRow
          value={fitment.brakes.caliperColor}
          onPreview={(c) => previewFitment(brakePatch({ caliperColor: c }, savedFitment))}
          onPick={(c) => setFitment(brakePatch({ caliperColor: c }, savedFitment))}
          onLeave={clearFitmentPreview}
        />
      </Section>
    </div>
  );
}
