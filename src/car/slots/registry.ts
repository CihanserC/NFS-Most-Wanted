import type { ComponentType } from 'react';
import { Fenders, Hood, Mirrors, RearLouvers, RearSpoiler, Roof, SideSkirts } from './body';
import type { SlotProps } from './common';
import { ChinSpoiler, FrontBumper, Grille, Headlights } from './front';
import { Engine, Exhaust, ExhaustTips, Interior } from './mechanical';
import { FuelCap, RearBumper, Taillights } from './rear';
import type { RenderedSlotId } from './slotIds';

export const slotRenderers: Record<RenderedSlotId, ComponentType<SlotProps>> = {
  bumper_front: FrontBumper,
  bumper_rear: RearBumper,
  grille: Grille,
  chin_spoiler: ChinSpoiler,
  hood: Hood,
  side_skirts: SideSkirts,
  fenders: Fenders,
  spoiler_rear: RearSpoiler,
  rear_louvers: RearLouvers,
  roof: Roof,
  mirrors: Mirrors,
  headlights: Headlights,
  taillights: Taillights,
  exhaust: Exhaust,
  exhaust_tips: ExhaustTips,
  fuel_cap: FuelCap,
  engine: Engine,
  interior: Interior,
};
