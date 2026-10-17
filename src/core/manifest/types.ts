import type { Vec3 } from '../math/tuples';

export const WHEEL_IDS = ['FL', 'FR', 'RL', 'RR'] as const;
export type WheelId = (typeof WHEEL_IDS)[number];

export const DRIVETRAINS = ['RWD', 'FWD', 'AWD'] as const;
export type Drivetrain = (typeof DRIVETRAINS)[number];

export type CameraPreset = { position: Vec3; target: Vec3 };

export type SlotDefinition = {
  options: string[];
  default: string;
  /** cameraPresets içindeki bir anahtar. */
  camera: string;
};

export type CarManifest = {
  id: string;
  displayName: string;
  units: 'meters';
  forwardAxis: '+Z';
  dimensions: { length: number; width: number; height: number; wheelbase: number };
  massKg: number;
  drivetrain: Drivetrain;
  /** GLB yolu; null ise prosedürel placeholder çizilir. */
  model: string | null;
  wheels: Record<WheelId, { position: Vec3 }> & {
    wellClearanceMm: { front: number; rear: number };
  };
  paintZones: string[];
  defaultCamera: string;
  cameraPresets: Record<string, CameraPreset>;
  slots: Record<string, SlotDefinition>;
};
