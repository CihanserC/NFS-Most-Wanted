import { useMemo } from 'react';
import { DEFAULT_CAR_ID, getCar } from '../../data/cars';
import { fitmentOf } from '../build/build';
import type { PaintConfig } from '../paint/types';
import type { FitmentState } from '../wheels/types';
import { createBuildStore } from './buildStore';

export const useBuildStore = createBuildStore(getCar(DEFAULT_CAR_ID).manifest);

/** Kayıtlı parçalar + (varsa) önizlenen parça. */
export function useEffectiveParts(): Record<string, string> {
  const parts = useBuildStore((s) => s.build.parts);
  const preview = useBuildStore((s) => s.preview);
  return useMemo(
    () => (preview ? { ...parts, [preview.slotId]: preview.optionId } : parts),
    [parts, preview],
  );
}

/** Kayıtlı boya + (varsa) geçici boya. */
export function useEffectivePaint(): Record<string, PaintConfig> {
  const paint = useBuildStore((s) => s.build.paint);
  const preview = useBuildStore((s) => s.paintPreview);
  return useMemo(() => (preview ? { ...paint, ...preview } : paint), [paint, preview]);
}

/** Kayıtlı jant/lastik/fren + (varsa) önizleme. */
export function useEffectiveFitment(): FitmentState {
  const wheels = useBuildStore((s) => s.build.wheels);
  const tires = useBuildStore((s) => s.build.tires);
  const brakes = useBuildStore((s) => s.build.brakes);
  const preview = useBuildStore((s) => s.fitmentPreview);
  return useMemo(
    () => preview ?? fitmentOf({ wheels, tires, brakes }),
    [wheels, tires, brakes, preview],
  );
}
