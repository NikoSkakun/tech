/**
 * Step 4 `three-phase` — a magnet rotor turns inside a flat stator with three coils at 120° (L1 yellow, L2 green,
 * L3 red). Each phase feeds its lamp; the three returns join into one neutral (blue) with an ammeter. Behind: the
 * dial with three current phasors, the scope with three sines, the Σ plate where the phasors close into a
 * triangle (the blue gap = neutral current) and the p(t) strip (single-phase pulsing vs three-phase flat).
 * Models: `threePhaseInstant`, `neutralCurrent`, `floatingNeutral` (Г3, Г3b). Slowed ×50 (50 Hz → 1 Hz).
 */
import { Vector3 } from 'three';
import { fmtUnit } from '@/content';
import { createVibration, createWire, type Wire } from '@/fx';
import { THREE_PHASE, floatingNeutral, neutralCurrent, threePhaseInstant } from '@electricity/sim/generator-ac';
import type { StepFactory } from '../chapter';
import { doc, splitPair } from '../labels';
import { OWN } from '../labels-own';
import { createBulb } from '../parts/bulb';
import { createMeter } from '../parts/meter';
import { createPhasorRig } from '../parts/phasor-rig';
import { BORE_Y, createMagnetRotor, createStator, polar } from '../parts/stator';
import { TraceBuffer } from '../sim-bindings/trace';
import { PHASE, group, roomy, tag } from '../world';

const ID = 'three-phase';
const I_MAX = THREE_PHASE.loadRangeA.max;
const SLOW = 50;
const LX = [-0.1, 1.25, 2.6];
const LZ = 1.95;
const STATOR_AT = new Vector3(-2.2, 0, -0.1);
const P_FULL = 3 * THREE_PHASE.phaseV * I_MAX; // 11 kW: top of the p(t) strip

export const threePhaseStep: StepFactory = (hall) => {
  const { ctx, ui } = hall;
  const set = group(ID, 0, 0.16, 0);
  hall.stageRoot.add(set);
  const machine = group('machine', STATOR_AT.x, 0, STATOR_AT.z);
  const stator = createStator(1);
  const rotor = createMagnetRotor(1.5);
  machine.add(stator.group, rotor);
  machine.scale.setScalar(1.25);
  set.add(machine);
  const shake = createVibration(machine, { amplitude: 0.035, frequency: 2, reducedMotion: ctx.reducedMotion });

  // lamps, phase wires (from the terminal box at the front of the stator), returns and the neutral
  const lamps = LX.map((x) => {
    const b = createBulb();
    b.group.position.set(x, 0, LZ);
    set.add(b.group);
    return b;
  });
  const term = (k: number): Vector3 => new Vector3(STATOR_AT.x + 0.6 + k * 0.28, 0.3, STATOR_AT.z + 1.85);
  const wire = (pts: Vector3[], color: string): Wire => {
    const w = createWire(pts, { radius: 0.045, color, repeat: 1.4, speed: 1.0 });
    set.add(w);
    return w;
  };
  const phaseWires = [0, 1, 2].map((k) => {
    const zk = LZ + 0.45 + k * 0.13;
    return wire([term(k), new Vector3(term(k).x, 0.3, zk), new Vector3(LX[k]! - 0.12, 0.3, zk), new Vector3(LX[k]! - 0.12, 0.3, LZ + 0.05)], PHASE[k]!);
  });
  const starPoint = new Vector3(STATOR_AT.x + 0.9, 0.3, STATOR_AT.z + 1.35);
  const bus = 1.1;
  const neutralParts = [
    ...LX.map((x) => wire([new Vector3(x, 0.3, LZ - 0.05), new Vector3(x, 0.3, bus)], 'blue')),
    wire([new Vector3(3.5, 0.3, bus), new Vector3(starPoint.x, 0.3, bus), starPoint], 'blue'),
  ];
  const neutral = group('neutral', 0, 0, 0, neutralParts);
  set.add(neutral);
  // «Шість дротів?»: three separate returns, one per lamp, back to the machine
  const sixReturns = group('returns', 0, 0, 0, LX.map((x, k) => {
    const z = bus - 0.25 - k * 0.16;
    const w = createWire([new Vector3(x + 0.12, 0.3, LZ - 0.05), new Vector3(x + 0.12, 0.3, z), new Vector3(starPoint.x - 0.1 * k, 0.3, z), new Vector3(starPoint.x - 0.1 * k, 0.3, STATOR_AT.z + 1.2)], { radius: 0.04, color: PHASE[k]!, repeat: 1.4, speed: -1.0 });
    return w;
  }));
  set.add(sixReturns);
  ctx.stage.actor(sixReturns);
  const meter = createMeter({ ring: 'blue', size: 0.36, post: 0.55 });
  meter.group.position.set(3.55, 0, bus + 0.05);
  meter.group.rotation.y = -0.35;
  const inTag = tag('', 20, 'blue', 'mono');
  inTag.position.copy(meter.label).add(meter.group.position);
  set.add(meter.group, inTag);
  const coilTags = PHASE.map((c, k) => {
    const t = tag(`L${k + 1}`, 20, c);
    t.position.copy(polar(2.05, stator.angles[k]!, BORE_Y + 0.55)).add(STATOR_AT);
    set.add(t);
    return t;
  });
  void coilTags;

  // the holographic rig behind: Σ plate, dial, scope, p(t)
  const rig = createPhasorRig({ sum: true, power: true });
  rig.group.position.set(-0.5, 4.75, -3.4);
  rig.group.rotation.y = 0.04;
  set.add(rig.group);
  rig.scope.rangeTag.text = `±${fmtUnit(I_MAX * Math.SQRT2, 'A', { digits: 0 })}`;
  rig.scope.timeTag.text = `${OWN.window} 40 ms`;
  const traces = [new TraceBuffer(2048), new TraceBuffer(2048), new TraceBuffer(2048)];
  const pTraces = [new TraceBuffer(2048), new TraceBuffer(2048)];
  const buf = new Float32Array(200);
  const pBuf = new Float32Array(160);

  // ------------------------------------------------------------------ state
  const st = { tv: 0, sixT: -1 };
  const base = doc(ID, 0).replace(/\s*L1\/L2\/L3\s*/, '');
  const single = (): boolean => ui.value<string>('mode4') === 'single';
  const noNeutral = (): boolean => ui.value<boolean>('noN4');
  const loads = (): [number, number, number] => {
    const i = [ui.value<number>('i41'), ui.value<number>('i42'), ui.value<number>('i43')] as [number, number, number];
    return single() ? [i[0], 0, 0] : i;
  };
  /** Load voltages (Г3b without the neutral) and the actual lamp currents. */
  const state = () => {
    const I = loads();
    const V: [number, number, number] = noNeutral() ? floatingNeutral(I).loadVoltagesV : [THREE_PHASE.phaseV, THREE_PHASE.phaseV, THREE_PHASE.phaseV];
    const Ia = I.map((x, k) => (x * V[k]!) / THREE_PHASE.phaseV) as [number, number, number];
    return { I: Ia, V, iN: noNeutral() ? 0 : neutralCurrent(Ia[0], Ia[1], Ia[2]).magnitudeA, shift: noNeutral() ? floatingNeutral(I).neutralShiftV : 0 };
  };
  const reseed = (): void => {
    for (const t of [...traces, ...pTraces]) t.clear();
    st.tv = 0;
    st.sixT = -1;
    for (let k = 0; k <= 120; k++) push(-2 + (2 * k) / 120);
  };
  function push(tv: number): void {
    const s = state();
    const inst = threePhaseInstant(tv / SLOW, s.I);
    inst.currentsA.forEach((i, k) => traces[k]!.push(tv, i / (I_MAX * Math.SQRT2)));
    const u = inst.voltagesV;
    const p1 = u[0] * inst.currentsA[0];
    const p3 = u[0] * inst.currentsA[0] + u[1] * inst.currentsA[1] + u[2] * inst.currentsA[2];
    pTraces[0]!.push(tv, (p1 / P_FULL) * 2 - 1);
    pTraces[1]!.push(tv, (p3 / P_FULL) * 2 - 1);
  }
  const six = (): void => {
    st.sixT = 0;
    ctx.stage.toggle(sixReturns, true);
    ctx.stage.toggle(neutral, false);
    hall.sound.click(0.9);
  };
  const mid = new Vector3();

  return {
    id: ID,
    shots: {
      [ID]: { position: [1.4, 5.4, 11.0], target: [0.0, 2.35, -0.6], fov: 34, fit: { center: [0, 2.4, -0.6], radius: 5.8 } },
    },
    stage: { show: [set, neutral], enter: () => reseed() },
    ui: {
      honesty: [{ slowed: SLOW }],
      controls: [
        ...[0, 1, 2].map((k) => ({
          type: 'slider' as const,
          id: `i4${k + 1}`,
          label: `${base} L${k + 1}`,
          min: THREE_PHASE.loadRangeA.min,
          max: I_MAX,
          step: THREE_PHASE.loadRangeA.step,
          value: THREE_PHASE.loadRangeA.default,
          unit: 'A',
          digits: 1,
          disabled: () => single() && k > 0,
        })),
        {
          type: 'segmented',
          id: 'mode4',
          items: splitPair(doc(ID, 2)).map((label, i) => ({ id: i === 0 ? 'single' : 'three', label })),
          value: 'three',
        },
        {
          type: 'toggle',
          id: 'noN4',
          label: doc(ID, 4),
          value: false,
          onChange: (on) => {
            ctx.stage.toggle(neutral, !on);
            hall.sound.relay();
          },
        },
        {
          type: 'stats',
          id: 'read4',
          columns: 3,
          items: [
            { label: 'I_N', get: () => (noNeutral() ? '—' : fmtUnit(state().iN, 'A', { digits: 1 })), color: () => 'blue' },
            { label: 'P', get: () => fmtUnit(state().I.reduce((a, i, k) => a + i * state().V[k]!, 0) / 1000, 'kW', { digits: 2 }) },
            { label: 'U_N′', get: () => fmtUnit(state().shift, 'V', { digits: 0 }), color: () => (state().shift > 23 ? 'amber' : 'green') },
          ],
        },
        { type: 'button', id: 'six4', label: doc(ID, 7), icon: 'help', onClick: six, disabled: () => noNeutral() || st.sixT >= 0 },
      ],
      callouts: [
        { anchor: () => machine.localToWorld(mid.set(0, BORE_Y + 0.3, 0)), text: OWN.magnetRotor, side: 'left' },
        { anchor: () => set.localToWorld(mid.set(0.4, 0.35, bus)), text: OWN.neutralWire, side: 'down', color: 'blue', visible: () => !noNeutral() && roomy(hall) },
      ],
      hotspots: [
        { anchor: () => machine.localToWorld(polar(1.1, stator.angles[0]!, BORE_Y + 0.35, mid)), content: 0 },
        { anchor: () => meter.group.localToWorld(mid.copy(meter.face)), content: 1 },
        { anchor: () => rig.sumCentre(mid), content: 2 },
      ],
    },
    probe: () => {
      const s = state();
      return {
        I: s.I.map((x) => +x.toFixed(3)),
        V: s.V.map((x) => +x.toFixed(1)),
        iN: s.iN,
        shift: s.shift,
        single: single(),
        neutral: !noNeutral(),
        six: st.sixT >= 0,
        returns: sixReturns.visible,
        shake: shake.amount,
        lamp0: lamps[0]!.halo.intensity,
        gap: rig.gap?.visible ?? false,
      };
    },
    update(dt) {
      if (!hall.isCurrent(ID)) return;
      st.tv += dt;
      push(st.tv);
      const wt = 2 * Math.PI * st.tv; // 50 Hz shown at 1 Hz
      rotor.rotation.y = wt - Math.PI / 2; // N passes coil k when phase k peaks
      for (let k = 0; k < 3; k++) rig.scope.setTrace(k, traces[k]!.sample(st.tv, 2, buf, 0));
      if (rig.power) {
        rig.power.setTrace(0, pTraces[0]!.sample(st.tv, 2, pBuf, -1));
        rig.power.setTrace(1, pTraces[1]!.sample(st.tv, 2, pBuf, -1));
        rig.power.scope.setChannelIntensity(0, single() ? 1.3 : 0.45);
        rig.power.scope.setChannelIntensity(1, single() ? 0.35 : 1.2);
      }
      const s = state();
      const amps = s.I.map((x) => x / I_MAX);
      rig.setPhasors(wt, amps);
      const inst = threePhaseInstant(st.tv / SLOW, s.I);
      for (let k = 0; k < stator.coilMats.length; k++) {
        const ph = stator.phaseOf[k]!;
        stator.coilMats[k]!.emissiveIntensity = 0.08 + (0.9 * Math.abs(inst.currentsA[ph]!)) / (I_MAX * Math.SQRT2);
      }
      lamps.forEach((l, k) => l.setPower(Math.pow(Math.max(0, s.I[k]!) / I_MAX, 0.6) * Math.min(1.3, Math.pow(s.V[k]! / THREE_PHASE.phaseV, 3.4))));
      phaseWires.forEach((w, k) => (w.material.power = s.I[k]! / I_MAX));
      const nPow = Math.min(1, s.iN / I_MAX);
      for (const w of neutralParts) {
        w.material.power = nPow;
        w.material.fade = 0.35 + 0.65 * Math.min(1, s.iN / 4); // a resting neutral turns ghostly
      }
      meter.setNeedle(s.iN / I_MAX);
      inTag.text = noNeutral() ? '—' : `I_N = ${fmtUnit(s.iN, 'A', { digits: 1 })}`;
      shake.amount = single() ? 1 : 0;
      shake.update(dt, st.tv);
      if (st.sixT >= 0) {
        st.sixT += dt;
        if (st.sixT > 2.2 && sixReturns.visible && !noNeutral()) {
          ctx.stage.toggle(sixReturns, false);
          ctx.stage.toggle(neutral, true);
        }
        if (st.sixT > 3.4) st.sixT = -1;
      }
      hall.sound.hum = 0.08 + 0.2 * (amps[0]! + amps[1]! + amps[2]!) / 3 + (single() ? 0.12 : 0);
    },
  };
};
