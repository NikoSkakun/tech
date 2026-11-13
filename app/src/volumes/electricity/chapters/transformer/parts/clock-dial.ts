/**
 * A vector-group «clock face» (step 7): a dark dial with 12 hour ticks (12, 3, 6, 9 and the neighbours of 12
 * labelled), the phasor diagram of one winding — a star (three arrows from the centre) or a delta (a triangle
 * through the three phase points) in L1 / L2 / L3 colours — and the hour hand pointing at the L1 phase point. The
 * whole diagram turns to `angleCwDeg` (clockwise from 12, the HV reference). Lengths per phase follow `setLengths`
 * (the unbalance demo). Lies in its local XY plane, facing +Z.
 */
import { CircleGeometry, Group, Mesh, RingGeometry, Vector3 } from 'three';
import { createVectorArrow, RibbonLines } from '@/fx';
import { K, SEMANTIC } from '@/style';
import { tag } from '../world';

const PHASE = [SEMANTIC.phaseL1, SEMANTIC.phaseL2, SEMANTIC.phaseL3] as const;

export interface ClockDial {
  group: Group;
  set(kind: 'star' | 'delta', angleCwDeg: number, instant?: boolean): void;
  setLengths(k: [number, number, number]): void;
  update(dt: number): void;
}

export function createClockDial(r = 0.78): ClockDial {
  const group = new Group();
  const face = new Mesh(new CircleGeometry(r, 64), K.toon({ color: 'ink', rim: 0.6 }));
  const rim = new Mesh(new RingGeometry(r, r + 0.06, 64), K.toon({ color: 'violet', gloss: 0.4 }));
  rim.position.z = 0.005;
  group.add(face, rim);
  const ticks = new RibbonLines({ capacity: 64, color: 'mist', width: 0.03, keepHue: true });
  ticks.setLines(
    Array.from({ length: 12 }, (_, h) => {
      const a = Math.PI / 2 - (h / 12) * Math.PI * 2;
      const r0 = h % 3 === 0 ? r * 0.8 : r * 0.87;
      return { points: [new Vector3(Math.cos(a) * r0, Math.sin(a) * r0, 0.01), new Vector3(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95, 0.01)] };
    }),
  );
  ticks.intensity = 0.8;
  group.add(ticks);
  for (const h of [12, 1, 3, 6, 9, 11]) {
    const a = Math.PI / 2 - (h / 12) * Math.PI * 2;
    const t = tag(String(h), 21, h === 12 || h === 11 || h === 1 ? 'white' : 'mist');
    t.position.set(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2, 0.02);
    group.add(t);
  }
  const diagram = new Group();
  diagram.position.z = 0.03;
  group.add(diagram);
  const arrows = PHASE.map((c) => createVectorArrow({ color: c }));
  const tri = new RibbonLines({ capacity: 64, color: 'white', width: 0.045, keepHue: true });
  diagram.add(...arrows, tri);
  const hand = createVectorArrow({ color: 'yellow' });
  hand.position.z = 0.06;
  group.add(hand);
  let kind: 'star' | 'delta' = 'star';
  let target = 0;
  let angle = 0;
  let len: [number, number, number] = [1, 1, 1];
  const o = new Vector3();
  const v = new Vector3();
  const draw = (): void => {
    const pts = [0, 1, 2].map((k) => {
      const a = -(k * 2 * Math.PI) / 3; // L2 lags 120° → 4 o'clock, L3 → 8 o'clock (clockwise on the dial)
      return new Vector3(Math.sin(-a) * r * 0.62 * len[k]!, Math.cos(a) * r * 0.62 * len[k]!, 0);
    });
    arrows.forEach((ar, k) => {
      ar.visible = kind === 'star';
      ar.set(o.set(0, 0, 0), v.copy(pts[k]!));
    });
    tri.visible = kind === 'delta';
    tri.setLines(kind === 'delta' ? [{ points: [...pts, pts[0]!.clone()].map((p) => p.clone()), closed: false }] : []);
    hand.set(o.set(0, 0, 0), v.set(Math.sin((angle * Math.PI) / 180), Math.cos((angle * Math.PI) / 180), 0).multiplyScalar(r * 0.78));
  };
  const dial: ClockDial = {
    group,
    set(k, deg, instant = false) {
      kind = k;
      target = deg > 180 ? deg - 360 : deg;
      if (instant) angle = target;
      diagram.rotation.z = (-angle * Math.PI) / 180;
      draw();
    },
    setLengths(k) {
      len = k;
      draw();
    },
    update(dt) {
      if (Math.abs(target - angle) < 0.01) return;
      angle += (target - angle) * Math.min(1, dt * 5);
      diagram.rotation.z = (-angle * Math.PI) / 180;
      draw();
    },
  };
  dial.set('star', 0, true);
  return dial;
}
