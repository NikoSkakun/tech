/**
 * The column of air of step 1. The Sun (the shared sun-lamp) rides a true arc around the 1 m² `cyan` frame
 * on the ground — the ray hits the frame at the real elevation angle. The atmosphere is a translucent `sky`
 * layer lying on the ground (scattered light = blue sparkles), deep toward the Sun's side; the ray's path through
 * it is drawn, so a low Sun visibly crosses much more air. A second, smaller 1 m² frame faces the Sun above
 * the air (1361 W/m²). Not to scale: the layer is a few units thick and ends where the stage ends, so below
 * ≈ 15° the drawn path stops growing while the air mass of the simulation keeps climbing.
 */
import { BoxGeometry, Group, Mesh, Object3D, TorusGeometry, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { boxEmitter, createBeam, createParticles } from '@/fx';
import { Builder } from '@/kit';
import { K } from '@/style';
import { createSunLamp, type SunLamp } from './sun-lamp';

/** The air layer: from the ground up, from `x0` (Sun's side) to `x1`. */
const SLAB = { x0: -3.4, x1: 1.2, y0: 0.04, y1: 1.2, d: 2.2 } as const;
const FRAME = 1.5; // the "1 m²" frame, stage units
const ARC_R = 4.0; // radius of the Sun's arc around the ground frame

export interface SkyColumn {
  group: Group;
  lamp: SunLamp;
  /** Callout anchors: the air layer, the ground frame, beside the frame above the air, a point on the ray's path. */
  anchors: { slab: Object3D; ground: Object3D; top: Object3D; path: Object3D };
  /** `elevation` in degrees, `transmitted` = G_n / 1361 (share of the beam that survives the air). */
  set(elevationDeg: number, transmitted: number, t: number): void;
}

/** A square outline of glowing bars, `size` per side, in the XZ plane. */
function frameOutline(name: string, size: number): Group {
  const b = new Builder(name);
  for (const s of [-1, 1]) {
    b.box(size, 0.05, 0.05, { r: 0.02, slot: 'glow', c: 'cyan', at: [0, 0, (s * size) / 2] });
    b.box(0.05, 0.05, size, { r: 0.02, slot: 'glow', c: 'cyan', at: [(s * size) / 2, 0, 0] });
  }
  return b.build().group;
}

export function createSkyColumn(ctx: ChapterContext): SkyColumn {
  const group = new Group();
  group.name = 'sky-column';
  const w = SLAB.x1 - SLAB.x0;
  const slab = new Mesh(new BoxGeometry(w, SLAB.y1 - SLAB.y0, SLAB.d), K.glass({ color: 'sky', opacity: 0.16, edgeOpacity: 0.55 }));
  slab.position.set((SLAB.x0 + SLAB.x1) / 2, (SLAB.y0 + SLAB.y1) / 2, 0);
  const slabTag = new Object3D();
  slabTag.position.set(SLAB.x0 + 0.9, SLAB.y1, SLAB.d / 2);
  const ground = frameOutline('m2-frame', FRAME);
  ground.position.y = 0.02;
  const top = frameOutline('m2-frame-top', FRAME * 0.62);
  // the Sun's track: a faint quarter arc from the horizon to the zenith
  const arc = new Mesh(new TorusGeometry(ARC_R, 0.018, 6, 96, (85 / 180) * Math.PI), K.glow({ color: 'yellow', intensity: 0.45 }));
  arc.rotation.z = Math.PI / 2;
  arc.position.y = 0.02;
  const scatter = createParticles(ctx, {
    count: 80,
    emitter: boxEmitter([w * 0.85, SLAB.y1 - SLAB.y0, SLAB.d * 0.7]),
    sprite: 'soft',
    color: ['sky', 'white'],
    life: [0.8, 1.6],
    speed: [0.2, 0.7],
    size: [0.03, 0.11, 0.02],
    intensity: 1.4,
  });
  scatter.position.copy(slab.position);
  const path = createBeam({ from: [0, SLAB.y1, 0], to: [0, SLAB.y0, 0], color: 'white', width: 0.07, intensity: 1.3, ripple: 0 });
  const pathMid = new Object3D();
  const topTag = new Object3D();
  const lamp = createSunLamp(ctx, { radius: 0.5, count: 46, packet: 0.8, speed: 3.2 });
  group.add(slab, slabTag, ground, top, arc, scatter, path, pathMid, topTag, lamp.group);

  const sun = new Vector3();
  const aim = new Vector3(0, 0.02, 0);
  const dir = new Vector3();
  const up = new Vector3(0, 1, 0);
  const a = new Vector3();
  return {
    group,
    lamp,
    anchors: { slab: slabTag, ground, top: topTag, path: pathMid },
    set(elevationDeg, transmitted, t) {
      const h = (elevationDeg * Math.PI) / 180;
      sun.set(-Math.cos(h) * ARC_R, 0.02 + Math.sin(h) * ARC_R, 0);
      dir.subVectors(aim, sun).normalize();
      lamp.place(sun, aim, FRAME * 0.5, up);
      lamp.setLevel(1, transmitted);
      top.position.copy(sun).addScaledVector(dir, 1.0);
      top.quaternion.setFromUnitVectors(up, a.copy(dir).negate());
      // its label sits off the ray on the side away from the Sun (perpendicular, up and to the right)
      topTag.position.copy(top.position).add(a.set(-dir.y, dir.x, 0).multiplyScalar(0.8));
      // where the ray enters the air: through the top of the layer, or through its far side for a low Sun
      const sTop = (SLAB.y1 - sun.y) / dir.y;
      const sSide = (SLAB.x0 - sun.x) / dir.x;
      path.from.copy(sun).addScaledVector(dir, Math.max(sTop, sSide, 0));
      path.to.copy(aim);
      pathMid.position.copy(path.from).lerp(aim, 0.65).setZ(SLAB.d / 2);
      scatter.rate = Math.min(1, (1 - transmitted) * 1.6);
      ground.position.y = 0.02 + Math.sin(t * 2) * 0.004;
    },
  };
}
