/**
 * The meter console under the teaching transformer (step 2): six small dial meters on a sloped desk — U₁, I₁, P₁
 * with `coral` bezels on the primary side, U₂, I₂, P₂ with `sky` bezels on the secondary side. Each needle is a
 * part; `setNeedle(i, v)` takes the deflection 0…1 of full scale (> 1 pegs the needle against its stop). The
 * numbers themselves live on the board; the meters only show *that* something moves and how much.
 */
import { Vector3 } from 'three';
import { Builder, type KitModel } from '@/kit';
import { col, type ColorLike } from '@/style';

const CASE = col('slate').lerp(col('bg.indigo'), 0.25);
/** Desk tilt toward the viewer (rad). */
const TILT = -0.55;

export interface MeterConsole extends KitModel {
  setNeedle(i: number, v: number): void;
  /** Model-space centre of meter i (for its tag). */
  face(i: number): Vector3;
}

export function createMeterConsole(xs: readonly number[], bezels: readonly ColorLike[]): MeterConsole {
  const b = new Builder('meter-console');
  const w = Math.max(...xs) - Math.min(...xs) + 1.0;
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  b.box(w, 0.3, 0.7, { r: 0.06, slot: 'gloss', c: [CASE, col('slate')], at: [cx, 0, 0] });
  const faces: Vector3[] = [];
  b.frame({ at: [cx, 0.3, 0.05], rot: [TILT, 0, 0] }, () => {
    b.box(w - 0.04, 0.5, 0.06, { r: 0.04, slot: 'gloss', c: 'ink', at: [0, 0, 0] });
  });
  xs.forEach((x, i) => {
    b.frame({ at: [x, 0.3, 0.05], rot: [TILT, 0, 0] }, () => {
      b.cyl(0.27, 0.06, { axis: 'z', seg: 36, slot: 'gloss', c: bezels[i]!, at: [0, 0.26, 0.03] });
      b.cyl(0.23, 0.02, { axis: 'z', seg: 36, slot: 'gloss', c: 'white', at: [0, 0.26, 0.09] });
      for (let k = 0; k <= 5; k++) {
        const a = -0.9 + (k / 5) * 1.8;
        b.beam([Math.sin(a) * 0.15, 0.2 + Math.cos(a) * 0.15, 0.11], [Math.sin(a) * 0.2, 0.2 + Math.cos(a) * 0.2, 0.11], 0.016, { h: 0.008, slot: 'flat', c: k === 5 ? 'red' : 'ink' });
      }
      const needle = b.part(`needle${i}`, { at: [0, 0.14, 0.12] });
      needle.beam([0, 0, 0], [0, 0.24, 0], 0.016, { h: 0.01, slot: 'flat', c: 'bg.void' });
      needle.cyl(0.025, 0.02, { axis: 'z', seg: 12, slot: 'metal', c: 'steel' });
    });
    faces.push(new Vector3(0, 0.26, 0.1).applyAxisAngle(new Vector3(1, 0, 0), TILT).add(new Vector3(x, 0.3, 0.05)));
  });
  const model = b.build();
  return Object.assign(model, {
    setNeedle(i: number, v: number): void {
      const t = Math.max(0, Math.min(1.08, v));
      model.part(`needle${i}`).rotation.z = 0.9 - t * 1.8;
    },
    face: (i: number): Vector3 => faces[i]!.clone(),
  });
}

/** Rheostat: ceramic tube wound with resistance wire on two end blocks, a slider contact that moves with R. */
export interface Rheostat extends KitModel {
  /** Slider position 0 (left) … 1 (right). */
  setSlider(t: number): void;
}

export function createRheostat(length = 1.6): Rheostat {
  const b = new Builder('rheostat');
  for (const x of [-length / 2, length / 2]) b.box(0.22, 0.5, 0.38, { r: 0.04, slot: 'gloss', c: CASE, at: [x, 0, 0] });
  b.cyl(0.12, length - 0.2, { axis: 'x', seg: 28, slot: 'gloss', c: 'white', at: [-(length - 0.2) / 2, 0.36, 0] });
  for (let i = 0; i < 34; i++) b.ring(0.125, 0.008, { axis: 'x', seg: 20, tubeSeg: 4, slot: 'metal', c: 'steel.light', at: [-(length - 0.3) / 2 + (i / 33) * (length - 0.3), 0.36, 0] });
  b.rod([-length / 2, 0.56, 0], [length / 2, 0.56, 0], 0.025, { slot: 'metal', c: 'steel' });
  const slider = b.part('slider', { at: [0, 0.56, 0] });
  slider.box(0.14, 0.12, 0.16, { r: 0.03, mid: true, slot: 'gloss', c: 'ink' });
  slider.sphere(0.07, { seg: 16, slot: 'gloss', c: 'cyan', at: [0, 0.1, 0] });
  slider.beam([0, -0.04, 0], [0, -0.07, 0], 0.03, { h: 0.08, slot: 'metal', c: 'orange' });
  b.anchor('knob', 0, 0.66, 0).anchor('t1', -length / 2, 0.5, 0).anchor('t2', length / 2, 0.5, 0);
  const model = b.build();
  return Object.assign(model, {
    setSlider: (t: number): void => void (model.part('slider').position.x = -length / 2 + 0.2 + t * (length - 0.4)),
  });
}
