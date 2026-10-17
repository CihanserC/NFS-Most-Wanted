import { useEffect, useMemo, type ReactElement } from 'react';
import {
  Bloom,
  EffectComposer,
  FXAA,
  SMAA,
  LUT,
  N8AO,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing';
import { LookupTexture, ToneMappingMode } from 'postprocessing';
import { SRGBColorSpace } from 'three';
import {
  useGraphicsStore,
  useQualityPreset,
  type ToneMappingChoice,
} from '../../core/store/graphicsStore';
import { sceneConfig } from '../scene/sceneConfig';
import { createGradeLUT } from './colorGrade';

const TONE_MAPPING_MODES: Record<ToneMappingChoice, ToneMappingMode> = {
  agx: ToneMappingMode.AGX,
  aces: ToneMappingMode.ACES_FILMIC,
};

function useGradeLUT(): LookupTexture {
  const { grade, lutSize } = sceneConfig.post;
  const lut = useMemo(() => {
    const t = new LookupTexture(createGradeLUT(grade, lutSize), lutSize);
    // LUT sRGB girdiyi sRGB çıktıya eşler.
    t.colorSpace = SRGBColorSpace;
    return t;
  }, [grade, lutSize]);
  useEffect(() => () => lut.dispose(), [lut]);
  return lut;
}

/**
 * Sıra: AO -> Bloom (HDR) -> Tone mapping -> renk düzenleme (LUT, sRGB) -> vinyet -> kenar
 * yumuşatma (SMAA/FXAA). Efektler kalite ayarına göre açılıp kapanır.
 */
export function PostFX() {
  const q = useQualityPreset();
  const toneMapping = useGraphicsStore((s) => s.toneMapping);
  const lut = useGradeLUT();
  const p = sceneConfig.post;

  const effects: ReactElement[] = [];
  if (q.ao)
    effects.push(
      <N8AO
        key="ao"
        quality={q.ao.quality}
        halfRes={q.ao.halfRes}
        aoRadius={p.ao.radius}
        distanceFalloff={p.ao.distanceFalloff}
        intensity={p.ao.intensity}
        color={p.ao.color}
      />,
    );
  if (q.bloom)
    effects.push(
      <Bloom
        key="bloom"
        mipmapBlur
        intensity={p.bloom.intensity}
        luminanceThreshold={p.bloom.threshold}
        luminanceSmoothing={p.bloom.smoothing}
        radius={p.bloom.radius}
      />,
    );
  effects.push(<ToneMapping key={`tone-${toneMapping}`} mode={TONE_MAPPING_MODES[toneMapping]} />);
  effects.push(<LUT key="lut" lut={lut} />);
  effects.push(
    <Vignette key="vignette" offset={p.vignette.offset} darkness={p.vignette.darkness} />,
  );
  effects.push(q.antialias === 'smaa' ? <SMAA key="smaa" /> : <FXAA key="fxaa" />);

  return (
    // Efekt listesi değişince composer yeniden kurulsun.
    <EffectComposer
      key={`${effects.map((e) => e.key).join('|')}|msaa${q.msaaSamples}`}
      multisampling={q.msaaSamples}
    >
      {effects}
    </EffectComposer>
  );
}
