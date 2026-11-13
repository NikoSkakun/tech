/**
 * Step 3 `source-emf` — the source, EMF and the water analogy. A cut-open cell lifts charge by ℰ; the leads
 * show the potential ramp (`coral` from «+», `blue` after the lamp); two ammeters, before and after the lamp,
 * read the same current. «Водна аналогія» swaps the same circuit for pipes, a pump and a paddle wheel on the
 * very same routes. Model: `sourceEmfLamp` (§3: lamp 24 Ω, I = ℰ/R, brightness ∝ √P).
 */
import { Color, Vector3 } from 'three';
import { fmtNumber, fmtUnit } from '@/content';
import { voltageRamp } from '@/style';
import raw from '@electricity/content/generated/current.json';
import { SOURCE_EMF, sourceEmfLamp } from '@electricity/sim/current';
import type { StepFactory } from '../chapter';
import { DOC } from '../labels';
import { OWN } from '../labels-own';
import { createBatteryCutaway } from '../parts/battery-cutaway';
import { createBulb } from '../parts/bulb';
import { anchorIn, createLead, route } from '../parts/leads';
import { createMeter } from '../parts/meter';
import { createSupply } from '../parts/supply';
import { MORPH_S, createWaterLoop } from '../parts/water-loop';
import { group, tag } from '../world';

const ID = 'source-emf';
/** The analogy table of «Цифри і факти» («a ↔ b; c ↔ d; …» after the colon) as rows. */
function analogyRows(): string[][] {
  const text = raw.steps.find((s) => s.id === ID)?.facts.items.find((f) => f.text.includes('↔'))?.text ?? '';
  return text
    .slice(text.indexOf(':') + 1)
    .replace(/\.$/, '')
    .split(';')
    .map((pair) => pair.split('↔').map((cell) => cell.trim()));
}

const SRC_SCALE = 1.25;

export const sourceEmfStep: StepFactory = (bench) => {
  const { ctx, ui, mats } = bench;
  const set = group(`set:${ID}`);
  bench.top.add(set);
  const SRC = new Vector3(-2.45, 0, 0.45); // centre of the source's terminal pair
  // the cell is the hero («ескалатор» inside): drawn larger, and the lab supply with it, so the terminals of
  // both stay 2.24 × SRC_SCALE apart and the same leads fit either
  const half = 1.12 * SRC_SCALE;
  const cell = createBatteryCutaway(ctx);
  cell.group.scale.setScalar(SRC_SCALE);
  cell.group.position.set(SRC.x, 0, SRC.z - 1.15 * SRC_SCALE);
  const supply = createSupply();
  supply.group.scale.setScalar(SRC_SCALE);
  supply.group.position.copy(SRC);
  const bulb = createBulb();
  bulb.group.position.set(2.2, 0, -1.7);
  const a1 = createMeter('A');
  a1.group.position.set(0.1, 0, -1.94);
  const a2 = createMeter('A');
  a2.group.position.set(0.9, 0, 1.86);
  set.add(cell.group, supply.group, bulb.group, a1.group, a2.group);

  // flow order: «+» → ammeter 1 → lamp → ammeter 2 → «−»
  const routes = [
    route(anchorIn(set, cell.plus), anchorIn(set, a1.a), [[SRC.x + half, -1.7]]),
    [anchorIn(set, a1.b), anchorIn(set, bulb.a)],
    route(anchorIn(set, bulb.b), anchorIn(set, a2.b), [
      [3.5, -1.7],
      [3.5, 2.1],
    ]),
    route(anchorIn(set, a2.a), anchorIn(set, cell.minus), [[SRC.x - half, 2.1]]),
  ];
  const leads = routes.map((r) => createLead(r, { bend: r.length > 2 ? 0.28 : 0 }));
  const water = createWaterLoop(ctx, mats, routes, SRC, bulb.group.position);
  set.add(...leads.map((l) => l.mesh), water.group);
  const topTag = tag('', 20, 'white', 'mono');
  cell.scaleTop.add(topTag);
  const bottomTag = tag('0 V', 20, 'white', 'mono');
  cell.scaleBottom.add(bottomTag);

  const electric = [cell.group, bulb.group, ...leads.map((l) => l.mesh)];
  ctx.stage.actor(supply.group);
  // the water loop animates its own morph (pipes fill along the leads, pump and wheel grow in place); the
  // leads fade instead of popping, so they dissolve inside the pipes rather than shrink toward the origin
  ctx.stage.actor(water.group, { appear: 'none' });
  for (const lead of leads) ctx.stage.actor(lead.mesh, { appear: 'fade' });
  /* ------------------------------------------------------------------------------------- state */
  let analogy = false;
  let lab = false;
  let shownEmf = Number.NaN;
  const emf = (): number => ui.value<number>('emf3');
  const model = (): ReturnType<typeof sourceEmfLamp> => sourceEmfLamp(emf());
  const hi = new Color();
  const lo = voltageRamp(0);
  const v = new Vector3();
  /** Battery ↔ supply ↔ water: show exactly what the two switches ask for. */
  const arrange = (): void => {
    ctx.stage.toggle(cell.group, !analogy && !lab);
    ctx.stage.toggle(bulb.group, !analogy);
    ctx.stage.toggle(supply.group, !analogy && lab);
    water.target = analogy ? 1 : 0;
    if (analogy) {
      ctx.stage.toggle(water.group, true);
      // the pipes grow over the wires first, then the wires go
      ctx.stage.scope.delay(MORPH_S * 0.8, () => {
        if (analogy) for (const l of leads) ctx.stage.toggle(l.mesh, false);
      });
    } else {
      for (const l of leads) ctx.stage.toggle(l.mesh, true);
      ctx.stage.scope.delay(MORPH_S, () => {
        if (!analogy) ctx.stage.toggle(water.group, false);
      });
    }
  };
  ui.onChange('water3', () =>
    ui.patch('emf3', { label: ui.value<boolean>('water3') ? `ℰ — ${DOC.pumpForce}` : OWN.emf }),
  );
  ctx.qa.probe('cell3', cell.inside);
  ctx.qa.expose('source-emf', () => ({
    emf: emf(),
    ...model(),
    analogy,
    lab,
    a1: a1.text,
    a2: a2.text,
    flow: water.flow,
  }));

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.1, 6.2, 9.4],
        target: [-0.35, 1.05, 0.1],
        fov: 30,
        orbit: { azimuth: 0.8, polar: 0.3 },
        fit: { center: [0.2, 0.9, 0], radius: 4.6 },
      },
    },
    stage: {
      show: [...electric, a1.group, a2.group],
      enter: () => {
        analogy = lab = false;
        water.snap(0);
        ui.set('water3', false);
        ui.patch('emf3', { label: OWN.emf });
      },
    },
    ui: {
      honesty: ['simplified', { text: DOC.analogyChip, visible: () => analogy }],
      controls: [
        {
          type: 'slider',
          id: 'emf3',
          label: OWN.emf,
          ...SOURCE_EMF.emfRange,
          value: SOURCE_EMF.emfRange.default,
          unit: 'V',
          digits: 1,
        },
        { type: 'toggle', id: 'water3', label: DOC.water, value: false },
        {
          type: 'stats',
          id: 'out3',
          items: [
            { label: OWN.currentI, get: () => fmtUnit(model().currentA * 1000, 'mA', { maxDigits: 1 }) },
            { label: OWN.powerP, get: () => fmtUnit(model().powerW, 'W', { maxDigits: 2 }) },
          ],
        },
        { type: 'table', id: 'map3', rows: analogyRows(), visible: () => analogy },
      ],
      callouts: [
        { anchor: supply.panel, text: DOC.labSupply, side: 'up', visible: () => !analogy && lab },
        { anchor: a1.dial, text: () => `${OWN.ammeter} 1`, side: 'up' },
        { anchor: a2.dial, text: () => `${OWN.ammeter} 2 — ${DOC.same}`, color: 'green', side: 'down' },
        { anchor: water.gauge, text: OWN.pressure, color: 'sky', side: 'up', visible: () => analogy },
        { anchor: water.wheel, text: OWN.wheel, color: 'amber', side: 'up', visible: () => analogy },
      ],
      hotspots: [
        { anchor: cell.inside, content: 'battery-cutaway', visible: () => !analogy && !lab },
        { anchor: () => a2.dial.getWorldPosition(v).setX(v.x + 0.75), content: 'second-ammeter' },
      ],
    },
    update(dt, t) {
      const on = bench.isCurrent(ID);
      const m = model();
      if (on && (ui.value<boolean>('water3') !== analogy || m.labSupply !== lab)) {
        analogy = ui.value<boolean>('water3');
        lab = m.labSupply;
        arrange();
      }
      const i = on ? m.currentA : 0;
      const k = i / 0.5; // 0…1 over the slider's range (0,5 A at 12 V)
      // potential ramp on the leads: «+» side high, after the lamp low
      voltageRamp(Math.min(emf() / 1.5, 1), hi);
      leads.forEach((lead, n) => {
        lead.tint(n < 2 ? hi : lo);
        lead.drive(3 * k, i > 0 ? 0.35 + m.brightness : 0);
      });
      bulb.brightness = on ? m.brightness : 0;
      bulb.update(t);
      cell.lift = 0.15 + 1.6 * k;
      cell.update();
      supply.set(emf(), i);
      supply.update(t);
      for (const meter of [a1, a2]) {
        meter.value = k;
        meter.text = fmtUnit(i * 1000, 'mA', { maxDigits: 1 });
        meter.color = 'green'; // both always agree: the lamp takes energy, not electrons
        meter.update(dt);
      }
      if (emf() !== shownEmf) topTag.text = `ℰ = ${fmtNumber((shownEmf = emf()), { maxDigits: 1 })} V`;
      water.flow = 2.6 * k;
      water.pressure = emf() / SOURCE_EMF.emfRange.max;
      water.update(dt);
      bench.live.water = analogy ? 0.3 + 0.7 * k : 0;
      bench.live.buzz = analogy ? 0 : 0.5 * k;
    },
  };
};
