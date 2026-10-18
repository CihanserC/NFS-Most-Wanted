import { useEffect, useMemo, useRef } from 'react';
import { DepthOfField } from '@react-three/postprocessing';
import { useFrame, useThree } from '@react-three/fiber';
import type { DepthOfFieldEffect } from 'postprocessing';
import type { Vector3 } from 'three';
import { ExposureEffect } from './ExposureEffect';

/** Pozlama telafisi (EV). Ton eşlemeden önce çalışır; 0 = değişmez. */
export function Exposure({ stops }: { stops: number }) {
  const effect = useMemo(() => new ExposureEffect(), []);
  useEffect(() => () => effect.dispose(), [effect]);
  return <primitive object={effect} stops={stops} />;
}

type OrbitLike = { target: Vector3 };

/** Alan derinliği: odak noktası her karede yörünge kontrolünün hedefini (aracı) izler. */
export function PhotoDepthOfField({ bokeh, focusRange }: { bokeh: number; focusRange: number }) {
  const effect = useRef<DepthOfFieldEffect>(null);
  const controls = useThree((s) => s.controls) as OrbitLike | null;
  useFrame(() => {
    const target = effect.current?.target;
    if (target && controls) target.copy(controls.target);
  });
  return (
    <DepthOfField
      ref={effect}
      target={[0, 0.6, 0]}
      worldFocusRange={focusRange}
      bokehScale={bokeh}
      resolutionScale={0.6}
    />
  );
}
