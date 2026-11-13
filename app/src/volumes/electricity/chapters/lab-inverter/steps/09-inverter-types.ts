/**
 * Step 9 `inverter-types` — a gallery of five miniature systems: off-grid, string, micro-inverters, central,
 * hybrid. «Мережа є / немає» and «Сонце є / немає» act on all of them at once, so the learner sees in which
 * houses the light stays on; picking an exhibit brings it forward; «Порівняти» opens the comparison table.
 * Behaviour: `sim-bindings/types-logic` (the document's rules; the anti-islanding rule of step 8 at work).
 */
import { Mesh, SphereGeometry, Vector3 } from 'three';
import { damp } from '@/engine/api';
import { createHalo } from '@/fx';
import { K } from '@/style';
import { STATUS } from '@/ui3d';
import type { StepFactory } from '../chapter';
import { doc, pairTitle } from '../labels';
import { OWN } from '../labels-own';
import { createExhibit } from '../parts/type-exhibits';
import { INVERTER_TYPES, TYPE_FACTS, typeFlows, type InverterType } from '../sim-bindings/types-logic';
import { group } from '../world';

const ID = 'inverter-types';
const NAMES: Record<InverterType, string> = {
  offgrid: OWN.typeOffgrid,
  string: OWN.typeString,
  micro: OWN.typeMicro,
  central: OWN.typeCentral,
  hybrid: OWN.typeHybrid,
};

export const inverterTypes: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const exhibits = INVERTER_TYPES.map((type, i) => {
    const e = createExhibit(type);
    e.group.position.set((i - 2) * 2.15, 0, -0.5 - Math.abs(i - 2) * 0.25);
    return e;
  });
  // the sun over the shelf: a glowing ball that goes out with «Сонце є / немає»
  const sunMat = K.glow({ color: 'yellow', intensity: 2, whiten: 0.5 });
  const sun = new Mesh(new SphereGeometry(0.42, 32, 20), sunMat);
  const halo = createHalo({ color: 'yellow', size: 3.2, intensity: 0.8 });
  const sky = group('sun', -4.4, 3.3, -2.2, [sun, halo]);
  const set = group(`set:${ID}`, 0, 0, 0, [...exhibits.map((e) => e.group), sky]);
  lab.stageRoot.add(set);

  const selected = (): InverterType => ui.value<InverterType>('type9');
  const gridOn = (): boolean => ui.value<boolean>('grid9');
  const sunOn = (): boolean => ui.value<boolean>('sun9');
  const now = (): ReturnType<typeof typeFlows> => typeFlows(selected(), gridOn(), sunOn());
  let compare = false;
  exhibits.forEach((e) => {
    ctx.input.register(e.hit, {
      tooltip: NAMES[e.type],
      cursor: 'pointer',
      click: () => ui.set('type9', e.type, { notify: true }),
      enabled: () => lab.isCurrent(ID),
    });
    ctx.qa.probe(`exhibit-${e.type}`, e.hit);
  });
  const mark = (v: boolean): string => (v ? OWN.yes : OWN.no);
  const price = doc(ID, 4)
    .split('/')
    .map((x) => x.trim());
  const at = (i: number, key: 'top' | 'inverter' | 'grid'): (() => Vector3) => {
    const out = new Vector3();
    return () => exhibits[i]!.group.localToWorld(out.copy(exhibits[i]!.points[key]));
  };
  let glow = 1;

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0, 6.0, 10.4],
        target: [0, 1.0, 0.1],
        fov: 30,
        frameAspect: 2.1,
        orbit: { azimuth: 0.5, polar: 0.3 },
        fit: { center: [0, 1, 0], radius: 5.6 },
      },
    },
    stage: { show: [set], enter: () => (compare = false), post: { bloomIntensity: 1.1 } },
    ui: {
      hint: OWN.hint9,
      honesty: ['simplified', 'notToScale'],
      controls: [
        {
          type: 'segmented',
          id: 'type9',
          items: INVERTER_TYPES.map((id) => ({ id, label: NAMES[id] })),
          value: 'hybrid',
          onChange: () => lab.sound.click(),
        },
        { type: 'toggle', id: 'grid9', label: doc(ID, 0), value: true },
        { type: 'toggle', id: 'sun9', label: doc(ID, 1), value: true },
        {
          type: 'readout',
          id: 'lit9',
          label: pairTitle(doc(ID, 2)),
          text: () => mark(now().houseLit),
          color: () => (now().houseLit ? STATUS.ok : STATUS.alarm),
        },
        {
          type: 'readout',
          id: 'run9',
          label: OWN.inverterState,
          text: () => (now().running ? OWN.inverterOn : OWN.inverterOff),
          color: () => (now().running ? STATUS.ok : STATUS.alarm),
        },
        {
          type: 'button',
          id: 'compare9',
          label: doc(ID, 3),
          icon: 'layers',
          primary: true,
          onClick: () => (compare = !compare),
        },
      ],
      board: {
        title: OWN.board9,
        size: 'lg',
        visible: () => compare,
        children: [
          {
            type: 'table',
            id: 'table9',
            head: [OWN.colType, OWN.colBattery, OWN.colBlackout, OWN.colExport, OWN.colShade, OWN.colPrice],
            rows: INVERTER_TYPES.map((t) => {
              const f = TYPE_FACTS[t];
              return [
                NAMES[t],
                mark(f.battery),
                mark(f.blackout),
                mark(f.exports),
                f.shadeLocal ? OWN.shadeModule : OWN.shadeString,
                price[f.price - 1] ?? '',
              ];
            }),
            highlight: () => INVERTER_TYPES.indexOf(selected()),
            align: ['left', 'center', 'center', 'center', 'left', 'center'],
          },
        ],
      },
      callouts: [
        ...INVERTER_TYPES.map((t, i) => ({
          anchor: at(i, 'top'),
          // the state is named only when it is the news: a dark house
          text: () => (typeFlows(t, gridOn(), sunOn()).houseLit ? NAMES[t] : `${NAMES[t]} · ${OWN.dark}`),
          side: 'up' as const,
        })),
        {
          anchor: () => sky.getWorldPosition(new Vector3()),
          text: OWN.sun,
          color: 'yellow',
          side: 'left',
          visible: sunOn,
        },
      ],
      hotspots: [
        { anchor: at(4, 'inverter'), content: 'backup-relay' },
        { anchor: at(1, 'grid'), content: 'ac-coupling' },
      ],
    },
    probe: () => ({
      type: selected(),
      grid: gridOn(),
      sun: sunOn(),
      lit: now().houseLit,
      running: now().running,
      litCount: INVERTER_TYPES.filter((t) => typeFlows(t, gridOn(), sunOn()).houseLit).length,
      compare,
      front: exhibits[INVERTER_TYPES.indexOf(selected())]!.group.position.z,
    }),
    update(dt, t) {
      const sel = selected();
      exhibits.forEach((e, i) => {
        e.apply(typeFlows(e.type, gridOn(), sunOn()));
        // the chosen exhibit steps forward and grows; the others wait on the shelf line
        const on = e.type === sel;
        const z = on ? 1.35 : -0.5 - Math.abs(i - 2) * 0.25;
        e.group.position.z = damp(e.group.position.z, z, 7, dt);
        e.group.scale.setScalar(damp(e.group.scale.x, on ? 1.3 : 1, 7, dt));
        e.group.position.y = on ? 0.04 * Math.sin(t * 1.6) + 0.04 : 0;
      });
      glow = damp(glow, sunOn() ? 1 : 0, 5, dt);
      sunMat.intensity = 0.15 + 1.9 * glow;
      halo.intensity = 0.8 * glow;
      sky.position.y = 3.3 + 0.08 * Math.sin(t * 0.7);
      lab.sound.hum = now().running ? 0.2 : 0.05;
    },
  };
};
