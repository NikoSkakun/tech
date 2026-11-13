/**
 * Step 4 specimen: a thick slice of the blade (NACA 4418-like section) with the velocity triangle and the
 * forces on it. Diagram frame (the group): X = wind direction, Y = direction the blade moves, the rotor
 * plane is the Y axis; everything lies in the XY plane and faces +Z. Angles and coefficients come from the
 * simulation (M3: `bladeSection`, `airfoil`); this file only draws them.
 *
 *   relative wind  w = (v_a, −ω·r)          inflow angle φ from the rotor plane
 *   chord (LE→TE)  c = (sin θ, −cos θ)      θ = φ − α  (pitch / twist angle)
 *   lift ⊥ w toward the suction side, drag ∥ w.
 */
import { Group, Mesh, TorusGeometry, Vector3 } from 'three';
import { createVectorArrow, type VectorArrow } from '@/fx';
import { G } from '@/kit';
import { K, SEMANTIC, col, type ColorLike } from '@/style';
import { CHORD, sectionOutline } from './section';
import { buildStreamlines, type Streamlines } from './streamlines';

export interface AirfoilState {
  /** Angle of attack α and inflow angle φ, degrees. */
  alphaDeg: number;
  phiDeg: number;
  cl: number;
  cd: number;
  /** Speeds as multiples of the wind speed v: axial v_a and tangential ω·r. */
  axialRel: number;
  tangentialRel: number;
}

export interface Airfoil {
  group: Group;
  /** Rotating frame of the section (chord along its +X). */
  foil: Group;
  arrows: Record<'v' | 'omega' | 'rel' | 'lift' | 'drag' | 'drive', VectorArrow>;
  streamlines: Streamlines;
  set(s: AirfoilState): void;
}

/** Arrow lengths: toy metres per unit of v, and per unit of force coefficient. */
const V_SCALE = 1.7;
const F_SCALE = 5.2;

export function buildAirfoil(): Airfoil {
  const group = new Group();
  group.name = 'airfoil-diagram';
  const foil = new Group();
  group.add(foil);
  const outline = sectionOutline().map(([x, y]): [number, number] => [x * CHORD, y * CHORD]);
  const span = 4.2;
  // the slice of blade: white shell, the cut face in the chapter's teal, a glowing rim around the cut
  const body = new Mesh(G.extrude(outline, span, { bevel: 0.06, bevelSeg: 2 }).translate(0, 0, -span), K.toon({ color: 'white', gloss: 0.7, highlight: 0.6 }));
  const face = new Mesh(G.extrude(outline.map(([x, y]): [number, number] => [x * 0.985, y * 0.94]), 0.08).translate(0, 0, 0.0), K.toon({ gradient: { bottom: 'teal.dark', top: 'teal', range: [-1, 1.4] }, highlight: 0.2, rim: 0.2 }));
  const rim = new Mesh(G.tube([...outline, outline[0]!].map(([x, y]) => new Vector3(x, y, 0.1)), 0.07, { seg: 6, closed: true }), K.glow({ color: 'white', intensity: 1.5 }));
  // erosion shield on the leading edge (hotspot «Leading edge protection»)
  const guard = new Mesh(G.extrude(outline.filter(([x]) => x < -0.19 * CHORD).map(([x, y]): [number, number] => [x * 1.012 - 0.02, y * 1.03]), span * 0.999).translate(0, 0, -span), K.toon({ color: col('slate').lerp(col('teal.dark'), 0.4), gloss: 0.4 }));
  body.castShadow = guard.castShadow = true;
  // chord line and the pitch pivot
  const chord = new Mesh(G.rod(new Vector3(-0.3 * CHORD, 0, 0.16), new Vector3(0.7 * CHORD, 0, 0.16), 0.035, 5), K.glow({ color: 'white', intensity: 0.9, whiten: 0 }));
  const pivot = new Mesh(new TorusGeometry(0.34, 0.07, 8, 28), K.glow({ color: 'cyan', intensity: 1.3, whiten: 0, keepHue: true }));
  pivot.position.z = 0.18;
  foil.add(body, face, rim, guard, chord, pivot);
  const streamlines = buildStreamlines();
  foil.add(streamlines.mesh);

  const arrow = (color: ColorLike, radius = 0.13): VectorArrow =>
    createVectorArrow({ color, radius, headLength: radius * 6.5, headRadius: radius * 2.7, intensity: 1.3 });
  const arrows = {
    v: arrow('sky'),
    omega: arrow('mist'),
    rel: arrow('white', 0.16),
    lift: arrow(SEMANTIC.ok, 0.19),
    drag: arrow(SEMANTIC.alarm, 0.19),
    drive: arrow(SEMANTIC.current, 0.19),
  };
  group.add(...Object.values(arrows));
  const o = new Vector3();
  const d = new Vector3();
  const rad = Math.PI / 180;
  return {
    group,
    foil,
    arrows,
    streamlines,
    set(s) {
      const phi = s.phiDeg * rad;
      const theta = (s.phiDeg - s.alphaDeg) * rad;
      foil.rotation.z = theta - Math.PI / 2;
      // velocity triangle, tail to head, drawn upwind of the leading edge: v_a then −ω·r, and their sum
      const va = s.axialRel * V_SCALE;
      const wr = s.tangentialRel * V_SCALE;
      const start = o.set(-CHORD * 0.62 - va, CHORD * 0.46 + wr, 0.3);
      arrows.v.set(start, d.set(va, 0, 0));
      arrows.omega.set(start.clone().add(d), new Vector3(0, -wr, 0));
      arrows.rel.set(start, new Vector3(va, -wr, 0));
      // forces at the aerodynamic centre (quarter chord): lift ⊥ w, drag ∥ w, and what is left to turn the rotor
      const w = new Vector3(Math.sin(phi), -Math.cos(phi), 0);
      const n = new Vector3(Math.cos(phi), Math.sin(phi), 0);
      const centre = new Vector3(-0.05 * CHORD * Math.sin(theta), 0.05 * CHORD * Math.cos(theta), 0.4);
      arrows.lift.set(centre, n.clone().multiplyScalar(Math.max(0.2, s.cl * F_SCALE)));
      arrows.drag.set(centre, w.clone().multiplyScalar(Math.max(0.35, s.cd * F_SCALE)));
      const drive = s.cl * Math.sin(phi) - s.cd * Math.cos(phi);
      arrows.drive.set(centre.clone().add(new Vector3(-0.9, 0, 0.1)), new Vector3(0, Math.max(-3, drive * F_SCALE * 2.2), 0));
      streamlines.shape(s.alphaDeg, s.cl);
    },
  };
}
