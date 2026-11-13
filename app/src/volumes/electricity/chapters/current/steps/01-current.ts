/**
 * Step 1 `current` — what electric current is. A battery, a loop of wire and a small lamp; a `teal`
 * cross-section window counts the electrons passing through it (N = I·t/e); `yellow` pulses show the
 * conventional direction, the lens shows `cyan` electrons drifting the other way. Model: `electronsPerSecond`.
 */
import { Mesh, TorusGeometry, CircleGeometry, Vector3 } from 'three';
import { fmtSci } from '@/content';
import { createVectorArrow } from '@/fx';
import { K, SEMANTIC } from '@/style';
import { CURRENT_STEP, electronsPerSecond } from '@electricity/sim/current';
import type { StepFactory } from '../chapter';
import { DOC } from '../labels';
import { OWN } from '../labels-own';
import { createBattery } from '../parts/battery';
import { createBulb } from '../parts/bulb';
import { LEAD_Y, anchorIn, createLead, route } from '../parts/leads';
import { createLens } from '../parts/lens';
import { createSupply } from '../parts/supply';
import { nearestOnLeads } from '../parts/lead-pick';
import { group, tag } from '../world';

const ID = 'current';
const UP = new Vector3(0, 1, 0);

export const currentStep: StepFactory = (bench) => {
  const { ctx, ui, mats } = bench;
  const set = group(`set:${ID}`);
  bench.top.add(set);
  const battery = createBattery();
  battery.group.position.set(0, 0, 1.75);
  const supply = createSupply();
  supply.group.position.copy(battery.group.position);
  const bulb = createBulb();
  bulb.group.position.set(0, 0, -1.75);
  set.add(battery.group, supply.group, bulb.group);
  ctx.stage.actor(supply.group); // hidden until the current exceeds 1 A

  // «+» → right side → lamp → left side → «−»: the conventional current runs along both leads' parameter
  const out = createLead(
    route(anchorIn(set, battery.plus), anchorIn(set, bulb.b), [
      [2.8, 1.75],
      [2.8, -1.75],
    ]),
  );
  const back = createLead(
    route(anchorIn(set, bulb.a), anchorIn(set, battery.minus), [
      [-2.8, -1.75],
      [-2.8, 1.75],
    ]),
  );
  const leads = [out, back];
  set.add(out.mesh, back.mesh);

  // cross-section window on the right-hand run of the wire, with the live counter above it
  const windowAt = new Vector3(2.8, LEAD_Y, -0.85);
  const ringMat = K.glow({ color: 'teal', intensity: 1.3, falloff: 0, whiten: 0, keepHue: true });
  const ring = new Mesh(new TorusGeometry(0.3, 0.035, 10, 48), ringMat);
  const pane = new Mesh(
    new CircleGeometry(0.3, 40),
    K.glass({ color: 'teal', opacity: 0.22, edgeOpacity: 0.5 }),
  );
  const win = group('window', windowAt.x, windowAt.y, windowAt.z, [ring, pane]);
  const counter = tag('', 23, 'white', 'mono');
  counter.position.set(0, 0.7, 0);
  win.add(counter);
  set.add(win);

  // the two directions: conventional current (yellow) and electrons (cyan), side by side over the wire
  const conv = createVectorArrow({
    color: SEMANTIC.current,
    radius: 0.04,
    headLength: 0.3,
    headRadius: 0.12,
  });
  conv.set(new Vector3(2.25, 0.22, 1.0), new Vector3(0, 0, -1.3));
  const elec = createVectorArrow({
    color: SEMANTIC.electron,
    radius: 0.04,
    headLength: 0.3,
    headRadius: 0.12,
  });
  elec.set(new Vector3(1.75, 0.22, -0.3), new Vector3(0, 0, 1.3));
  set.add(conv, elec);

  const lens = createLens(ctx, mats);
  set.add(lens.group);
  const focus = { lead: 1, u: 0.5 };
  const placeLens = (): void => {
    const lead = leads[focus.lead]!;
    lead.curve.getPointAt(focus.u, lens.group.position);
    lead.curve.getTangentAt(focus.u, lens.dir);
  };
  placeLens();
  const grab = new Vector3();
  const hit = new Vector3();
  ctx.input.register(lens.head, {
    tooltip: OWN.lens,
    cursor: 'grab',
    dragStart: (e) => {
      const p = e.planePoint(UP, bench.top.getWorldPosition(hit));
      if (p) grab.copy(set.worldToLocal(p.clone())).sub(lens.group.position);
    },
    drag: (e) => {
      const p = e.planePoint(UP, bench.top.getWorldPosition(hit));
      if (!p) return;
      const near = nearestOnLeads(leads, set.worldToLocal(p.clone()).sub(grab));
      focus.lead = near.lead;
      focus.u = near.u;
      placeLens();
    },
    enabled: () => bench.isCurrent(ID),
  });

  /* ------------------------------------------------------------------------------------- state */
  let passed = 0; // electrons through the window since the step was entered
  let tick = 0;
  let lab = false;
  const amps = (): number => ui.value<number>('i1');
  const v = new Vector3();
  ctx.qa.probe('lens1', lens.head);
  ctx.qa.expose('current', () => ({
    amps: amps(),
    perSecond: electronsPerSecond(amps()),
    passed,
    lab,
    lens: [focus.lead, focus.u],
    arrows: elec.visible,
    brightness: bulb.brightness,
  }));

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.5, 6.5, 8.3],
        target: [0.3, 0.55, -0.1],
        fov: 30,
        orbit: { azimuth: 0.85, polar: 0.3 },
        fit: { center: [0.3, 0.6, 0], radius: 4.4 },
      },
    },
    stage: {
      show: [battery.group, bulb.group, out.mesh, back.mesh, win, conv, elec, lens.group],
      enter: () => {
        passed = 0;
        lab = false;
      },
    },
    ui: {
      hint: OWN.hintLens,
      honesty: [{ text: DOC.fractionChip }],
      controls: [
        {
          type: 'slider',
          id: 'i1',
          label: DOC.currentSlider,
          ...CURRENT_STEP.rangeA,
          value: CURRENT_STEP.rangeA.default,
          unit: 'A',
          digits: 1,
        },
        { type: 'toggle', id: 'arrows1', label: DOC.showElectrons, value: true },
        {
          type: 'readout',
          id: 'rate1',
          label: OWN.perSecond,
          text: () => `${fmtSci(electronsPerSecond(amps()), 2)} e⁻/s`,
        },
        { type: 'readout', id: 'passed1', label: OWN.passed, text: () => fmtSci(passed, 2) },
      ],
      callouts: [
        {
          anchor: () => battery.group.getWorldPosition(v).set(v.x, v.y + 0.1, v.z + 0.55),
          text: () => (lab ? OWN.supply : OWN.battery),
          side: 'down',
        },
        { anchor: bulb.glass, text: OWN.lamp, side: 'up' },
        { anchor: conv.tip, text: OWN.conventional, color: SEMANTIC.current, side: 'left' },
        {
          anchor: elec.tip,
          text: OWN.electrons,
          color: SEMANTIC.electron,
          side: 'left',
          visible: () => ui.value<boolean>('arrows1'),
        },
      ],
      hotspots: [
        { anchor: () => win.getWorldPosition(v).setY(v.y - 0.02), content: 'cross-section-window' },
        { anchor: battery.plus, content: 'battery-terminals' },
      ],
    },
    update(dt, t) {
      const i = bench.isCurrent(ID) ? amps() : 0;
      // above 1 A the AA cell gives way to the laboratory supply (document: «батарейка автоматично стає…»)
      const wantLab = i > CURRENT_STEP.labSupplyAboveA;
      if (wantLab !== lab && bench.isCurrent(ID)) {
        lab = wantLab;
        ctx.stage.toggle(battery.group, !lab);
        ctx.stage.toggle(supply.group, lab);
      }
      supply.set(Number.NaN, i);
      supply.update(t);
      // pulses and drift ∝ I; brightness is a display mapping for a 0,5 A torch bulb (illustrative)
      for (const lead of leads) lead.drive(0.6 * i, i > 0 ? Math.min(0.35 + 0.2 * i, 1.6) : 0);
      bulb.brightness = Math.sqrt(Math.min(i / 0.5, 1));
      bulb.update(t);
      lens.drift = -0.09 * i; // electrons run against the conventional direction
      lens.update(dt, t, ctx.camera.camera);
      elec.visible = ui.value<boolean>('arrows1');
      ringMat.intensity = 1.2 + 0.3 * Math.sin(t * 2.2);
      passed += electronsPerSecond(i) * dt;
      if (tick++ % 6 === 0) counter.text = `N = ${fmtSci(passed, 2)}`;
      bench.live.buzz = Math.min(i / 10, 1) * 0.6;
    },
  };
};
