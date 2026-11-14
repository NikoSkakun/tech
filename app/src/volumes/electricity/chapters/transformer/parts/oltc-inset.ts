/**
 * "This sits inside that transformer" cue of step 5 (world units, the set's space): a small 115/11 kV substation
 * transformer floating at the top right with its OLTC compartment lit through the tank wall (amber x-ray box), and
 * four thin amber lines that open from that box onto an amber outline around the whole set — the zoom of an inset.
 * `setPulse(v)` lets the step breathe the box and the outline together.
 */
import { BoxGeometry, Group, Mesh, Vector3 } from 'three';
import { Builder, powerTransformer } from '@/kit';
import { K } from '@/style';

export interface OltcInset {
  group: Group;
  setPulse(v: number): void;
}

/** Outline of the compartment around the set: x from…to, y from…to, at depth z. */
const FRAME = { x0: -3.55, x1: 3.75, y0: 0.05, y1: 3.75, z: -0.85 } as const;
const MINI = { at: new Vector3(1.75, 4.25, -1.9), scale: 0.23, yaw: -0.55 } as const;

export function createOltcInset(): OltcInset {
  const group = new Group();
  group.name = 'oltc-inset';
  const mini = powerTransformer({ hv: 110, lv: 10, fans: false });
  const holder = new Group();
  holder.position.copy(MINI.at);
  holder.rotation.y = MINI.yaw;
  holder.scale.setScalar(MINI.scale);
  holder.add(mini.group);
  // the OLTC compartment of the kit tank sits under its head (`oltc` anchor), at the right end
  const head = mini.anchorLocal('oltc');
  const cy = head.y * 0.55;
  // the box pokes just through both tank walls, so it reads as lit from inside
  const size = new Vector3(1.15, head.y * 0.8, 3.0);
  const xray = new Mesh(new BoxGeometry(size.x, size.y, size.z), K.glass({ color: 'amber', opacity: 0.55, edgeOpacity: 1 }));
  xray.position.set(head.x, cy, 0);
  xray.renderOrder = 2;
  holder.add(xray);
  group.add(holder);
  // zoom lines: from the corners of the box's front face to the corners of the outline
  holder.updateMatrixWorld(true);
  const corner = (sx: number, sy: number): Vector3 =>
    holder.localToWorld(new Vector3(head.x + (sx * size.x) / 2, cy + (sy * size.y) / 2, size.z / 2));
  const b = new Builder('oltc-zoom');
  const r = 0.012;
  const o = { slot: 'glow', c: 'amber', seg: 6 } as const;
  const { x0, x1, y0, y1, z } = FRAME;
  const corners: [number, number, Vector3][] = [
    [-1, -1, new Vector3(x0, y0, z)],
    [1, -1, new Vector3(x1, y0, z)],
    [-1, 1, new Vector3(x0, y1, z)],
    [1, 1, new Vector3(x1, y1, z)],
  ];
  for (const [sx, sy, p] of corners) {
    const c = corner(sx, sy);
    b.rod([c.x, c.y, c.z], [p.x, p.y, p.z], r, o);
  }
  b.rod([x0, y0, z], [x1, y0, z], r * 1.6, o);
  b.rod([x1, y0, z], [x1, y1, z], r * 1.6, o);
  b.rod([x1, y1, z], [x0, y1, z], r * 1.6, o);
  b.rod([x0, y1, z], [x0, y0, z], r * 1.6, o);
  const zoom = b.build();
  group.add(zoom.group);
  const mats = zoom.mats.list() as { fade?: number; intensity?: number }[];
  // K.glass keeps its opacity in a uniform (no accessor)
  const glass = (xray.material as unknown as { uniforms: { opacity: { value: number } } }).uniforms.opacity;
  return {
    group,
    setPulse(v) {
      for (const m of mats) if (typeof m.intensity === 'number') m.intensity = 0.35 + 0.35 * v;
      glass.value = 0.4 + 0.3 * v;
    },
  };
}
