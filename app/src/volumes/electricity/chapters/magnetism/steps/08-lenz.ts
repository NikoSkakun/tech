/**
 * Step 8 `lenz` — Lenz's law and eddy currents. Three tubes on a stand (PVC, aluminium, copper with a cut
 * window); a tablet magnet over each. Release them (all, or click a magnet): model М6 (m·dv/dt = m·g − k·v,
 * k from the conductivity) gives 0,45 s / 4,2 s / 6,7 s for 1 m; the tubes are drawn 39 cm tall (chip).
 * In the windows of the aluminium and copper tubes two `cyan` eddy rings ride with the magnet — opposite senses above and below, each
 * with its induced pair of poles — and the wall glows `orange` ∝ heat P = k·v². «Розріз» slits the copper
 * tube (k × 0,25). Left: the Lenz ring on a thread — drag the magnet at it: a solid ring is pushed away while
 * the magnet approaches and pulled after it when it leaves; a cut ring does not react.
 */
import { Group, Mesh, TorusGeometry, Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtUnit } from '@/content';
import { createFlow, createHalo } from '@/fx';
import { Builder } from '@/kit';
import { SEMANTIC } from '@/style';
import { EDDY, lenzRingDeflectionDeg, tubeFall, tubeTransitTime, type TubeId } from '@electricity/sim/magnetism';
import type { StepFactory } from '../chapter';
import { DOC } from '../labels';
import { OWN } from '../labels-own';
import { TUBE_DX, TUBE_H, TUBE_R, TUBE_Y0, createTubes } from '../parts/tubes';
import { glow, group } from '../world';

const ID = 'lenz';
const RACK_X = -0.35;
const MAG_R = 0.17;
const RING = new Vector3(-2.3, 2.3, 0.2);

function tablet(): Group {
  const g = new Group();
  const b = new Builder('tablet');
  b.cyl(MAG_R, 0.08, { at: [0, -0.08, 0], seg: 24, slot: 'gloss', c: SEMANTIC.poleN, bevel: 0.015 });
  b.cyl(MAG_R, 0.08, { seg: 24, slot: 'gloss', c: SEMANTIC.poleS, bevel: 0.015 });
  g.add(b.build().group);
  return g;
}

export const lenzStep: StepFactory = (bench) => {
  const { ctx, ui } = bench;
  const set = group(`set:${ID}`);
  bench.top.add(set);
  const rack = createTubes();
  rack.group.position.x = RACK_X;
  const tubes: TubeId[] = ['pvc', 'aluminium', 'copper'];
  const magnets = tubes.map(() => tablet());
  const halos = tubes.map(() => createHalo({ color: 'yellow', size: 0.5, intensity: 0.6 }));
  // eddy rings in both metal tubes (seen through their windows): two rings of electrons, induced pole tags,
  // heat band. Index 0 = aluminium, 1 = copper.
  const cuX = RACK_X + 2 * TUBE_DX;
  const ringPath = (r: number, n = 48): Vector3[] => Array.from({ length: n }, (_, k) => new Vector3(Math.cos((k / n) * Math.PI * 2) * r, 0, -Math.sin((k / n) * Math.PI * 2) * r));
  const makeEddy = () => {
    const rings = [0, 1].map(() => createFlow(ctx, { kind: 'electron', paths: [{ path: ringPath(TUBE_R - 0.015), closed: true }], count: ctx.quality.count(18, 8), radius: 0.03, speed: 0 }));
    const tags = [SEMANTIC.poleS, SEMANTIC.poleN, SEMANTIC.poleN, SEMANTIC.poleS].map((c) => new Mesh(new TorusGeometry(TUBE_R - 0.04, 0.012, 6, 32), glow(c, 1.1)));
    const heatMat = glow('orange', 0);
    const heat = new Mesh(new TorusGeometry(TUBE_R + 0.005, 0.03, 8, 40), heatMat);
    const g = new Group();
    g.add(...rings, ...tags, heat);
    rings[0]!.position.y = 0.38;
    rings[1]!.position.y = -0.38;
    tags.forEach((p, k) => {
      p.rotation.x = Math.PI / 2;
      p.position.y = [0.46, 0.3, -0.3, -0.46][k]!;
    });
    heat.rotation.x = Math.PI / 2;
    return { group: g, rings, tags, heatMat };
  };
  const eddies = [makeEddy(), makeEddy()];
  const eddyGroup = eddies[1]!.group;
  // "Прикласти до труби": a fourth magnet held against the outside of the copper tube
  const loose = tablet();
  loose.rotation.z = Math.PI / 2;
  // the Lenz ring on a thread (hangs from a little gallows), and a magnet the user drags at it
  const gb = new Builder('gallows');
  gb.box(0.6, 0.08, 0.6, { at: [RING.x, 0, RING.z - 0.2], r: 0.03, c: ['ink', 'slate'] });
  gb.cyl(0.04, RING.y + 1.1, { at: [RING.x, 0.08, RING.z - 0.45], seg: 10, slot: 'metal', c: 'steel' });
  gb.rod([RING.x, RING.y + 1.15, RING.z - 0.45], [RING.x, RING.y + 1.15, RING.z], 0.03, { slot: 'metal', c: 'steel' });
  const gallows = gb.build();
  const pendulum = new Group();
  pendulum.position.set(RING.x, RING.y + 1.15, RING.z);
  const thread = new Builder('thread');
  thread.rod([0, 0, 0], [0, -0.85, 0], 0.008, { c: 'mist' });
  const ringMesh = new Builder('lenz-ring');
  ringMesh.ring(0.3, 0.05, { at: [0, -1.15, 0], seg: 40, tubeSeg: 10, axis: 'x', slot: 'metal', c: 'mist' });
  const solidRing = ringMesh.build().group;
  const cutB = new Builder('lenz-ring-cut');
  cutB.add(new TorusGeometry(0.3, 0.05, 10, 40, Math.PI * 1.85), { slot: 'metal', c: 'mist', at: [0, -1.15, 0], rot: [0, Math.PI / 2, Math.PI * 0.6] });
  const cutRing = cutB.build().group;
  // the face toward the magnet lights as the induced pole: N (repel) while it approaches, S (attract) after
  const faces = [SEMANTIC.poleN, SEMANTIC.poleS].map((c) => {
    const m = new Mesh(new TorusGeometry(0.26, 0.022, 6, 32), glow(c, 0));
    m.rotation.y = Math.PI / 2;
    m.position.set(0.07, -1.15, 0);
    return m;
  });
  pendulum.add(thread.build().group, solidRing, cutRing, ...faces);
  const handMagnet = new Group();
  const hb = new Builder('bar-small');
  hb.box(0.45, 0.16, 0.16, { at: [0.225, 0, 0], r: 0.03, mid: true, slot: 'gloss', c: SEMANTIC.poleS });
  hb.box(0.45, 0.16, 0.16, { at: [-0.225, 0, 0], r: 0.03, mid: true, slot: 'gloss', c: SEMANTIC.poleN });
  handMagnet.add(hb.build().group);
  set.add(rack.group, ...magnets, ...halos, ...eddies.map((e) => e.group), loose, gallows.group, pendulum, handMagnet);

  /* ------------------------------------------------------------------------------------- state */
  const scale = TUBE_H / EDDY.tubeLengthM;
  const st = {
    t0: [NaN, NaN, NaN] as number[],
    done: [NaN, NaN, NaN] as number[],
    loose: NaN,
    hx: RING.x + 1.4,
    prevHx: RING.x + 1.4,
    vx: 0,
    swing: 0,
    dragging: false,
    clock: 0,
    shown: [0, 0, 0] as number[],
  };
  const slotted = (): boolean => ui.value<boolean>('slot8');
  const cutRingOn = (): boolean => ui.value<string>('ring8') === 'cut';
  const tubeOf = (k: number): TubeId => (k === 2 && slotted() ? 'copperSlotted' : tubes[k]!);
  const release = (k: number): void => {
    st.t0[k] = st.clock;
    st.done[k] = NaN;
    audio.play('click', { pitch: 0.9 + k * 0.1 });
  };
  const releaseAll = (): void => [0, 1, 2].forEach(release);
  const fall = (k: number) => (Number.isNaN(st.t0[k]!) ? { distanceM: 0, speedMPerS: 0, heatW: 0 } : tubeFall(tubeOf(k), st.clock - st.t0[k]!));
  magnets.forEach((m, k) =>
    ctx.input.register(m, { tooltip: `${OWN.release}: ${OWN.tubes[k]}`, cursor: 'pointer', enabled: () => bench.isCurrent(ID), click: () => release(k) }),
  );
  ui.onChange('slot8', (on) => {
    rack.slit.visible = Boolean(on);
    st.t0[2] = NaN;
    st.done[2] = NaN;
  });
  const plane = new Vector3(0, 0, 1);
  const through = new Vector3();
  ctx.input.register(handMagnet, {
    tooltip: DOC.ring,
    cursor: 'ew-resize',
    enabled: () => bench.isCurrent(ID),
    dragStart: () => (st.dragging = true),
    drag: (e) => {
      const p = e.planePoint(plane, handMagnet.getWorldPosition(through));
      if (!p) return;
      set.worldToLocal(p);
      st.hx = Math.min(Math.max(p.x, RING.x + 0.55), RING.x + 1.9);
    },
    dragEnd: () => (st.dragging = false),
  });
  ctx.qa.probe('cuMagnet8', magnets[2]!);
  ctx.qa.probe('ringMagnet8', handMagnet);
  ctx.qa.expose(ID, () => ({
    distances: [0, 1, 2].map((k) => fall(k).distanceM),
    times: st.done,
    transit: [0, 1, 2].map((k) => tubeTransitTime(tubeOf(k)).exactS),
    swingDeg: (st.swing * 180) / Math.PI,
    slotted: slotted(),
    loose: Number.isNaN(st.loose) ? null : st.clock - st.loose,
    eddyVisible: eddies.map((e) => e.group.visible),
  }));
  const v = new Vector3();

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.2, 4.1, 8.5],
        target: [-0.3, 2.6, 0],
        fov: 34,
        frameAspect: 1.2,
        orbit: { azimuth: 0.6, polar: 0.3 },
        fit: { center: [-0.3, 2.7, 0], radius: 3.0 },
      },
    },
    stage: {
      show: [set],
      enter: () => {
        st.t0 = [NaN, NaN, NaN];
        st.done = [NaN, NaN, NaN];
        st.loose = NaN;
        st.hx = RING.x + 1.4;
        st.prevHx = st.hx;
        st.swing = 0;
        rack.slit.visible = slotted();
      },
    },
    ui: {
      reset: true,
      honesty: ['notToScale', 'simplified'],
      controls: [
        { type: 'toggle', id: 'slot8', label: DOC.slot, value: false },
        {
          type: 'segmented',
          id: 'ring8',
          label: DOC.ring,
          items: [
            { id: 'solid', label: DOC.ringKinds[0]! },
            { id: 'cut', label: DOC.ringKinds[1]! },
          ],
          value: 'solid',
        },
        {
          type: 'readout',
          id: 'cu8',
          label: `${OWN.timer}: ${OWN.tubes[2]}`,
          text: () => fmtUnit(tubeTransitTime(tubeOf(2)).exactS, 's', { digits: 2 }),
        },
        {
          type: 'button',
          id: 'stick8',
          label: OWN.stick,
          icon: 'hand',
          onClick: () => {
            st.loose = st.clock;
            audio.play('click', { pitch: 1.3 });
          },
        },
        { type: 'button', id: 'all8', label: DOC.releaseAll, icon: 'play', primary: true, onClick: releaseAll },
      ],
      callouts: [
        // tube name + its stopwatch (s, two decimals) at the foot of each tube once it has been released, fanned
        // out left / down / right so three labels fit at 720p (timers over the tubes fell under the HUD title)
        ...tubes.map((_, k) => ({
          anchor: () => rack.group.localToWorld(v.set(k * TUBE_DX + [-TUBE_R, 0, TUBE_R][k]!, 0.3, TUBE_R + 0.1)),
          text: () => (Number.isNaN(st.t0[k]!) ? OWN.tubes[k]! : `${OWN.tubes[k]!} · ${fmtUnit(st.shown[k]!, 's', { digits: 2 })}`),
          side: (['left', 'down', 'right'] as const)[k]!,
        })),
        { anchor: () => handMagnet.getWorldPosition(v).setY(v.y - 0.15), text: OWN.dragMagnetRing, color: 'cyan', side: 'down', visible: () => !st.dragging },
      ],
      hotspots: [
        { anchor: () => eddyGroup.getWorldPosition(v).setZ(v.z + TUBE_R).setY(v.y + 0.38), content: 'eddy-rings', visible: () => eddyGroup.visible },
        { anchor: () => rack.group.localToWorld(v.set(2 * TUBE_DX + TUBE_R, TUBE_Y0 + 1.0, 0.1)), content: 'wall-heat' },
        { anchor: () => rack.group.localToWorld(v.set(0 - TUBE_R, TUBE_Y0 + 2.2, 0.1)), content: 'plastic-tube' },
        { anchor: () => rack.group.localToWorld(v.set(2 * TUBE_DX + 0.45, TUBE_Y0 + TUBE_H + 0.6, 0)), content: 'how-we-count' },
      ],
    },
    update(dt, t) {
      st.clock += Math.min(dt, 0.05);
      for (let k = 0; k < 3; k++) {
        const f = fall(k);
        const d = Math.min(f.distanceM, EDDY.tubeLengthM + 0.06);
        const x = RACK_X + k * TUBE_DX;
        const top = TUBE_Y0 + TUBE_H + 0.12;
        magnets[k]!.position.set(x, top - d * scale, 0);
        halos[k]!.position.copy(magnets[k]!.position);
        const elapsed = Number.isNaN(st.t0[k]!) ? 0 : st.clock - st.t0[k]!;
        if (f.distanceM >= EDDY.tubeLengthM && Number.isNaN(st.done[k]!)) {
          st.done[k] = tubeTransitTime(tubeOf(k)).exactS;
          audio.play('tick', { gain: 0.6, pitch: 0.7 + k * 0.2 });
        }
        st.shown[k] = Number.isNaN(st.done[k]!) ? elapsed : st.done[k]!;
      }
      // eddy rings ride with the magnet in each metal tube; brightness and heat follow its speed (P = k·v²)
      eddies.forEach((e, i) => {
        const k = i + 1;
        const f = fall(k);
        e.group.visible = f.distanceM > 0.02 && f.distanceM < EDDY.tubeLengthM;
        e.group.position.set(RACK_X + k * TUBE_DX, magnets[k]!.position.y, 0);
        const vRel = Math.min(f.speedMPerS / 0.6, 1);
        const sl = k === 2 && slotted() ? 0.3 : 1;
        e.rings[0]!.speed = 0.5 * vRel * sl;
        e.rings[1]!.speed = -0.5 * vRel * sl;
        for (const p of e.tags) (p.material as ReturnType<typeof glow>).intensity = 1.2 * vRel * sl;
        e.heatMat.intensity = 1.6 * Math.min(f.heatW / 0.03, 1) * sl;
      });
      // the loose magnet beside the copper tube: copper does not hold it — it just falls
      const lt = Number.isNaN(st.loose) ? -1 : st.clock - st.loose;
      const ly = lt < 0 ? 3.2 : Math.max(3.2 - 0.5 * 9.81 * lt * lt * scale, 0.2);
      loose.visible = lt >= 0 && lt < 2.5;
      loose.position.set(cuX + TUBE_R + 0.09, ly, 0.12);
      // Lenz ring: speed of the hand magnet toward the ring → deflection (approach repels, leaving attracts)
      // (velocity from frame to frame of real time only: a dt = 0 tick must not swallow the motion)
      handMagnet.position.set(st.hx, RING.y, RING.z);
      if (dt > 0) {
        const vx = (st.hx - st.prevHx) / dt / 10;
        st.prevHx = st.hx;
        st.vx += (vx - st.vx) * Math.min(dt * 10, 1);
      }
      const approach = -st.vx;
      const target = (lenzRingDeflectionDeg(Math.abs(approach), cutRingOn()) * Math.PI) / 180 * Math.sign(approach);
      st.swing += (-target - st.swing) * Math.min(dt * 5, 1);
      pendulum.rotation.z = st.swing;
      solidRing.visible = !cutRingOn();
      cutRing.visible = cutRingOn();
      const pole = cutRingOn() ? 0 : Math.min(Math.abs(approach) / 0.4, 1);
      (faces[0]!.material as ReturnType<typeof glow>).intensity = approach > 0.01 ? 1.4 * pole : 0;
      (faces[1]!.material as ReturnType<typeof glow>).intensity = approach < -0.01 ? 1.4 * pole : 0;
      bench.live.buzz = 0;
      void t;
    },
  };
};
