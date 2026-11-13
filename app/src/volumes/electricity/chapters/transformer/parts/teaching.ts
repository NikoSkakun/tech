/**
 * The teaching transformer shared by steps 1–2: Faraday's iron ring (morph 0) that straightens into a laminated
 * rectangular core (morph 1), a `coral`-copper primary coil on the left limb and a `sky`-copper secondary on the
 * right, plus the living layer: `magenta` flux orbs swinging around the core, `cyan` electrons swinging in each
 * winding, `yellow` energy pulses crossing *through the core* from the primary to the secondary — never along a
 * wire, never into the iron (the misconception of step 1). Model space: core centred at (0, CY, 0) in the XY
 * plane, facing +Z.
 */
import { Group, Mesh, type Vector3 } from 'three';
import { createFlow, type Flow } from '@/fx';
import type { ChapterContext } from '@/engine/api';
import { K, type KToonMaterial } from '@/style';
import { createCoil, type Coil } from './coil';
import { CORE_W, RECT_HX, corePath, corePoint, sweepCore } from './core-path';
import { COPPER_PRIMARY, COPPER_SECONDARY } from '../world';

/** Height of the core centre above the floor. */
export const CY = 1.75;
/** X of the two limbs (coil centres). */
export const LIMB_X = RECT_HX;
const COIL_H = 0.95;
const COIL_INNER = CORE_W * 0.72;
/** Energy pulses run just in front of the core's face so they read over the steel. */
const CORE_D_FRONT = 0.4;
/** Flux orbs ride the front face of the core (inside the steel they would be hidden). */
const FLUX_Z = 0.29;

export interface Teaching {
  group: Group;
  core: Mesh;
  /** Own winding materials (heat glow per step). */
  primaryMat: KToonMaterial;
  secondaryMat: KToonMaterial;
  primary: Coil;
  secondary: Coil;
  flux: Flow;
  ePrimary: Flow;
  eSecondary: Flow;
  energy: Flow;
  /** 0 ring … 1 rectangle (rebuilds the core and the flux paths). */
  setMorph(m: number): void;
  readonly morph: number;
  /** Re-route the electrons after a turn change. */
  refreshCoilPaths(): void;
  /** Model-space point on the core centre line (for anchors), s ∈ [0, 1). */
  point(s: number): Vector3;
  update(dt: number): void;
}

export function createTeaching(ctx: ChapterContext): Teaching {
  const group = new Group();
  group.name = 'teaching-transformer';
  const core = new Mesh(sweepCore(0), K.metal({ color: 'white', vertexColors: true, specular: 0.6 }));
  core.castShadow = true;
  core.receiveShadow = true;
  core.position.y = CY;
  const primaryMat = K.metal({ color: COPPER_PRIMARY, specular: 0.8, shininess: 50 });
  const secondaryMat = K.metal({ color: COPPER_SECONDARY, specular: 0.8, shininess: 50 });
  const primary = createCoil({ inner: COIL_INNER, height: COIL_H, material: primaryMat });
  primary.mesh.position.set(-LIMB_X, CY, 0);
  const secondary = createCoil({ inner: COIL_INNER, height: COIL_H, material: secondaryMat });
  secondary.mesh.position.set(LIMB_X, CY, 0);

  const lift = (pts: Vector3[], x = 0, z = 0): Vector3[] => pts.map((p) => p.set(p.x + x, p.y + CY, p.z + z));
  const flux = createFlow(ctx, {
    kind: 'pulse',
    color: 'magenta',
    paths: lift(corePath(0, 96), 0, FLUX_Z),
    closed: true,
    count: 64,
    radius: 0.045,
    spread: 0.07,
    speed: 0,
    name: 'flux',
  });
  // electrons ride a helix through each winding (open path: the leads continue in the step's wires)
  const electrons = (coil: Coil, x: number, name: string): Flow =>
    createFlow(ctx, { kind: 'electron', paths: lift(coil.path(), x), count: 46, radius: 0.03, speed: 0, wobble: 0.004, name });
  // energy: top and bottom halves of the core, from the primary limb to the secondary limb
  const halves = (m: number): Vector3[][] => {
    const top: Vector3[] = [];
    const bottom: Vector3[] = [];
    for (let i = 0; i <= 40; i++) {
      top.push(corePoint(0.5 - (i / 40) * 0.5, m).setZ(CORE_D_FRONT));
      bottom.push(corePoint(0.5 + (i / 40) * 0.5, m).setZ(CORE_D_FRONT));
    }
    return [lift(top), lift(bottom)];
  };
  const energy = createFlow(ctx, {
    kind: 'pulse',
    color: 'yellow',
    paths: halves(0).map((path) => ({ path, closed: false })),
    count: 10,
    radius: 0.06,
    speed: 0.9,
    name: 'energy',
  });
  energy.density = 0;

  let morph = -1;
  const t: Teaching = {
    group,
    core,
    primaryMat,
    secondaryMat,
    primary,
    secondary,
    flux,
    ePrimary: electrons(primary, -LIMB_X, 'e1'),
    eSecondary: electrons(secondary, LIMB_X, 'e2'),
    energy,
    get morph() {
      return morph;
    },
    setMorph(m) {
      if (Math.abs(m - morph) < 1e-4) return;
      morph = m;
      core.geometry.dispose();
      core.geometry = sweepCore(m);
      flux.setPaths(lift(corePath(m, 96), 0, FLUX_Z));
      energy.setPaths(halves(m).map((path) => ({ path, closed: false })));
    },
    refreshCoilPaths() {
      t.ePrimary.setPaths(lift(primary.path(), -LIMB_X));
      t.eSecondary.setPaths(lift(secondary.path(), LIMB_X));
    },
    point: (s) => {
      const p = corePoint(s, Math.max(0, morph));
      return p.setY(p.y + CY);
    },
    update(dt) {
      primary.update(dt);
      secondary.update(dt);
    },
  };
  group.add(core, primary.mesh, secondary.mesh, flux, t.ePrimary, t.eSecondary, energy);
  t.setMorph(0);
  return t;
}
