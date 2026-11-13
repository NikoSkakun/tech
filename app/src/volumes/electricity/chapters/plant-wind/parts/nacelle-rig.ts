/**
 * Runtime control of the hero nacelle: which drive train is installed (units slide out and in, 0.8 s —
 * document, step 6), how fast every shaft turns, where the shared units (brake, converter) sit in each set.
 */
import type { Object3D } from 'three';
import type { TweenScope } from '@/engine/api';
import { DRIVETRAINS, type DrivetrainId } from '@electricity/sim/plant-wind';
import type { Nacelle } from './nacelle';

const IDS: readonly DrivetrainId[] = ['A_DFIG', 'B_DIRECT', 'C_MEDIUM'];
/** Brake position (nacelle units): on the fast shaft behind the gearbox (A), behind the generator (B, C). */
const BRAKE: Record<DrivetrainId, readonly [number, number, number]> = {
  A_DFIG: [0.2, 0.3, -3.22],
  B_DIRECT: [0, 0, 0.02],
  C_MEDIUM: [0, 0, -2.98],
};
const CONVERTER: readonly [number, number, number] = [1.78, -2.0, -7.95];
/** Shafts above this speed would strobe: cap the visible speed (the blur marks still read as "fast"). */
const MAX_VISIBLE = 17; // rad/s

export interface NacelleRig {
  room: Nacelle;
  readonly variant: DrivetrainId;
  setVariant(id: DrivetrainId, instant?: boolean): void;
  /** Anchor of the gearbox / generator of the installed set (the direct drive has no gearbox: its generator). */
  anchorOf(kind: 'gearbox' | 'generator'): Object3D;
  update(dt: number, rotorSpeed: number, wind: number): void;
}

export function rigNacelle(room: Nacelle, k: number, tweens: TweenScope): NacelleRig {
  const mix: Record<DrivetrainId, number> = { A_DFIG: 1, B_DIRECT: 0, C_MEDIUM: 0 };
  let variant: DrivetrainId = 'A_DFIG';
  const part = (name: string): Object3D => room.model.part(name);
  const apply = (): void => {
    for (const u of room.drive.units) {
      const g = part(u.part);
      const m = Math.min(1, u.sets.reduce((a, id) => a + mix[id], 0));
      g.visible = m > 0.01;
      g.scale.setScalar(k * Math.max(0.001, Math.min(1, m * 1.25)));
      g.position.set(u.away[0], u.away[1], u.away[2]).multiplyScalar(k * (1 - m));
    }
    // shared units glide between their seats
    const brake = part('brake');
    const conv = part('converter');
    let bx = 0;
    let by = 0;
    let bz = 0;
    let share = 0;
    for (const id of IDS) {
      bx += BRAKE[id][0] * mix[id];
      by += BRAKE[id][1] * mix[id];
      bz += BRAKE[id][2] * mix[id];
      share += DRIVETRAINS[id].converterShare * mix[id];
    }
    brake.position.set(bx * k, by * k, bz * k);
    conv.position.set(CONVERTER[0] * k, CONVERTER[1] * k, CONVERTER[2] * k);
    // the cabinet is as long as the share of power it has to convert (DFIG ≈ 30 %, full-scale 100 %)
    conv.scale.set(k, k, k * (0.22 + 0.78 * share));
  };
  apply();
  const rig: NacelleRig = {
    room,
    get variant() {
      return variant;
    },
    setVariant(id, instant = false) {
      variant = id;
      const target = { A_DFIG: 0, B_DIRECT: 0, C_MEDIUM: 0, [id]: 1 };
      if (instant) {
        Object.assign(mix, target);
        apply();
      } else tweens.to(mix, target, { duration: 0.8, ease: 'power2.inOut', onUpdate: apply });
    },
    anchorOf(kind) {
      const suffix = variant === 'A_DFIG' ? 'A' : variant === 'B_DIRECT' ? 'B' : 'C';
      return room.at(kind === 'gearbox' && variant !== 'B_DIRECT' ? `gearbox${suffix}` : `generator${suffix}`);
    },
    update(dt, rotorSpeed, wind) {
      for (const s of room.drive.spinners) {
        const on = s.sets.some((id) => mix[id] > 0.01);
        part(s.part).visible = on;
        if (on) part(s.part).rotation.z -= Math.min(MAX_VISIBLE, rotorSpeed * s.ratio) * dt;
      }
      room.update(dt, wind);
    },
  };
  return rig;
}
