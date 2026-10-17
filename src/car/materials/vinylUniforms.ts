import { Matrix4, Texture, Vector3, type IUniform } from 'three';
import { vinylConfig, type ProjectionBox } from '../../core/vinyl/projection';
import type { VinylLayer, VinylSide } from '../../core/vinyl/types';

/** Tüm boya materyallerinin paylaştığı vinil uniform'ları (tek nesne, referansla paylaşılır). */
export type VinylUniforms = {
  uVinylEnabled: IUniform<number>;
  /** Araç kök grubunun dünya matrisinin tersi: dünya -> car-space */
  uCarInverse: IUniform<Matrix4>;
  /** (yarı uzunluk, yarı genişlik, yükseklik) projeksiyon kutusu */
  uVinylBox: IUniform<Vector3>;
  uVinylSharpness: IUniform<number>;
  uVinylLeft: IUniform<Texture>;
  uVinylRight: IUniform<Texture>;
  uVinylTop: IUniform<Texture>;
  uVinylFront: IUniform<Texture>;
  uVinylRear: IUniform<Texture>;
};

export function createVinylUniforms(
  box: ProjectionBox,
  textures: Record<VinylSide, Texture>,
): VinylUniforms {
  return {
    uVinylEnabled: { value: 0 },
    uCarInverse: { value: new Matrix4() },
    uVinylBox: { value: new Vector3(box.halfLength, box.halfWidth, box.height) },
    uVinylSharpness: { value: vinylConfig.blendSharpness },
    uVinylLeft: { value: textures.left },
    uVinylRight: { value: textures.right },
    uVinylTop: { value: textures.top },
    uVinylFront: { value: textures.front },
    uVinylRear: { value: textures.rear },
  };
}

/** Katman listesini dokulara iletir ve shader'da vinil örneklemeyi açar/kapatır. */
export function applyVinylLayers(
  textures: { update: (layers: VinylLayer[]) => void },
  uniforms: VinylUniforms,
  layers: VinylLayer[],
): void {
  textures.update(layers);
  uniforms.uVinylEnabled.value = layers.some((l) => l.visible) ? 1 : 0;
}
