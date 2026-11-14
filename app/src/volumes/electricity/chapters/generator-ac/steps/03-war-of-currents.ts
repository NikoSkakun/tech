/**
 * Step 3 `war-of-currents` — the 1880s diorama: Edison's DC street (110 V through thick copper) and
 * Westinghouse's AC street (2 kV line, transformers at both ends). «Відстань до будинку» slides both
 * neighbourhoods away: DC lamps dim (U = U_s − I·R_line), AC lamps stay bright (model Г2 `warOfCurrents`).
 * The timeline above has seven milestones: a tap lights the matching object and shows its card in the dock.
 * In front: the «полиця постійного струму» — where DC lives today.
 */
import { Mesh, SphereGeometry, Vector3 } from 'three';
import { fmtPercent, fmtUnit } from '@/content';
import { applyHeat, createPulseRings } from '@/fx';
import { WAR, warOfCurrents } from '@electricity/sim/generator-ac';
import { K, type KToonMaterial } from '@/style';
import type { StepFactory } from '../chapter';
import { doc } from '../labels';
import { OWN } from '../labels-own';
import { createDcShelf } from '../parts/dc-shelf';
import { LINE_X, STREET_X, Z_FAR, Z_NEAR, createWarDiorama, streetZ } from '../parts/war-diorama';
import { group, narrow, pickBox, roomy, tag } from '../world';

const ID = 'war-of-currents';
const SHELF_Z = 3.3;
const YEARS = [1882, 1886, 1888, 1891, 1893, 1896, 2007] as const;
const MILESTONE = [OWN.m1882, OWN.m1886, OWN.m1888, OWN.m1891, OWN.m1893, OWN.m1896, OWN.m2007] as const;

export const warOfCurrentsStep: StepFactory = (hall) => {
  const { ctx, ui } = hall;
  const set = group(ID, 0, 0.16, 0);
  hall.stageRoot.add(set);
  const dio = createWarDiorama();
  const shelf = createDcShelf();
  shelf.group.position.set(0, 0, SHELF_Z);
  set.add(dio.group, shelf.group);
  // the year signs ride on the stations (they slide up the streets with the distance; placed in `update`)
  const signDc = tag('1882', 18, 'ink', 'mono');
  const signAc = tag('1886', 18, 'ink', 'mono');
  set.add(signDc, signAc);
  const streetTags = [tag('⎓ 110 V', 20, 'coral'), tag('~ 2 kV', 20, 'yellow')];
  streetTags[0]!.position.set(-STREET_X + 1.25, 0.75, Z_NEAR - 1.1);
  streetTags[1]!.position.set(LINE_X, 1.6, Z_NEAR - 0.95);
  set.add(...streetTags);
  // distance marks along the divider
  for (const km of [0.5, 2, 10]) {
    const t = tag(fmtUnit(km, 'km'), 16, 'mist', 'mono');
    t.position.set(0, 0.42, streetZ(km));
    set.add(t);
  }

  // ------------------------------------------------------------------ timeline of milestones (tap a bead)
  // the history rail stands just behind the far end of the streets (over the stations, not in the sky)
  const timeline = group('timeline', -0.3, 2.45, -3.3);
  timeline.scale.setScalar(0.85);
  const rail = new Mesh(new SphereGeometry(1, 8, 4), K.glow({ color: 'teal', intensity: 0.9, keepHue: true, whiten: 0 }));
  rail.scale.set(3.6, 0.03, 0.03);
  timeline.add(rail);
  const beadMat = K.toon({ color: 'teal', emissive: 'teal', emissiveIntensity: 0.4 });
  const beadOn = K.toon({ color: 'yellow', emissive: 'yellow', emissiveIntensity: 0.9 });
  const yearLabels: ReturnType<typeof tag>[] = [];
  const beads = YEARS.map((year, i) => {
    const x = -3.4 + (i * 6.8) / (YEARS.length - 1);
    const bead = new Mesh(new SphereGeometry(0.17, 24, 16), beadMat);
    bead.position.x = x;
    const label = tag(String(year), 19, 'white', 'mono');
    yearLabels.push(label);
    label.position.set(x, -0.42, 0);
    const proxy = pickBox(0.75, 0.95, 0.4, x, -0.2, 0);
    timeline.add(bead, label, proxy);
    ctx.input.register(proxy, {
      tooltip: MILESTONE[i]!,
      cursor: 'pointer',
      enabled: () => hall.isCurrent(ID),
      click: () => ui.set('year3', String(year), { notify: true }),
    });
    return bead;
  });
  set.add(timeline);
  beads.forEach((b, i) => ctx.qa.probe(`bead-${YEARS[i]}`, b));
  // where each milestone points in the diorama (local to `set`)
  const st = dio.dc.station.group.position;
  const at = dio.ac.station.group.position;
  const targets: (() => Vector3)[] = [
    () => new Vector3(st.x, 1.3, st.z),
    () => new Vector3(LINE_X, 1.2, at.z + 0.75),
    () => new Vector3(at.x, 1.3, at.z),
    () => new Vector3(LINE_X, 1.35, (Z_NEAR + Z_FAR) / 2),
    () => dio.ac.city.group.position.clone().setY(2.0),
    () => new Vector3(LINE_X, 1.35, Z_FAR - 0.6),
    () => new Vector3(0, 0.8, SHELF_Z),
  ];
  const ping = createPulseRings({ size: 1.6, color: 'yellow', amount: 2, billboard: true });
  ping.visible = false;
  set.add(ping);
  const heat = dio.dc.wireMat as unknown as KToonMaterial;
  const mid = new Vector3();

  const model = () => warOfCurrents(ui.value<number>('d3'));
  const selected = (): number => YEARS.findIndex((y) => String(y) === ui.value<string>('year3'));
  const select = (i: number): void => {
    beads.forEach((b, k) => (b.material = k === i ? beadOn : beadMat));
    if (i < 0) {
      ping.visible = false;
      return;
    }
    ping.visible = true;
    ping.position.copy(targets[i]!());
    hall.sound.click(1.1 + i * 0.05);
  };

  return {
    id: ID,
    shots: {
      [ID]: { position: [2.4, 6.6, 9.6], target: [0, 1.1, -0.2], fov: 33, fit: { center: [0, 1.1, -0.2], radius: 5.2 } },
    },
    stage: {
      show: [set],
      enter: () => select(selected()),
    },
    ui: {
      honesty: ['simplified', 'notToScale'],
      controls: [
        { type: 'slider', id: 'd3', label: doc(ID, 0), min: WAR.distanceRangeKm.min, max: WAR.distanceRangeKm.max, step: WAR.distanceRangeKm.step, value: WAR.distanceRangeKm.default, unit: 'km', digits: 1 },
        {
          type: 'stats',
          id: 'read3',
          columns: 2,
          items: [
            { label: OWN.lossDc, get: () => fmtPercent(model().dc.lossFraction, 1), color: () => (model().dc.lossFraction > 0.2 ? 'red' : model().dc.lossFraction > 0.08 ? 'amber' : 'green') },
            { label: OWN.lossAc, get: () => fmtPercent(model().ac.lossFraction, 2), color: () => 'green' },
            { label: OWN.lampDc, get: () => fmtUnit(model().dc.lampV, 'V', { digits: 1 }) },
            { label: OWN.lampAc, get: () => fmtUnit(model().ac.lampV, 'V', { digits: 1 }) },
          ],
        },
        {
          type: 'segmented',
          id: 'year3',
          label: OWN.milestones,
          items: [{ id: 'none', label: '—' }, ...YEARS.map((y) => ({ id: String(y), label: String(y) }))],
          value: 'none',
          onChange: () => select(selected()),
        },
        { type: 'note', id: 'card3', icon: 'clock', text: () => MILESTONE[selected()] ?? '', visible: () => selected() >= 0 },
      ],
      callouts: [
        { anchor: () => dio.dc.station.group.localToWorld(mid.set(0, 1.45, 0)), text: OWN.edison, side: 'up', color: 'coral', visible: () => !narrow(hall) },
        { anchor: () => dio.ac.station.group.localToWorld(mid.set(0, 1.45, 0)), text: OWN.westinghouse, side: 'up', color: 'yellow', visible: () => !narrow(hall) },
        { anchor: () => set.localToWorld(mid.set(0, 0.7, SHELF_Z)), text: OWN.dcShelf, side: 'down', visible: () => roomy(hall) },
      ],
      hotspots: [
        { anchor: () => dio.ac.poleTransformer.localToWorld(mid.set(-0.5, 1.0, 0.75)), content: 'pole-transformer' },
        { anchor: () => dio.dc.station.group.localToWorld(mid.copy(dio.dc.station.anchorLocal('dynamo')).add(new Vector3(0.55, -0.2, 0.4))), content: 'edison-dynamo' },
        { anchor: () => shelf.group.localToWorld(mid.copy(shelf.anchorLocal('hvdc'))), content: 'hvdc-cable' },
      ],
    },
    probe: () => {
      const m = model();
      return {
        d: ui.value<number>('d3'),
        dcLoss: m.dc.lossFraction,
        acLoss: m.ac.lossFraction,
        dcV: m.dc.lampV,
        acV: m.ac.lampV,
        dcGlow: dio.dc.lampGlow.intensity,
        acGlow: dio.ac.lampGlow.intensity,
        stationZ: dio.dc.station.group.position.z,
        milestone: selected() >= 0 ? YEARS[selected()] : null,
        ping: ping.visible,
      };
    },
    update(_dt, t) {
      if (!hall.isCurrent(ID)) return;
      const m = model();
      dio.setDistance(ui.value<number>('d3'));
      signDc.position.copy(dio.dc.station.anchorLocal('sign')).add(dio.dc.station.group.position);
      signAc.position.copy(dio.ac.station.anchorLocal('sign')).add(dio.ac.station.group.position);
      if (selected() >= 0) ping.position.copy(targets[selected()]!());
      dio.dc.lampGlow.intensity = 0.25 + 1.6 * Math.min(1, m.dc.brightness);
      dio.ac.lampGlow.intensity = 0.25 + 1.6 * Math.min(1, m.ac.brightness);
      applyHeat(heat, Math.min(1, m.dc.lossFraction * 2.2));
      for (const l of yearLabels) l.visible = !narrow(hall); // phone portrait: the dock lists the years
      beads.forEach((b, k) => (b.position.y = k === selected() ? 0.08 * Math.sin(t * 4) : 0));
      hall.sound.hum = 0.06;
    },
  };
};
