import { useMemo } from 'react';
import { DEFAULT_CAR_ID, getCar } from '../../data/cars';
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
