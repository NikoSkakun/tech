/**
 * Step 3 hero: the «крісло-гойдалка». Graphite on a Cu collector (left, −), layered oxide on an Al collector
 * (right, +), the separator fence between them, Li⁺ ions (`lime`) with their solvation shells, and the outer
 * circuit with electrons (`cyan`).
 *
 * Everything is a pure function of the state { soc, current, plating }: ion i sits in the cathode until the
 * state of charge reaches its turn, then crosses (≈ 5 ions are under way at any moment), so the number of ions
 * in the anode *is* the SOC, and the flow rate follows the current because dSOC/dt = I/Q.
 */
import {
  ConeGeometry,
  type Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { damp, type ChapterContext } from '@/engine/api';
import { createFlow, createGas, createHalo, createOrbs, curveThrough, type Orbs } from '@/fx';
import { K, SEMANTIC } from '@/style';
import type { Mats } from '../world';
import { group, mesh } from '../world';
import { MICRO, createFence, createGraphite, createOxide } from './lattice';

const N = 28; // ions shown (each stands for ~10²¹ real ones)
const UNDER_WAY = 5; // ions crossing at the same time
const SHELL = 4; // solvent molecules around an ion in the electrolyte

export interface RockingChairState {
  /** State of charge 0…1 = share of the ions that live in the graphite. */
  soc: number;
  /** Current in C units, + = charging (drives the electrons in the wire and the lamp). */
  current: number;
  /** Fast charge in the cold: every third arriving ion plates as metal on the graphite edge. */
  plating: boolean;
}

export interface RockingChair {
  group: Group;
  graphite: Group;
  oxide: Group;
  fence: Group;
  cu: Mesh;
  al: Mesh;
  lamp: Group;
  ions: Orbs;
  readonly ionCount: number;
  state: RockingChairState;
  /** Ions currently inside the graphite. */
  inAnode(): number;
  /** A point on an ion that is crossing right now (callout anchor); falls back to the separator. */
  crossing(out: Vector3): Vector3;
  update(dt: number, t: number): void;
}

const smooth = (x: number): number => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
};

export function createRockingChair(ctx: ChapterContext, mats: Mats): RockingChair {
  const g = group('rocking-chair');
  const graphite = createGraphite();
  const oxide = createOxide();
  const fence = createFence();
  const plate = new RoundedBoxGeometry(0.16, 3.5, 2.7, 3, 0.06);
  const cu = mesh(plate, mats.copper, MICRO.anode.back - 0.22, 1.85, 0);
  const al = mesh(plate, mats.alu, MICRO.cathode.back + 0.22, 1.85, 0);
  // brownian solvent molecules fill the electrolyte on both sides of the separator
  const solvent = createGas(ctx, {
    kind: 'blob',
    color: 'mist',
    count: ctx.quality.count(90, 30),
    radius: 0.045,
    box: [3.0, 3.0, 2.2],
    wander: 0.3,
    thermal: 0.7,
    halo: false,
  });
  solvent.position.set(0, 1.85, 0);
  solvent.fade = 0.55;
  g.add(graphite.group, oxide.group, fence.group, cu, al, solvent);

  /* -------------------------------------------------------------------------------- outer circuit */
  const wirePts = [
    new Vector3(cu.position.x, 3.6, 0),
    new Vector3(cu.position.x, 4.45, 0),
    new Vector3(-2.2, 5.0, 0),
    new Vector3(2.2, 5.0, 0),
    new Vector3(al.position.x, 4.45, 0),
    new Vector3(al.position.x, 3.6, 0),
  ];
  const wire = new Mesh(
    new TubeGeometry(curveThrough(wirePts), 120, 0.1, 14, false),
    K.glass({ color: 'orange', opacity: 0.16, edgeOpacity: 0.6 }),
  );
  wire.renderOrder = 3;
  const electrons = createFlow(ctx, {
    kind: 'electron',
    paths: wirePts,
    count: 36,
    radius: 0.07,
    speed: 0,
    endFade: 0.03,
  });
  const lamp = group('load', 0, 5.03, 0);
  const bulb = K.glow({ color: SEMANTIC.photon, intensity: 0.4, whiten: 0.5 });
  const halo = createHalo({ color: 'yellow', size: 1.6, intensity: 0 });
  halo.position.y = 0.3;
  lamp.add(
    mesh(new SphereGeometry(0.24, 28, 20), bulb, 0, 0.3, 0, false),
    halo,
    mesh(new RoundedBoxGeometry(0.5, 0.22, 0.4, 3, 0.07), mats.dark, 0, 0, 0),
  );
  g.add(wire, electrons, lamp);

  /* ---------------------------------------------------------------------------------------- ions */
  const ions = createOrbs({ kind: 'ion', count: N, radius: 0.13 });
  const shells = createOrbs({ kind: 'blob', color: 'mist', count: N * SHELL, radius: 0.055, halo: false });
  const needleGeometry = new ConeGeometry(0.075, 0.5, 10);
  needleGeometry.rotateZ(-Math.PI / 2); // tip toward +X: dendrites grow into the electrolyte
  needleGeometry.translate(0.25, 0, 0);
  const needles = new InstancedMesh(needleGeometry, K.metal({ color: 'mist', specular: 0.9 }), N);
  needles.frustumCulled = false;
  g.add(ions, shells, needles);
  // home sites: the first ions to arrive go deepest into the graphite; the ones nearest the face leave the oxide first
  const zOf = (i: number): number => (((i * 5) % 7) - 3) * 0.3;
  const anodeSite = (i: number): Vector3 =>
    new Vector3(MICRO.anode.face - 0.3 - (6 - Math.floor(i / 4)) * 0.32, 0, zOf(i));
  const cathodeSite = (i: number): Vector3 =>
    new Vector3(MICRO.cathode.face + 0.28 + Math.floor(i / 3) * 0.23, oxide.galleryY(i % 3), zOf(i + 3));
  const route = Array.from({ length: N }, (_, i) => ({
    a: anodeSite(i),
    c: cathodeSite(i),
    pore: fence.pore(i),
  }));

  /* --------------------------------------------------------------------------------------- state */
  const state: RockingChairState = { soc: 0.3, current: 0, plating: false };
  const p = new Vector3();
  const a = new Vector3();
  const b = new Vector3();
  const m4 = new Matrix4();
  const q = new Quaternion();
  const cross = new Vector3();
  let crossing = false;
  let arrived = 0;
  let drive = 0;
  let glow = 0;
  const K1 = 0.22; // share of the trip inside the oxide gallery
  const K2 = 0.5; // … to the pore of the separator
  const K3 = 0.78; // … to the graphite face; the rest is the slide into the gallery
  const place = (i: number, t: number): void => {
    const r = route[i]!;
    let u = smooth((state.soc * (N + UNDER_WAY) - i) / UNDER_WAY); // 0 = at home in the oxide … 1 = in the graphite
    // lithium plating: the ion cannot slip in fast enough and is reduced to metal on the graphite face
    const plated = state.plating && i % 3 === 1 ? smooth((u - 0.74) / 0.08) : 0;
    if (plated > 0) u = Math.min(u, K3 + 0.02);
    const ya = graphite.galleryY(i % 4);
    const cFace = a.set(MICRO.cathode.face - 0.28, r.c.y, r.c.z);
    const aFace = b.set(MICRO.anode.face + 0.28, ya, r.a.z);
    if (u < K1) p.lerpVectors(r.c, cFace, u / K1);
    else if (u < K2) p.lerpVectors(cFace, r.pore, (u - K1) / (K2 - K1));
    else if (u < K3) p.lerpVectors(r.pore, aFace, (u - K2) / (K3 - K2));
    else p.set(aFace.x + (r.a.x - aFace.x) * ((u - K3) / (1 - K3)), ya, r.a.z);
    p.x += Math.sin(t * 2.1 + i * 1.3) * 0.02; // thermal jiggle
    p.y += Math.sin(t * 2.7 + i * 2.1) * 0.02;
    ions.setPosition(i, p.x, p.y, p.z, 1 - plated);
    // the solvation shell is worn only in the electrolyte and shed at the electrode faces
    const wet = smooth((u - 0.16) / 0.1) * (1 - smooth((u - 0.7) / 0.1));
    for (let n = 0; n < SHELL; n++) {
      const w = t * 1.7 + i + (n * Math.PI) / 2;
      shells.setPosition(
        i * SHELL + n,
        p.x + Math.cos(w) * 0.21,
        p.y + Math.sin(w) * (n % 2 ? 0.21 : 0.08),
        p.z + Math.sin(w + n) * 0.19,
        wet,
      );
    }
    needles.setMatrixAt(
      i,
      m4.compose(aFace.setX(MICRO.anode.face + 0.02), q, p.setScalar(Math.max(plated, 1e-4))),
    );
    if (u > 0.985) arrived++;
    if (!crossing && u > 0.3 && u < 0.7) {
      ions.getWorldPosition(cross).add(r.pore);
      crossing = true;
    }
  };

  return {
    group: g,
    graphite: graphite.group,
    oxide: oxide.group,
    fence: fence.group,
    cu,
    al,
    lamp,
    ions,
    ionCount: N,
    state,
    inAnode: () => arrived,
    crossing: (out) => (crossing ? out.copy(cross) : fence.group.getWorldPosition(out).setY(out.y + 1.9)),
    update(dt, t) {
      graphite.setLithiation(state.soc);
      arrived = 0;
      crossing = false;
      for (let i = 0; i < N; i++) place(i, t);
      ions.commit();
      shells.commit();
      needles.instanceMatrix.needsUpdate = true;
      // electrons: one per ion, through the wire — toward the anode while charging (path runs anode → cathode)
      drive = damp(drive, state.current, 6, dt);
      electrons.speed = -1.15 * drive;
      // the load shines on discharge; while charging an outer source drives the current instead
      glow = damp(glow, drive < 0 ? Math.min(-drive / 1.5, 1.4) : 0, 5, dt);
      bulb.intensity = 0.35 + 2.4 * glow;
      halo.intensity = 0.9 * glow;
    },
  };
}
