/**
 * The P-V "mountain" of step 7: a hologram of a string's power curve P(U) with a climber standing at the
 * operating point. `setCurve(P(U), pMax)` reshapes the hill (ribbon + translucent fill), `setClimber(U, P)`
 * moves the figure, `setCeiling(P)` draws the inverter's power limit as a flat roof. Lies in its local XY
 * plane: x = voltage 0…`V_MAX`, y = power 0…`pTop`.
 */
import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, Vector3 } from 'three';
import { RibbonLines } from '@/fx';
import { Builder } from '@/kit';
import { K, type ColorLike } from '@/style';
import type { Text3D } from '@/text';
import { tag } from '../world';

export const MOUNTAIN = { w: 4.4, h: 2.1, vMax: 290, samples: 120 } as const;

export interface PvMountain {
  group: Group;
  /** Reshape from a power function P(U) [W]; `pTop` = power at the top of the frame. */
  setCurve(power: (v: number) => number, pTop: number): void;
  /** Put the climber on the curve at voltage U with power P (he stands on the line). */
  setClimber(vV: number, pW: number): void;
  /** Horizontal power ceiling (clipping), or null. */
  setCeiling(pW: number | null): void;
  /** Peak flag: position and text. */
  setPeak(vV: number, pW: number, text: string): void;
  label: Text3D;
  climberTag: Text3D;
  /** Local point of (U, P). */
  point(vV: number, pW: number, out?: Vector3): Vector3;
}

function climber(color: ColorLike): Group {
  const b = new Builder('climber');
  b.capsule(0.07, 0.26, { c: color, at: [0, 0.17, 0] });
  b.sphere(0.065, { c: 'white', at: [0, 0.38, 0] });
  b.box(0.2, 0.05, 0.1, { r: 0.02, c: 'slate', at: [0, 0.26, -0.08] }); // backpack
  b.rod([0.1, 0.02, 0.02], [0.14, 0.34, 0.02], 0.012, { slot: 'metal', c: 'mist' }); // ice axe
  return b.build().group;
}

export function createPvMountain(color: ColorLike = 'yellow', who: ColorLike = 'coral'): PvMountain {
  const { w, h, vMax, samples } = MOUNTAIN;
  const group = new Group();
  group.name = 'pv-mountain';
  let top = 3000;
  const X = (v: number): number => (v / vMax - 0.5) * w;
  const Y = (p: number): number => (Math.max(0, p) / top) * h;

  // axes: a base line and a short vertical one (ribbons, like the scope traces)
  const axes = new RibbonLines({
    capacity: 8,
    color: 'mist',
    width: 0.02,
    intensity: 0.7,
    hotCore: 0,
    dashStrength: 0,
    minPixels: 1.4,
  });
  axes.setLines([
    { points: [new Vector3(-w / 2, 0, 0), new Vector3(w / 2, 0, 0)] },
    { points: [new Vector3(-w / 2, 0, 0), new Vector3(-w / 2, h * 1.05, 0)] },
  ]);
  const line = new RibbonLines({
    capacity: samples + 4,
    color,
    width: 0.045,
    intensity: 1.15,
    hotCore: 0,
    dashStrength: 0,
    minPixels: 2,
    keepHue: true,
  });
  line.position.z = 0.01;
  const ceiling = new RibbonLines({
    capacity: 4,
    color: 'red',
    width: 0.035,
    intensity: 1.2,
    hotCore: 0,
    dashStrength: 0.6,
    dashRepeat: 3,
    minPixels: 1.8,
    keepHue: true,
  });
  ceiling.position.z = 0.02;
  ceiling.visible = false;
  // translucent body of the hill: a strip of quads from the base line up to the curve
  const pos = new Float32Array((samples + 1) * 2 * 3);
  const idx: number[] = [];
  for (let i = 0; i < samples; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute(
    'normal',
    new BufferAttribute(
      new Float32Array(pos.length).map((_, i) => (i % 3 === 2 ? 1 : 0)),
      3,
    ),
  );
  geo.setIndex(idx);
  const fill = new Mesh(geo, K.glass({ color, opacity: 0.16, edgeOpacity: 0.2, specular: 0 }));
  fill.material.side = DoubleSide;
  fill.renderOrder = 1;
  fill.frustumCulled = false;

  const man = climber(who);
  man.scale.setScalar(1.25);
  const flag = tag('', 20, 'yellow', 'mono');
  const label = tag('', 20, 'mist');
  label.position.set(0, -0.3, 0);
  const climberTag = tag('', 20, 'white', 'mono');
  group.add(axes, fill, line, ceiling, man, flag, label, climberTag);

  const pts = Array.from({ length: samples + 1 }, () => new Vector3());
  return {
    group,
    label,
    climberTag,
    setCurve(power, pTop) {
      top = pTop;
      for (let i = 0; i <= samples; i++) {
        const v = (i / samples) * vMax;
        const x = X(v);
        const y = Math.min(Y(power(v)), h * 1.08);
        pts[i]!.set(x, y, 0);
        pos.set([x, 0, 0, x, y, 0], i * 6);
      }
      geo.attributes.position!.needsUpdate = true;
      line.setLines([{ points: pts }]);
    },
    setClimber(vV, pW) {
      man.position.set(X(vV), Y(pW), 0.05);
      climberTag.position.set(X(vV) - 0.2, Y(pW) + 0.85, 0.05);
    },
    setCeiling(pW) {
      ceiling.visible = pW !== null;
      if (pW !== null)
        ceiling.setLines([{ points: [new Vector3(-w / 2, Y(pW), 0), new Vector3(w / 2, Y(pW), 0)] }]);
    },
    setPeak(vV, pW, text) {
      flag.text = text;
      // beside the summit, so that the climber standing on it does not cover the number
      flag.position.set(X(vV) + 0.95, Math.min(Y(pW), h * 1.08) - 0.12, 0);
    },
    point: (vV, pW, out = new Vector3()) => out.set(X(vV), Y(pW), 0),
  };
}
