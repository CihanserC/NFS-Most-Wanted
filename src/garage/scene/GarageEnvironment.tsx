import { Environment, Lightformer } from '@react-three/drei';
import { sceneConfig } from './sceneConfig';

/** Tamamen prosedürel ortam haritası: boya ve kromda okunabilir yansımalar üretir. */
export function GarageEnvironment() {
  const { resolution, lightformers } = sceneConfig.environment;
  return (
    <Environment resolution={resolution} frames={1}>
      {lightformers.map((l, i) => (
        <Lightformer
          key={i}
          form="rect"
          color={l.color}
          intensity={l.intensity}
          position={l.position}
          scale={l.scale}
          rotation={l.rotation}
        />
      ))}
    </Environment>
  );
}
