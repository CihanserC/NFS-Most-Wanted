import { useEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import type { Material } from 'three';
import { applyModelState, slotsNeedingPlaceholder } from '../core/model/modelRules';
import { formatWarnings, prepareModel, type PreparedModel } from '../core/model/prepareModel';
import type { CarDefinition } from '../data/cars';
import { sharedMaterialMap } from './materials/carMaterials';
import { useCarMaterials } from './materials/useCarMaterials';
import { loadCarModel } from './model/modelLoader';
import { resolveModelUrl } from './model/modelUrl';
import { PlaceholderBody } from './procedural/PlaceholderBody';
import { slotRenderers } from './slots/registry';
import { isRenderedSlot } from './slots/slotIds';

/** Aynı model için uyarılar oturum başına bir kez yazılır (yeniden bağlanmalarda tekrarlanmasın). */
const warnedUrls = new Set<string>();

/**
 * Gerçek model varsa (manifest `model` ya da dev `?model=`) onu, yoksa/yüklenemezse/gövdesi eksikse
 * prosedürel placeholder'ı çizer. Modelde bulunmayan slot seçenekleri tek tek placeholder'a düşer.
 */
function useCarModel(car: CarDefinition): PreparedModel | null {
  const gl = useThree((s) => s.gl);
  const materials = useCarMaterials();
  const shared = useMemo(() => sharedMaterialMap(materials), [materials]);
  const url = resolveModelUrl(car.manifest);
  const [state, setState] = useState<{ url: string; model: PreparedModel } | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    loadCarModel(url, gl)
      .then((gltf) => {
        if (cancelled) return;
        const model = prepareModel(
          gltf.scene,
          car.manifest,
          shared as ReadonlyMap<string, Material>,
          car.modelMap,
        );
        if (!warnedUrls.has(url)) {
          warnedUrls.add(url);
          const text = formatWarnings(url, model.warnings);
          if (text) console.warn(text);
        }
        // Gövdesiz model kullanılamaz: placeholder'da kalınır.
        if (model.analysis.usable) setState({ url, model });
      })
      .catch((error: unknown) => {
        console.warn(`[Model] ${url} yüklenemedi, placeholder çiziliyor:`, error);
      });
    return () => {
      cancelled = true;
    };
  }, [url, gl, car, shared]);

  return url !== null && state?.url === url ? state.model : null;
}

/** Araç gövdesi + slot parçaları (model ya da placeholder). Tekerlekler ayrı (prosedürel). */
export function CarShell({ car, parts }: { car: CarDefinition; parts: Record<string, string> }) {
  const model = useCarModel(car);

  useEffect(() => {
    if (model) applyModelState(model.analysis, parts);
  }, [model, parts]);

  const fallback = useMemo(
    () => (model ? new Set(slotsNeedingPlaceholder(model.analysis, car.manifest, parts)) : null),
    [model, car, parts],
  );

  return (
    <>
      {model ? <primitive object={model.root} /> : <PlaceholderBody car={car} parts={parts} />}
      {Object.keys(car.manifest.slots)
        .filter(isRenderedSlot)
        // Model varsa yalnızca modelde karşılığı olmayan slotlar placeholder çizer.
        .filter((slotId) => !fallback || fallback.has(slotId))
        .map((slotId) => {
          const Renderer = slotRenderers[slotId];
          const option = parts[slotId];
          if (option === undefined) return null;
          return (
            <Renderer
              key={slotId}
              option={option}
              parts={parts}
              car={car}
              onModel={Boolean(model)}
            />
          );
        })}
    </>
  );
}
