/**
 * The fission «slingshot» of step 2 (model M1): a slow neutron is pulled back on a cyan handle and released at
 * the U-235 drop. On a hit `shoot(energy)` decides: fission (U-236* trembles, stretches into a dumbbell, tears
 * into Ba-141 + Kr-92, three fast neutrons with long trails, yellow gamma packets, two antineutrinos that fly
 * off through everything; the fragments brake in the crystal leaving an orange heat glow) or scattering (the
 * neutron ricochets). Everything is a function of `phase` + time since the phase began — random-access safe.
 */
import { Group, Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three';
import { Rng, type ChapterContext } from '@/engine/api';
import { RibbonLines, createHalo, createNeutron, createParticles, createPhotons, createPulseRings, createTrail, pointEmitter, type Orbs } from '@/fx';
import { shoot, type NeutronEnergy } from '@electricity/sim/plant-nuclear';
import { createNucleus, type Nucleus } from './nucleus';

export type Phase = 'ready' | 'flight' | 'excited' | 'split' | 'scatter' | 'miss';

/** Flight speed of the incoming neutron per energy (m/s of the set: slowed, but the order is kept). */
const SPEED: Record<NeutronEnergy, number> = { thermal: 7, kev: 13, fast: 24 };
const EXCITED_S = 1.9;
const REST = new Vector3(-15, -1, 2);
const PULL = 8;

export interface FissionRig {
  group: Group;
  nucleus: Nucleus;
  /** Invisible grab sphere around the waiting neutron (register it with `ctx.input`). */
  handle: Mesh;
  phase: Phase;
  energy: NeutronEnergy;
  /** 0…1: the count-up of released energy after a fission. */
  released: number;
  /** Results so far (QA, readouts). */
  count: { fission: number; scatter: number; miss: number };
  /** Drag the waiting neutron to a set-local point (clamped); `null` = back to rest. */
  aim(local: Vector3 | null): void;
  /** Release: from the pulled handle (or straight at the nucleus when not pulled). */
  fire(): void;
  reset(): void;
  update(dt: number, t: number): void;
  /** Set-local positions for callouts (live vectors). */
  at: { neutron: Vector3; heavy: Vector3; light: Vector3; nucleus: Vector3 };
}

export function buildFissionRig(ctx: ChapterContext): FissionRig {
  // own seeded stream, restarted on every entry of the step: the same shots give the same outcomes
  let rand = new Rng('plant-nuclear/m1');
  const group = new Group();
  const nucleus = createNucleus(0.5);
  group.add(nucleus.group);
  const R = 0.5 * Math.cbrt(235 / 0.6) + 0.4;
  const neutron = createNeutron({ radius: 0.62 });
  group.add(neutron);
  const trail = createTrail(neutron, { color: 'mist', duration: 0.7, width: 0.35, intensity: 0.8 });
  group.add(trail);
  const out = [0, 1, 2].map(() => createNeutron({ radius: 0.55 }));
  const outTrails = out.map((o) => createTrail(o, { color: 'steel.light', duration: 1.2, width: 0.3, intensity: 1 }));
  group.add(...out, ...outTrails);
  const OUT_DIR = [new Vector3(0.3, 0.95, -0.2), new Vector3(0.35, -0.9, -0.3), new Vector3(-0.45, 0.25, -0.85)].map((v) => v.normalize());
  const photons = createPhotons({ count: 4, color: 'yellow', length: 3.2, amplitude: 0.5, waves: 5 });
  const PH_DIR = [new Vector3(-0.6, 0.7, 0.4), new Vector3(0.7, 0.6, 0.3), new Vector3(-0.5, -0.7, 0.5), new Vector3(0.6, -0.5, 0.6)].map((v) => v.normalize());
  const nu = createNeutron({ radius: 0.3 }); // antineutrinos: two faint pale motes
  const nu2 = createNeutron({ radius: 0.3 });
  for (const n of [nu, nu2]) n.setColor('mist.light', 'mist');
  group.add(photons, nu, nu2);
  const heat = createParticles(ctx, { count: 500, loop: false, emitter: pointEmitter(), sprite: 'soft', color: ['amber', 'orange', 'red'], life: [1.4, 2.4], speed: [0.2, 0.8], size: [1.6, 1.1, 0.4], intensity: 1.2 });
  group.add(heat);
  const glowH = createHalo({ color: 'orange', size: 9, intensity: 1.4 });
  const glowL = createHalo({ color: 'orange', size: 7, intensity: 1.4 });
  group.add(glowH, glowL);
  const rings = createPulseRings({ size: 5.5, color: 'cyan', intensity: 1.1 });
  group.add(rings);
  const aimLine = new RibbonLines({ capacity: 64, color: 'cyan', width: 0.14, dashRepeat: 1.2, dashStrength: 0.8, dashSpeed: 1.5, blend: 'normal' });
  group.add(aimLine);
  const handle = new Mesh(new SphereGeometry(2.6, 12, 8), new MeshBasicMaterial({ visible: false }));
  group.add(handle);

  const st = {
    phase: 'ready' as Phase,
    tau: 0,
    start: REST.clone(),
    dir: new Vector3(1, 0, 0),
    hit: new Vector3(),
    hitDist: 0,
    bounce: new Vector3(),
    pop: 1,
  };
  const at = { neutron: REST.clone(), heavy: new Vector3(-3, 0, 0), light: new Vector3(3, 0, 0), nucleus: new Vector3() };
  const rig: FissionRig = {
    group,
    nucleus,
    handle,
    phase: 'ready',
    energy: 'thermal',
    released: 0,
    count: { fission: 0, scatter: 0, miss: 0 },
    at,
    aim(local) {
      if (st.phase !== 'ready') return;
      const p = local ? local.clone() : REST.clone();
      const d = p.clone().sub(REST);
      if (d.length() > PULL) d.setLength(PULL);
      st.start.copy(REST).add(d);
    },
    fire() {
      if (st.phase !== 'ready') rig.reset();
      const pulled = st.start.distanceTo(REST) > 0.6;
      st.dir.copy(pulled ? REST.clone().sub(st.start) : at.nucleus.clone().sub(st.start)).normalize();
      // closest approach of the flight line to the nucleus centre
      const toC = at.nucleus.clone().sub(st.start);
      const along = toC.dot(st.dir);
      const miss = toC.clone().sub(st.dir.clone().multiplyScalar(along)).length();
      if (along > 0 && miss < R) {
        st.hitDist = along - Math.sqrt(R * R - miss * miss);
        st.hit.copy(st.start).addScaledVector(st.dir, st.hitDist);
      } else st.hitDist = Infinity;
      go('flight');
      trail.reset();
    },
    reset() {
      go('ready');
      if (rig.count.fission + rig.count.scatter + rig.count.miss === 0) rand = new Rng('plant-nuclear/m1');
      st.start.copy(REST);
      st.pop = 0;
      rig.released = 0;
      trail.reset();
    },
    update: () => undefined,
  };
  function go(p: Phase): void {
    st.phase = p;
    st.tau = 0;
    rig.phase = p;
  }
  // continued in `animateFission` (same file, below)
  rig.update = animateFission(rig, st, { R, neutron, trail, out, outTrails, OUT_DIR, photons, PH_DIR, nus: [nu, nu2], heat, glowH, glowL, rings, aimLine, go, rand: () => rand.next(), REST });
  return rig;
}

interface RigState {
  phase: Phase;
  tau: number;
  start: Vector3;
  dir: Vector3;
  hit: Vector3;
  hitDist: number;
  bounce: Vector3;
  pop: number;
}

interface RigParts {
  R: number;
  neutron: Orbs;
  trail: ReturnType<typeof createTrail>;
  out: Orbs[];
  outTrails: ReturnType<typeof createTrail>[];
  OUT_DIR: Vector3[];
  photons: ReturnType<typeof createPhotons>;
  PH_DIR: Vector3[];
  nus: Orbs[];
  heat: ReturnType<typeof createParticles>;
  glowH: ReturnType<typeof createHalo>;
  glowL: ReturnType<typeof createHalo>;
  rings: ReturnType<typeof createHalo>;
  aimLine: RibbonLines;
  go(p: Phase): void;
  rand(): number;
  REST: Vector3;
}

const smooth = (a: number, b: number, x: number): number => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** Per-frame animation of the rig: positions are re-derived from (phase, τ) every frame. */
function animateFission(rig: FissionRig, st: RigState, p: RigParts): (dt: number, t: number) => void {
  const tmp = new Vector3();
  const pose = { wobble: 0.15, stretch: 0, heavy: rig.at.heavy, light: rig.at.light, split: 0 };
  let emitAcc = 0;
  return (dt, t) => {
    st.tau += dt;
    st.pop = Math.min(1, st.pop + dt * 2.5);
    const ph = st.phase;
    const speed = SPEED[rig.energy];
    // ---- incoming neutron
    let nVisible = ph === 'ready' || ph === 'flight' || ph === 'scatter' || ph === 'miss';
    if (ph === 'ready') rig.at.neutron.copy(st.start);
    else if (ph === 'flight') {
      const d = st.tau * speed;
      if (d >= st.hitDist) {
        if (shoot(rig.energy, p.rand) === 'fission') {
          rig.count.fission++;
          p.go('excited');
          nVisible = false;
        } else {
          rig.count.scatter++;
          // ricochet: reflect about the surface normal at the hit point
          const nrm = st.hit.clone().sub(rig.at.nucleus).normalize();
          st.bounce.copy(st.dir).addScaledVector(nrm, -2 * st.dir.dot(nrm)).normalize();
          st.start.copy(st.hit);
          st.dir.copy(st.bounce);
          p.go('scatter');
        }
      } else rig.at.neutron.copy(st.start).addScaledVector(st.dir, d);
      if (d > 34 && st.hitDist === Infinity) {
        rig.count.miss++;
        p.go('miss');
      }
    } else if (ph === 'scatter' || ph === 'miss') {
      rig.at.neutron.copy(st.start).addScaledVector(st.dir, (ph === 'miss' ? 34 : 0) + st.tau * speed);
      if (st.tau > 2.2) rig.reset();
    }
    const fadeN = ph === 'scatter' || ph === 'miss' ? Math.max(0, 1 - st.tau / 2) : 1;
    p.neutron.position.copy(rig.at.neutron);
    p.neutron.scale.setScalar(nVisible ? Math.max(0.001, fadeN) : 0.001);
    p.trail.visible = ph !== 'ready';
    // ---- slingshot affordance: pulse rings + the aim line while waiting
    p.rings.position.copy(rig.at.neutron);
    p.rings.fade = ph === 'ready' ? 1 : 0;
    if (ph === 'ready') {
      const pulled = st.start.distanceTo(p.REST) > 0.6;
      const dir = pulled ? p.REST.clone().sub(st.start).normalize() : rig.at.nucleus.clone().sub(st.start).normalize();
      p.aimLine.setLines([{ points: [st.start.clone(), st.start.clone().addScaledVector(dir, pulled ? 30 : 10)] }]);
      p.aimLine.visible = true;
    } else p.aimLine.visible = false;
    // ---- the nucleus
    if (ph === 'excited') {
      pose.wobble = Math.min(1, 0.2 + st.tau / 0.35);
      pose.stretch = smooth(EXCITED_S - 1.0, EXCITED_S, st.tau);
      pose.split = 0;
      rig.at.heavy.set(-3, 0, 0);
      rig.at.light.set(3, 0, 0);
      if (st.tau >= EXCITED_S) p.go('split');
    } else if (ph === 'split') {
      const k = 1 - Math.exp(-st.tau / 0.75); // fragments brake in the crystal
      rig.at.heavy.set(-3 - 10 * k, 0, 0);
      rig.at.light.set(3 + 15 * k, 0, 0);
      pose.wobble = Math.max(0, 0.6 - st.tau);
      pose.stretch = 1;
      pose.split = Math.min(1, st.tau / 0.45);
      rig.released = smooth(0, 2.4, st.tau);
    } else {
      pose.wobble = ph === 'scatter' ? Math.max(0.15, 0.6 - st.tau) : 0.15;
      pose.stretch = 0;
      pose.split = 0;
    }
    rig.nucleus.group.scale.setScalar(Math.max(0.001, st.pop));
    rig.nucleus.pose(pose, t);
    // ---- products of the fission: free neutrons, gamma packets, antineutrinos, heat
    const after = ph === 'split' ? st.tau : -1;
    p.out.forEach((o, i) => {
      const on = after >= 0 && after < 2.6;
      o.position.copy(rig.at.nucleus).addScaledVector(p.OUT_DIR[i]!, 2 + Math.max(0, after) * 26);
      o.scale.setScalar(on ? Math.max(0.001, Math.min(1, (2.6 - after) / 0.6)) : 0.001);
      p.outTrails[i]!.visible = on;
      if (after >= 0 && after < dt * 1.5) p.outTrails[i]!.reset();
    });
    p.PH_DIR.forEach((d, i) => {
      const on = after >= 0 && after < 1.6;
      tmp.copy(rig.at.nucleus).addScaledVector(d, 3 + Math.max(0, after) * 34);
      p.photons.setPhoton(i, [tmp.x, tmp.y, tmp.z], [d.x, d.y, d.z], t * 6, on ? 1 : 0);
    });
    p.photons.commit();
    p.nus.forEach((n, i) => {
      const on = after >= 0 && after < 1.2;
      n.position.set(i ? -0.3 : 0.4, i ? -1 : 1, 0.25).normalize().multiplyScalar(2 + Math.max(0, after) * 60);
      n.scale.setScalar(on ? 1 : 0.001);
    });
    const hot = after >= 0 ? Math.exp(-after / 1.2) : 0;
    emitAcc += dt * 70 * hot;
    while (emitAcc >= 1) {
      emitAcc -= 1;
      for (const c of [rig.at.heavy, rig.at.light]) p.heat.emit(1, { position: [c.x, c.y, c.z], speed: [0.1, 0.5] });
    }
    const glow = after >= 0 ? 0.35 + 0.65 * hot : 0;
    p.glowH.position.copy(rig.at.heavy);
    p.glowL.position.copy(rig.at.light);
    p.glowH.fade = glow;
    p.glowL.fade = glow;
  };
}
