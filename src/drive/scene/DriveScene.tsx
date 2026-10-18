import { useRef } from 'react';
import type { Group } from 'three';
import { getDefaultTrack } from '../../core/drive/track';
import { useDriveStore } from '../../core/store/driveStore';
import { FpsProbe } from '../../garage/fx/FpsProbe';
import { PostFX } from '../../garage/fx/PostFX';
import type { VehicleSnapshot } from '../physics/VehiclePhysics';
import { DriveCar } from '../vehicle/DriveCar';
import { DriveEnvironment } from './DriveEnvironment';
import { TrackScene } from './TrackScene';

/** Test sürüşü sahnesi: pist, ortam, fizikli araç ve post-processing. */
export function DriveScene() {
  const timeOfDay = useDriveStore((s) => s.timeOfDay);
  const track = getDefaultTrack();
  const carGroup = useRef<Group>(null);
  const snapshot = useRef<VehicleSnapshot | null>(null);
  return (
    <>
      <DriveEnvironment timeOfDay={timeOfDay} target={carGroup} />
      <TrackScene track={track} night={timeOfDay === 'night'} />
      <DriveCar track={track} snapshotRef={snapshot} carGroupRef={carGroup} />
      <PostFX />
      <FpsProbe />
    </>
  );
}
