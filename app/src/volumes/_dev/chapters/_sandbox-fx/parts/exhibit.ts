import type { Group } from 'three';
import type { StepInfo } from '@/engine/api';

/** One gallery stand: everything a step shows, with optional per-frame and on-enter hooks. */
export interface Exhibit {
  group: Group;
  update?(dt: number, t: number): void;
  enter?(info: StepInfo): void;
}
