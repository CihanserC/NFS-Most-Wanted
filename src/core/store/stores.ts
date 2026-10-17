import { useMemo } from 'react';
import { DEFAULT_CAR_ID, getCar } from '../../data/cars';
import { fitmentOf } from '../build/build';
import type { LookFields } from '../build/types';
import type { PaintConfig } from '../paint/types';
import type { VinylLayer } from '../vinyl/types';
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

/** Kayıtlı vinil + (varsa) sürükleme önizlemesi. */
export function useEffectiveVinyl(): VinylLayer[] {
  const vinyl = useBuildStore((s) => s.build.vinyl);
  const preview = useBuildStore((s) => s.vinylPreview);
  return preview ?? vinyl;
}

/** Sadece tek bir katmana abone olur: başka katman değişince yeniden çizim tetiklenmez. */
export function useVinylLayer(id: string | null): VinylLayer | undefined {
  return useBuildStore((s) =>
    id ? (s.vinylPreview ?? s.build.vinyl).find((l) => l.id === id) : undefined,
  );
}

/** Kayıtlı duruş/cam/ışık + (varsa) önizleme. */
export function useEffectiveLook(): LookFields {
  const stance = useBuildStore((s) => s.build.stance);
  const glass = useBuildStore((s) => s.build.glass);
  const lighting = useBuildStore((s) => s.build.lighting);
  const preview = useBuildStore((s) => s.lookPreview);
  return useMemo(() => preview ?? { stance, glass, lighting }, [stance, glass, lighting, preview]);
}
