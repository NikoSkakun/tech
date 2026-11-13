/**
 * Step 11 `to-transformer` — the bridge. The generator of step 7 hums in the background; its busbars run to a
 * new object that assembles itself: a laminated steel core frame with a small thick-wire coil (primary,
 * coral-tinted copper) and a large thin-wire coil (secondary, sky-tinted; DECISIONS §8). The scope shows two
 * sines of different height, same phase and frequency. «Витки другої котушки» 1…20× adds turns and raises the
 * second sine (a plain multiplication — the next chapter explains it). «До трансформатора →» opens
 * `transformer/mutual-induction`.
 */
import { Group, InstancedMesh, Matrix4, Mesh, TorusGeometry, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createWire } from '@/fx';
import { K, col } from '@/style';
import type { StepFactory } from '../chapter';
import { doc } from '../labels';
import { OWN } from '../labels-own';
import { createHoloScope } from '../parts/holo-scope';
import { createTurboGen } from '../parts/turbo-gen';
import { COPPER, PHASE, group, roomy, tag } from '../world';

const ID = 'to-transformer';
const TARGET = 'electricity/transformer/mutual-induction';
const MAX_TURNS = 64;

export const toTransformer: StepFactory = (hall) => {
  const { ctx, ui } = hall;
  const set = group(ID, 0, 0.16, 0);
  hall.stageRoot.add(set);
  const tg = createTurboGen();
  tg.group.scale.setScalar(0.45);
  const machine = group('machine', -3.3, 0, -2.1, [tg.group]);
  machine.rotation.y = 0.45;
  set.add(machine);
  machine.updateMatrixWorld(true);

  // the transformer: core frame (two legs, two yokes) + two coils, assembled piece by piece
  const tr = group('transformer', 0.9, 0, 0.3);
  const steel = K.metal({ color: 'steel', specular: 0.5 });
  const piece = (w: number, h: number, x: number, y: number): Mesh => {
    const m = new Mesh(new RoundedBoxGeometry(w, h, 0.5, 2, 0.05), steel);
    m.position.set(x, y, 0);
    m.castShadow = true;
    tr.add(m);
    return m;
  };
  const legL = piece(0.42, 2.0, -0.95, 1.3);
  const legR = piece(0.42, 2.0, 0.95, 1.3);
  const yokeB = piece(2.32, 0.42, 0, 0.3);
  const yokeT = piece(2.32, 0.42, 0, 2.3);
  for (let i = 0; i < 7; i++) {
    const groove = new Mesh(new RoundedBoxGeometry(2.34, 0.012, 0.012, 1, 0.004), K.toon({ color: 'slate' }));
    groove.position.set(0, (i - 3) * 0.05, 0.255);
    yokeB.add(groove.clone());
    yokeT.add(groove);
  }
  const primaryCu = col(COPPER).lerp(col('coral'), 0.35);
  const secondaryCu = col(COPPER).lerp(col('sky'), 0.45);
  const coilP = new Group();
  coilP.position.set(-0.95, 1.3, 0);
  for (let i = 0; i < 7; i++) {
    const ring = new Mesh(new TorusGeometry(0.4, 0.075, 10, 32), K.metal({ color: primaryCu, specular: 0.8 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.55 + i * 0.18;
    coilP.add(ring);
  }
  tr.add(coilP);
  const coilS = new Group();
  coilS.position.set(0.95, 1.3, 0);
  const turns = new InstancedMesh(new TorusGeometry(0.5, 0.022, 6, 32), K.metal({ color: secondaryCu, specular: 0.8 }), MAX_TURNS);
  const m4 = new Matrix4();
  /** Spread `n` visible turns over the coil height (more turns = a denser winding). */
  const wind = (n: number): void => {
    if (turns.count === n) return;
    turns.count = n;
    for (let i = 0; i < n; i++) {
      m4.makeRotationX(Math.PI / 2).setPosition(0, -0.75 + (i / Math.max(1, n - 1)) * 1.5, 0);
      turns.setMatrixAt(i, m4);
    }
    turns.instanceMatrix.needsUpdate = true;
  };
  turns.count = 0;
  wind(12);
  coilS.add(turns);
  tr.add(coilS);
  set.add(tr);
  const assembly: (Mesh | Group)[] = [legL, legR, yokeB, yokeT, coilP, coilS];
  const homes = assembly.map((p) => p.position.y);

  // busbars from the generator's terminals to the primary coil
  PHASE.forEach((c, k) => {
    const from = tg.anchorLocal(`term${k}`).clone().applyMatrix4(tg.group.matrix).applyMatrix4(machine.matrix);
    const to = new Vector3(0.9 - 1.4, 1.0 + k * 0.25, 0.3 + 0.35);
    set.add(createWire([from, from.clone().setY(1.5 + k * 0.12), new Vector3(-1.2, 1.5 + k * 0.12, -0.2 + k * 0.1), to], { radius: 0.045, color: c, repeat: 1.4, speed: 1.4, power: 0.7 }));
  });
  const scope = createHoloScope({ width: 3.6, height: 1.9, channels: ['coral', 'sky'], samples: 160 });
  scope.group.position.set(2.0, 3.65, -2.0);
  scope.group.rotation.y = -0.25;
  scope.rangeTag.text = '24 kV → 750 kV';
  set.add(scope.group);
  const pTag = tag('', 18, 'coral', 'mono');
  pTag.position.set(-0.95, 2.9, 0.3);
  const sTag = tag('', 18, 'sky', 'mono');
  sTag.position.set(0.95, 2.9, 0.3);
  tr.add(pTag, sTag);

  const st = { tv: 0 };
  const ratio = (): number => ui.value<number>('k11');
  const bufP = new Float32Array(160);
  const bufS = new Float32Array(160);
  const mid = new Vector3();
  const open = (): void => {
    if (ctx.nav.locate(TARGET)) void ctx.nav.open(TARGET);
    else ui.toast(OWN.transformerSoon, { icon: 'info' });
  };

  return {
    id: ID,
    shots: {
      [ID]: { position: [2.4, 3.7, 8.0], target: [0.2, 1.75, -0.4], fov: 34, fit: { center: [0, 1.8, -0.4], radius: 4.2 } },
    },
    stage: {
      show: [set],
      enter: (info) => {
        assembly.forEach((p, i) => {
          p.position.y = homes[i]!;
          if (info.instant) return;
          // the new object assembles itself: legs, yokes, then the two coils drop on
          p.position.y = homes[i]! + 3;
          info.scope.to(p.position, { y: homes[i]! }, { duration: 0.6, delay: 0.5 + i * 0.22, ease: 'back.out' });
        });
      },
    },
    ui: {
      honesty: [{ slowed: 50 }, 'notToScale'],
      controls: [
        { type: 'slider', id: 'k11', label: doc(ID, 1), min: 1, max: 20, step: 1, value: 6, unit: '×' },
        { type: 'button', id: 'go11', label: doc(ID, 0), icon: 'next', primary: true, onClick: open },
      ],
      callouts: [
        { anchor: () => machine.localToWorld(mid.set(0, 1.6, 0)), text: OWN.ourGenerator, side: 'up', visible: () => roomy(hall) },
        { anchor: () => coilP.localToWorld(mid.set(-0.45, 0.3, 0)), text: OWN.primaryCoil, side: 'left', color: 'coral' },
        { anchor: () => coilS.localToWorld(mid.set(0.55, 0.3, 0)), text: OWN.secondaryCoil, side: 'right', color: 'sky' },
      ],
      hotspots: [{ anchor: () => yokeT.localToWorld(mid.set(0, 0.22, 0.26)), content: 0 }],
    },
    probe: () => ({ k: ratio(), turns: turns.count, secondaryAmp: Math.max(...Array.from(bufS)), primaryAmp: Math.max(...Array.from(bufP)) }),
    update(dt) {
      if (!hall.isCurrent(ID)) return;
      st.tv += dt;
      const k = ratio();
      wind(Math.min(MAX_TURNS, 6 + Math.round(k * 2.9)));
      // same phase and frequency; the taller curve is always the secondary (auto-scaled)
      const aS = 0.9;
      const aP = 0.9 / k;
      const wt = 2 * Math.PI * st.tv;
      for (let i = 0; i < bufP.length; i++) {
        const th = wt - (i / (bufP.length - 1)) * 4 * Math.PI;
        bufP[i] = Math.sin(th) * aP;
        bufS[i] = Math.sin(th) * aS;
      }
      scope.setTrace(0, bufP);
      scope.setTrace(1, bufS);
      pTag.text = `N₁`;
      sTag.text = `N₂ = ${k}·N₁`;
      tg.part('rotor').rotation.x += dt * 2.5;
      hall.sound.hum = 0.18;
      hall.sound.turbine = 0.15;
      hall.sound.turbinePitch = 0.8;
    },
  };
};
