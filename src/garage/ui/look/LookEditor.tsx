import { useEffect } from 'react';
import { stanceData } from '../../../core/stance/stance';
import { useBuildStore, useEffectiveLook, useEffectiveParts } from '../../../core/store/stores';
import { getCar } from '../../../data/cars';
import { partLabel, t } from '../../../i18n';
import { Choice, Section, Slider } from '../controls';

const { limits } = stanceData;
const percent = (v: number) => `%${Math.round(v * 100)}`;

function Swatches({
  colors,
  value,
  onPreview,
  onPick,
  onLeave,
}: {
  colors: string[];
  value: string;
  onPreview: (hex: string) => void;
  onPick: (hex: string) => void;
  onLeave: () => void;
}) {
  return (
    <div className="we-swatches" onMouseLeave={onLeave}>
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          style={{ background: c }}
          className={value === c ? 'is-active' : ''}
          onMouseEnter={() => onPreview(c)}
          onClick={() => onPick(c)}
        />
      ))}
    </div>
  );
}

/** Işıklar & Camlar: far/stop seçenekleri, far rengi, cam filmi ve underglow. */
export function LookEditor() {
  const { glass, lighting } = useEffectiveLook();
  const parts = useEffectiveParts();
  const carId = useBuildStore((s) => s.build.carId);
  const saved = useBuildStore((s) => s.build);
  const {
    setPart,
    previewPart,
    clearPreview,
    setLook,
    previewLook,
    commitLookPreview,
    clearLookPreview,
  } = useBuildStore.getState();
  const car = getCar(carId);

  useEffect(
    () => () => {
      clearLookPreview();
      clearPreview();
    },
    [clearLookPreview, clearPreview],
  );

  const slotChoice = (slotId: 'headlights' | 'taillights') => (
    <Choice
      options={car.manifest.slots[slotId]?.options ?? []}
      value={parts[slotId] ?? ''}
      label={(o) => partLabel(slotId, o)}
      onPreview={(o) => previewPart(slotId, o)}
      onPick={(o) => setPart(slotId, o)}
      onLeave={clearPreview}
    />
  );
  const ug = lighting.underglow;
  const setUnderglow = (patch: Partial<typeof ug>) =>
    setLook({
      lighting: { ...saved.lighting, underglow: { ...saved.lighting.underglow, ...patch } },
    });

  return (
    <div className="pe we">
      {car.manifest.slots.headlights && (
        <Section title={t('slot.headlights')}>
          {slotChoice('headlights')}
          <h3>{t('look.headlightColor')}</h3>
          <Swatches
            colors={stanceData.headlightColors}
            value={lighting.headlightColor}
            onPreview={(c) => previewLook({ lighting: { ...saved.lighting, headlightColor: c } })}
            onPick={(c) => setLook({ lighting: { ...saved.lighting, headlightColor: c } })}
            onLeave={clearLookPreview}
          />
        </Section>
      )}

      {car.manifest.slots.taillights && (
        <Section title={t('slot.taillights')}>{slotChoice('taillights')}</Section>
      )}

      <Section title={t('look.glass')}>
        <Slider
          label={t('look.tint')}
          value={glass.tint}
          {...limits.tint}
          format={percent}
          onPreview={(v) => previewLook({ glass: { ...glass, tint: v } })}
          onCommit={commitLookPreview}
        />
        <Swatches
          colors={stanceData.tintColors}
          value={glass.color}
          onPreview={(c) => previewLook({ glass: { ...saved.glass, color: c } })}
          onPick={(c) => setLook({ glass: { ...saved.glass, color: c } })}
          onLeave={clearLookPreview}
        />
      </Section>

      <Section title={t('look.underglow')}>
        <label className="we-check">
          <input
            type="checkbox"
            checked={ug.enabled}
            onChange={(e) => setUnderglow({ enabled: e.target.checked })}
          />
          {t('look.underglowOn')}
        </label>
        {ug.enabled && (
          <>
            <Slider
              label={t('look.intensity')}
              value={ug.intensity}
              {...limits.underglowIntensity}
              format={percent}
              onPreview={(v) =>
                previewLook({ lighting: { ...lighting, underglow: { ...ug, intensity: v } } })
              }
              onCommit={commitLookPreview}
            />
            <Swatches
              colors={stanceData.underglowColors}
              value={ug.color}
              onPreview={(c) =>
                previewLook({
                  lighting: {
                    ...saved.lighting,
                    underglow: { ...saved.lighting.underglow, color: c },
                  },
                })
              }
              onPick={(c) => setUnderglow({ color: c })}
              onLeave={clearLookPreview}
            />
          </>
        )}
      </Section>
    </div>
  );
}
