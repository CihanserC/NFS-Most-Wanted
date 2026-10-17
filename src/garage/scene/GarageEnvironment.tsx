import { Environment, Lightformer } from '@react-three/drei';
import { sceneConfig } from './sceneConfig';

const FACE_DOWN = Math.PI / 2;
const FACE_SIDE = Math.PI / 2;

/** Tamamen prosedürel ortam haritası: boya yansımasında şeritli softbox çizgileri üretir. */
export function GarageEnvironment() {
  const { resolution, softboxes, warm, cool } = sceneConfig.environment;
  return (
    <Environment resolution={resolution} frames={1}>
      {softboxes.map((box, i) => (
        <Lightformer
          key={i}
          form="rect"
          intensity={box.intensity}
          position={box.position}
          scale={box.scale}
          rotation-x={FACE_DOWN}
        />
      ))}
      <Lightformer
        form="rect"
        color={warm.color}
        intensity={warm.intensity}
        position={warm.position}
        scale={warm.scale}
        rotation-y={FACE_SIDE}
      />
      <Lightformer
        form="rect"
        color={cool.color}
        intensity={cool.intensity}
        position={cool.position}
        scale={cool.scale}
        rotation-y={-FACE_SIDE}
      />
    </Environment>
  );
}
