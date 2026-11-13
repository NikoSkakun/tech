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
import { createOneLine, ONE_LINE } from '../parts/one-line';
import { ACCENT, createExhibit } from '../parts/type-exhibits';
import { INVERTER_TYPES, TYPE_FACTS, typeFlows, type InverterType } from '../sim-bindings/types-logic';
import { group } from '../world';

const ID = 'inverter-types';
/** The shelf line of the waiting exhibits, and the spot in front where the picked one stands (set space). */
const SHELF = { z: -1.5, s: 0.75 } as const;
/** The four waiting exhibits keep their order and leave the middle free for the picked one. */
const SLOTS = [-3.6, -1.9, 1.9, 3.6] as const;
const slotX = (i: number, picked: number): number => SLOTS[i < picked ? i : i - 1] ?? 0;
const HERO = { z: 1.35, s: 1.6 } as const;
/** The one-line diagram floats over the picked exhibit (centre, set space). */
const DIAGRAM = { y: 3.15, z: 0.85, s: 0.85 } as const;
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
    e.group.position.set(slotX(i, INVERTER_TYPES.length - 1), 0, SHELF.z);
    e.group.scale.setScalar(SHELF.s);
    return e;
  });
  const diagrams = INVERTER_TYPES.map((type) => {
    const d = createOneLine(type, ACCENT[type]);
    d.group.position.set(0, DIAGRAM.y, DIAGRAM.z);
    d.group.rotation.x = -0.12;
    d.group.scale.setScalar(0.001);
    d.group.visible = false;
    return d;
  });
  // the sun over the shelf: a glowing ball that goes out with «Сонце є / немає»
  const sunMat = K.glow({ color: 'yellow', intensity: 2, whiten: 0.5 });
  const sun = new Mesh(new SphereGeometry(0.42, 32, 20), sunMat);
  const halo = createHalo({ color: 'yellow', size: 3.2, intensity: 0.8 });
  const sky = group('sun', -4.4, 3.3, -2.2, [sun, halo]);
  const set = group(`set:${ID}`, 0, 0, 0, [
    ...exhibits.map((e) => e.group),
    ...diagrams.map((d) => d.group),
    sky,
  ]);
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
      // the picked exhibit stands large in front: its pick box must not take the taps meant for the shelf
      enabled: () => lab.isCurrent(ID) && selected() !== e.type,
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
  /** Name tag of an exhibit: on its top while it waits on the shelf, on the diagram's corner once picked. */
  const nameAt = (i: number): (() => Vector3) => {
    const out = new Vector3();
    const corner = new Vector3(-ONE_LINE.w / 2 + 0.5, ONE_LINE.h / 2, 0);
    return () =>
      INVERTER_TYPES[i] === selected()
        ? diagrams[i]!.group.localToWorld(out.copy(corner))
        : exhibits[i]!.group.localToWorld(out.copy(exhibits[i]!.points.top));
  };
  let glow = 1;

  return {
    id: ID,
    shots: {
      [ID]: {
        // the picked exhibit and its diagram fill the middle; the shelf of the other four stays readable
        position: [0, 5.0, 10.6],
        target: [0, 2.1, 0.2],
        fov: 30,
        frameAspect: 1.55,
        orbit: { azimuth: 0.5, polar: 0.3 },
        fit: { center: [0, 2, 0], radius: 4.8 },
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
          anchor: nameAt(i),
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
      diagram: diagrams
        .filter((d) => d.group.visible)
        .map((d) => d.group.name)
        .join(','),
      relayOpen: diagrams[INVERTER_TYPES.indexOf(selected())]!.relayOpen(),
    }),
    update(dt, t) {
      const sel = selected();
      exhibits.forEach((e, i) => {
        e.apply(typeFlows(e.type, gridOn(), sunOn()));
        // the chosen exhibit steps forward and grows; the others wait on the shelf line
        const on = e.type === sel;
        e.group.position.x = damp(e.group.position.x, on ? 0 : slotX(i, INVERTER_TYPES.indexOf(sel)), 7, dt);
        e.group.position.z = damp(e.group.position.z, on ? HERO.z : SHELF.z, 7, dt);
        e.group.scale.setScalar(damp(e.group.scale.x, on ? HERO.s : SHELF.s, 7, dt));
        e.group.position.y = on ? 0.04 * Math.sin(t * 1.6) + 0.04 : 0;
        const d = diagrams[i]!;
        d.group.scale.setScalar(damp(d.group.scale.x, on ? DIAGRAM.s : 0.001, 9, dt));
        d.group.visible = d.group.scale.x > 0.02;
        if (d.group.visible) d.apply(typeFlows(e.type, gridOn(), sunOn()), gridOn(), t);
      });
      glow = damp(glow, sunOn() ? 1 : 0, 5, dt);
      sunMat.intensity = 0.15 + 1.9 * glow;
      halo.intensity = 0.8 * glow;
      sky.position.y = 3.3 + 0.08 * Math.sin(t * 0.7);
      lab.sound.hum = now().running ? 0.2 : 0.05;
    },
  };
};
