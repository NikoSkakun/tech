/**
 * Step 1 `why-inverter` — the whole bench: DC sources on the left (even pulses, a flat line on the scope), the
 * socket on the right (a sine ribbon, ±325 V), the inverter «ЛІ-6» between them, its cover lifting on
 * holographic cables. Hover / tap a stage to light it up; «Рентген» leaves only the current paths.
 */
import { Mesh, TorusGeometry, Vector3 } from 'three';
import { K, MOTION } from '@/style';
import type { StepFactory } from '../chapter';
import { doc } from '../labels';
import { OWN } from '../labels-own';
import { invToSet } from '../parts/bench-set';
import { STAGE, type StageName } from '../parts/inverter-layout';
import { pickBox } from '../world';
import { sharedBench } from './shared-bench';

const ID = 'why-inverter';
/** Stages that answer to hover / tap: name, tooltip, footprint (x, z) of the pick box. */
const ZONES: readonly [StageName, string, number, number][] = [
  ['pvA', OWN.pvInputs, 0.9, 1.3],
  ['chokeA', OWN.boostStage, 1.5, 1.4],
  ['link', OWN.dcLink, 1.1, 1.5],
  ['bridge', OWN.bridge, 1.9, 1.0],
  ['filterL', OWN.lcFilter, 1.3, 1.0],
  ['relayGrid', OWN.relays, 0.7, 1.2],
  ['bat', OWN.batPort, 0.8, 0.9],
  ['transformer', OWN.hfTransformer, 1.2, 0.9],
  ['control', OWN.controlBoard, 2.5, 1.2],
];

export const whyInverter: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const bench = sharedBench(lab);
  const { inv } = bench;

  // one highlight ring that jumps to the stage under the pointer
  const ringMat = K.glow({ color: 'cyan', intensity: 0, whiten: 0, keepHue: true, falloff: 0 });
  const ring = new Mesh(new TorusGeometry(1, 0.035, 8, 64).rotateX(Math.PI / 2), ringMat);
  inv.group.add(ring);
  let hovered: StageName | null = null;
  for (const [name, tooltip, w, d] of ZONES) {
    const s = STAGE[name];
    const cz = name === 'pvA' || name === 'chokeA' ? -0.7 : s.at.z;
    const box = pickBox(w, 0.9, d, s.at.x, s.at.y + 0.45, cz);
    inv.group.add(box);
    const light = (over: boolean): void => {
      if (over) {
        hovered = name;
        ring.position.set(s.at.x, s.at.y + 0.1, cz);
        ring.scale.set(w * 0.62, 1, d * 0.62);
      } else if (hovered !== name) return;
      ctx.tweens.to(ringMat, { intensity: over ? 1.8 : 0 }, { duration: MOTION.hover.duration });
    };
    ctx.input.register(box, {
      tooltip,
      cursor: 'pointer',
      hover: (over) => light(over),
      // one finger: a tap lights the stage for a moment and names it
      click: () => {
        light(true);
        ui.toast(tooltip, { icon: 'info' });
        ctx.stage.scope.delay(1.6, () => light(false));
      },
      enabled: () => lab.isCurrent(ID) && bench.xray.value < 0.5,
    });
  }

  const xrayOn = (): boolean => ui.value<boolean>('xray1');
  const at = (name: StageName, lift = 0): (() => Vector3) => {
    const p = invToSet(STAGE[name].at.clone().setY(STAGE[name].at.y + STAGE[name].top + lift));
    const out = new Vector3();
    return () => lab.stageRoot.localToWorld(out.copy(p));
  };
  const point = (p: Vector3): (() => Vector3) => {
    const out = new Vector3();
    return () => lab.stageRoot.localToWorld(out.copy(p));
  };

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.7, 7.0, 14.8],
        target: [0, 1.7, 0.1],
        fov: 30,
        orbit: { azimuth: 1.05, polar: 0.4, zoom: [0.55, 1.4] },
        fit: { center: [0, 1.6, 0], radius: 6.4 },
      },
    },
    stage: {
      show: [bench.actor],
      params: { coverOpen: 1 },
      post: { bloomIntensity: 1.1 },
    },
    ui: {
      hint: OWN.hint1,
      honesty: ['notToScale', { slowed: 100 }],
      reset: true,
      controls: [
        {
          type: 'toggle',
          id: 'xray1',
          label: doc(ID, 0),
          value: false,
          onChange: (on) => ctx.stage.setParam('xray', on ? 1 : 0),
        },
      ],
      callouts: [
        { anchor: point(bench.points.module), text: OWN.pvModule, side: 'left' },
        { anchor: point(bench.points.battery), text: OWN.battery, side: 'left' },
        { anchor: point(bench.points.socket), text: OWN.socket, side: 'up' },
        { anchor: point(bench.points.charger), text: OWN.charger, side: 'right', color: 'sky' },
        { anchor: at('control'), text: OWN.controlBoard, color: 'cyan', visible: () => !xrayOn() },
        { anchor: at('filterL'), text: OWN.lcFilter, side: 'up', visible: () => !xrayOn() },
        { anchor: at('transformer'), text: OWN.hfTransformer, side: 'down', visible: () => !xrayOn() },
        { anchor: at('bridge', 0.2), text: OWN.pathPv, color: 'yellow', side: 'up', visible: xrayOn },
        { anchor: at('transformer'), text: OWN.pathBat, color: 'yellow', side: 'down', visible: xrayOn },
      ],
      hotspots: [
        { anchor: at('link'), content: 'dc-link', visible: () => !xrayOn() },
        { anchor: at('bridge'), content: 'h-bridge', visible: () => !xrayOn() },
        { anchor: at('relayGrid'), content: 'relays', visible: () => !xrayOn() },
      ],
    },
    probe: () => ({ xray: bench.xray.value, open: bench.open.value, hovered }),
    update(_dt, t) {
      if (!lab.isCurrent(ID)) return;
      const x = bench.xray.value;
      bench.idle(t, 0.75 + 0.25 * x);
      // the battery charges from the link here: its pulses run backwards (toward the port)
      inv.wires.bat.material.speed = -Math.abs(inv.wires.bat.material.speed);
      bench.feeds.bat.material.speed = -Math.abs(bench.feeds.bat.material.speed);
      inv.setLinkVoltage(400 + 6 * Math.sin(t * Math.PI * 2));
    },
  };
};
