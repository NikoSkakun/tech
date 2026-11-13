/**
 * Step 5 `star-delta` — the three windings morph between a star (neutral node, 230 V phase–neutral, 400 V
 * phase–phase) and a delta (ring, no neutral). The phasor plate shows U₁, U₂ and their difference — the line
 * voltage, √3 times longer. In front: a motor's terminal box with six studs and three copper jumpers; drag them
 * (or use the Y / Δ switch). On a 400 V network the motor (Δ/Y 230/400 V) must be in star; in delta it hums and
 * overheats. Models: `lineVoltage`, `motorConnection` (Г3).
 */
import { Vector3 } from 'three';
import { fmtUnit } from '@/content';
import { applyHeat, createVectorArrow } from '@/fx';
import { motor } from '@/kit';
import { THREE_PHASE, lineVoltage, motorConnection } from '@electricity/sim/generator-ac';
import type { KToonMaterial } from '@/style';
import type { StepFactory } from '../chapter';
import { doc, splitPair } from '../labels';
import { OWN } from '../labels-own';
import { createDial } from '../parts/holo-scope';
import { createMeter } from '../parts/meter';
import { createStarDeltaBoard } from '../parts/star-delta-board';
import { SLOTS, createTerminalBox, type Layout } from '../parts/terminal-box';
import { PHASE, group, pickBox, roomy, tag } from '../world';

const ID = 'star-delta';
const NET_V = 400;

export const starDelta: StepFactory = (hall) => {
  const { ctx, ui } = hall;
  const set = group(ID, 0, 0.16, 0);
  hall.stageRoot.add(set);
  const board = createStarDeltaBoard();
  board.group.position.set(-2.5, 2.55, -1.4);
  board.group.rotation.y = 0.22;
  set.add(board.group);
  const delta = ctx.stage.param('delta5', 0, { duration: 1.4, ease: 'power2.inOut', onChange: (v) => board.set(v) });

  // voltmeters: phase–neutral and phase–phase, in front of the board
  const vPN = createMeter({ ring: 'blue', size: 0.36, post: 0.5 });
  vPN.group.position.set(-3.4, 0, 0.75);
  vPN.group.rotation.y = 0.3;
  const vPP = createMeter({ ring: 'teal', size: 0.36, post: 0.5 });
  vPP.group.position.set(-1.9, 0, 0.95);
  vPP.group.rotation.y = 0.2;
  const tPN = tag('', 19, 'white', 'mono');
  tPN.position.copy(vPN.label).add(vPN.group.position);
  const tPP = tag('', 19, 'white', 'mono');
  tPP.position.copy(vPP.label).add(vPP.group.position);
  set.add(vPN.group, vPP.group, tPN, tPP);

  // phasor plate: U1, U2, U3 and U12 = U1 − U2 (static construction)
  const plate = group('phasor-plate', 2.3, 3.0, -1.9);
  plate.rotation.y = -0.25;
  const SIZE = 2.9;
  plate.add(createDial(SIZE));
  const R = SIZE * 0.36;
  const uArrows = PHASE.map((c) => {
    const a = createVectorArrow({ color: c, radius: 0.035, headLength: 0.2, headRadius: 0.09, intensity: 1.5 });
    plate.add(a);
    return a;
  });
  const lineArrow = createVectorArrow({ color: 'white', radius: 0.045, headLength: 0.24, headRadius: 0.11, intensity: 1.6 });
  plate.add(lineArrow);
  const uTags = PHASE.map((c, k) => {
    const t = tag(`U${'₁₂₃'[k]}`, 19, c, 'mono');
    plate.add(t);
    return t;
  });
  const lineTag = tag('', 20, 'white', 'mono');
  plate.add(lineTag);
  set.add(plate);

  // terminal box + motor on the network
  const box = createTerminalBox();
  box.group.position.set(1.3, 1.15, 1.7);
  box.group.rotation.x = -0.55;
  box.group.scale.setScalar(1.05);
  const drive = motor({ scale: 1.7, cut: 1.6 });
  drive.group.position.set(3.4, 0, 0.9);
  drive.group.rotation.y = -0.6;
  const heat = drive.mats.list().filter((m) => 'emissiveIntensity' in m) as unknown as KToonMaterial[];
  set.add(box.group, drive.group);
  box.jumpers.forEach((j, i) => ctx.qa.probe(`jumper-${i}`, j));
  ctx.qa.probe('slot-0', () => box.group.localToWorld(SLOTS[0]!.at.clone()));
  const proxies = box.jumpers.map((j, i) => {
    const p = pickBox(0.4, 0.95, 0.3);
    p.name = `jumper-${i}`;
    j.add(p);
    return p;
  });
  const n = new Vector3();
  const through = new Vector3();
  const local = new Vector3();
  proxies.forEach((p, j) =>
    ctx.input.register(p, {
      tooltip: OWN.jumperHint,
      cursor: 'grab',
      enabled: () => hall.isCurrent(ID),
      dragStart: () => {
        box.group.getWorldDirection(n);
        box.group.getWorldPosition(through);
        hall.sound.click(1.2);
      },
      drag: (e) => {
        const q = e.planePoint(n, through, local);
        if (q) box.hold(j, box.group.worldToLocal(q.clone()));
      },
      dragEnd: (e) => {
        const q = e.planePoint(n, through, local);
        box.drop(j, q ? box.group.worldToLocal(q.clone()) : box.jumpers[j]!.position.clone());
        hall.sound.click(0.9);
        const l = box.layout();
        if (l && l !== ui.value<string>('conn5')) ui.set('conn5', l, { notify: true });
      },
    }),
  );

  const conn = (): Layout => (ui.value<string>('conn5') === 'delta' ? 'delta' : 'star');
  const uPh = (): number => ui.value<number>('uph5');
  /** Line voltage of the windings on the board: Y → √3·U_ph, Δ → U_ph. */
  const uLine = (): number => (conn() === 'star' ? lineVoltage(uPh()) : uPh());
  /** The motor on the 400 V network, wired as the jumpers are (null = jumpers not in a valid layout). */
  const wired = (): Layout | null => box.layout();
  const motorState = () => {
    const w = wired();
    return w ? motorConnection(w, NET_V) : null;
  };
  const mid = new Vector3();
  const drawPhasors = (): void => {
    const r = (uPh() / 250) * R;
    const tips = PHASE.map((_, k) => {
      const a = Math.PI / 2 - (k * 2 * Math.PI) / 3;
      return new Vector3(Math.cos(a) * r, Math.sin(a) * r, 0.05);
    });
    tips.forEach((t, k) => {
      uArrows[k]!.set(new Vector3(0, 0, 0.05), t);
      uTags[k]!.position.copy(t).multiplyScalar(1.22).setZ(0.08);
    });
    // U12 = U1 − U2: from the tip of U2 to the tip of U1
    lineArrow.set(tips[1]!.clone().setZ(0.07), tips[0]!.clone().sub(tips[1]!));
    lineTag.text = `U_L = ${fmtUnit(lineVoltage(uPh()), 'V', { digits: 0 })}`;
    lineTag.position.copy(tips[0]!).lerp(tips[1]!, 0.5).add(new Vector3(0.95, 0.25, 0.08));
  };

  return {
    id: ID,
    shots: {
      [ID]: { position: [0.6, 4.6, 10.6], target: [-0.1, 2.0, -0.4], fov: 34, fit: { center: [-0.1, 2, -0.4], radius: 5.4 } },
    },
    stage: {
      show: [set],
      enter: (info) => {
        box.setLayout(conn(), info.instant);
        ctx.stage.setParam('delta5', conn() === 'delta' ? 1 : 0, { instant: true });
      },
    },
    ui: {
      controls: [
        {
          type: 'segmented',
          id: 'conn5',
          items: splitPair(doc(ID, 0)).map((label, i) => ({ id: i === 0 ? 'star' : 'delta', label })),
          value: 'star',
          onChange: (v) => {
            const l: Layout = v === 'delta' ? 'delta' : 'star';
            ctx.stage.setParam('delta5', l === 'delta' ? 1 : 0, { duration: 1.4 });
            if (box.layout() !== l) box.setLayout(l);
            hall.sound.relay();
          },
        },
        { type: 'slider', id: 'uph5', label: doc(ID, 1), min: THREE_PHASE.phaseRangeV.min, max: THREE_PHASE.phaseRangeV.max, step: THREE_PHASE.phaseRangeV.step, value: THREE_PHASE.phaseRangeV.default, unit: 'V' },
        {
          type: 'stats',
          id: 'read5',
          columns: 3,
          items: [
            { label: 'U_ph', get: () => fmtUnit(uPh(), 'V', { digits: 0 }) },
            { label: 'U_L', get: () => fmtUnit(uLine(), 'V', { digits: 0 }) },
            { label: 'I_L / I_ph', get: () => (conn() === 'star' ? '1' : '√3 ≈ 1,73') },
          ],
        },
        {
          type: 'note',
          id: 'game5',
          icon: 'warning',
          color: () => (motorState()?.ok ? 'green' : motorState() ? 'red' : 'amber'),
          text: () => {
            const m = motorState();
            if (!m) return OWN.jumpersIncomplete;
            return m.ok ? `${OWN.motorOk} ${fmtUnit(m.windingV, 'V', { digits: 0 })}` : doc(ID, 4);
          },
        },
      ],
      callouts: [
        { anchor: () => board.group.localToWorld(mid.copy(board.node).setZ(0.1)), text: OWN.starPoint, side: 'left', color: 'blue', visible: () => delta.value < 0.5 && roomy(hall) },
        { anchor: () => drive.group.localToWorld(mid.set(0, 1.3, 0)), text: OWN.motor400, side: 'up' },
      ],
      hotspots: [
        { anchor: () => lineArrow.tip.getWorldPosition(mid), content: 0 },
        { anchor: () => box.group.localToWorld(mid.set(0.9, 0.55, 0.2)), content: 1 },
      ],
    },
    probe: () => ({
      conn: conn(),
      delta: delta.value,
      uPh: uPh(),
      uL: uLine(),
      wired: wired(),
      windingV: motorState()?.windingV ?? null,
      ok: motorState()?.ok ?? null,
      slots: [...box.slots],
    }),
    update(dt, t) {
      if (!hall.isCurrent(ID)) return;
      box.update(dt);
      drawPhasors();
      const y = conn() === 'star';
      vPN.setNeedle(y ? uPh() / 450 : 0);
      tPN.text = `${OWN.phaseNeutral}: ${y ? fmtUnit(uPh(), 'V', { digits: 0 }) : '—'}`;
      vPP.setNeedle(uLine() / 450);
      tPP.text = `${OWN.phasePhase}: ${fmtUnit(uLine(), 'V', { digits: 0 })}`;
      const m = motorState();
      drive.speed = m ? (m.ok ? 9 : 5 + Math.sin(t * 30) * 0.5) : 0;
      drive.update?.(dt, t);
      const hot = m && !m.ok ? 0.55 + 0.35 * Math.sin(t * 5) : 0;
      for (const m of heat) applyHeat(m, hot);
      hall.sound.hum = m ? (m.ok ? 0.12 : 0.3) : 0.04;
      hall.sound.buzz = m && !m.ok ? 0.5 : 0;
    },
  };
};
