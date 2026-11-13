/**
 * Step 2 `pv-effect` — inside the cell. Three lanes of photons (colour = wavelength) fall into the lattice in
 * a loop; each cycle is a pure function of the phase: fly in → absorbed at a depth that grows with the
 * wavelength (or pass through if E < E_g) → electron and hole are pulled apart by the built-in field (or wander
 * and recombine without it) → the electron leaves through the finger and the lamp glows. The band diagram plays
 * the same photon as an energy staircase; `photon()` of the simulation gives every number.
 */
import { fmtNumber, fmtPercent } from '@/content';
import { createHalo, createOrbs, createPhotons } from '@/fx';
import { photon } from '@electricity/sim/lab-pv';
import type { StepFactory } from '../chapter';
import { playTransition } from '../transitions';
import { doc, docPair } from '../content';
import { L } from '../labels';
import { createBandDiagram } from '../parts/band-diagram';
import { JUNCTION, createJunction } from '../parts/junction';
import { LIGHT_LOSSES, createLossPie } from '../parts/loss-pie';
import { sound } from '../sound';
import { group } from '../world';

const ID = 'pv-effect';
const LANES = [-1.5, 0.1, 1.55];
const CYCLE = 3.6; // s per photon in a lane (slowed by ≈ 10⁹ — the chip says so)

export const pvEffect: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const junction = createJunction();
  junction.group.position.set(-1.35, 3.3, 0);
  const bands = createBandDiagram();
  bands.group.position.set(3.25, 3.0, 0.2);
  bands.group.rotation.y = -0.3;
  const pie = createLossPie(0.95);
  pie.group.position.set(-3.6, -0.75, 1.2);
  const photons = createPhotons({ count: LANES.length, wavelength: 550, length: 1.5, amplitude: 0.16, width: 0.06, intensity: 1.6 });
  const electrons = createOrbs({ kind: 'electron', count: LANES.length, radius: 0.17 });
  const holes = createOrbs({ kind: 'hole', count: LANES.length, radius: 0.19 });
  const flashes = LANES.map(() => createHalo({ color: 'orange', size: 1.4, intensity: 0 }));
  junction.group.add(photons, electrons, holes, ...flashes);
  const set = group('set:pv-effect', 0, 0, 0, [junction.group, bands.group]);
  lab.stageRoot.add(set, pie.group);
  const pieActor = ctx.stage.actor(pie.group);

  const lambda = (): number => ui.value<number>('lambda2');
  const fieldOn = (): boolean => ui.value<string>('field2') === 'on';
  const ph = () => photon(lambda());
  let colourOf = NaN;
  let pieShown = false;
  let field = 1;
  const [noField, withField] = docPair(ID, 4);
  ctx.qa.expose('pv2', () => ({ lambda: lambda(), ...ph(), field: fieldOn(), pie: pieShown }));
  ctx.qa.probe('junction2', junction.anchors.depletion);

  return {
    id: ID,
    noPodium: true,
    shots: {
      [ID]: { position: [0.6, 3.2, 14.6], target: [0.6, 2.7, 0], frameAspect: 1.12, fov: 32, fit: { center: [0.6, 2.7, 0], radius: 4.9 }, orbit: { azimuth: 0.45, polar: 0.25 } },
      // transition from step 1: the camera dives after the light into the 1 m² frame on the floor
      'pv-effect-dive': { position: [0.9, 1.6, 0.4], target: [1.0, 0.1, -1.0], fov: 32, fit: { center: [1.0, 0.1, -1.0], radius: 0.8 } },
    },
    stage: {
      show: [set],
      envTune: { floor: 0, bokeh: 1.2, motes: 1.3 },
      post: { bloomIntensity: 1.15 },
      enter(info) {
        playTransition(lab, info, ID, { from: 'sunlight', kind: 'through', via: 'pv-effect-dive', first: 0.9, last: 1.9 });
        pieShown = false;
      },
    },
    ui: {
      hint: L.hint2,
      honesty: [{ slowed: 1e9 }, 'simplified', 'notToScale'],
      board: {
        title: L.board2,
        size: 'sm',
        children: [
          {
            type: 'stats',
            id: 'photon2',
            columns: 2,
            items: [
              { label: L.photonEnergy, get: () => ph().energyEv, unit: 'eV', digits: 2, color: () => 'yellow' },
              { label: L.pairBorn, get: () => (ph().absorbed ? L.yes : L.no), color: () => (ph().absorbed ? 'green' : 'coral') },
              { label: doc(ID, 3), get: () => fmtPercent(ph().usefulFraction, 0), color: () => 'green' },
              { label: L.heatShare, get: () => ph().heatEv, unit: 'eV', digits: 2, color: () => 'orange' },
            ],
          },
          { type: 'note', id: 'nofield2', icon: 'warning', color: 'amber', text: L.recombine, visible: () => !fieldOn() },
          { type: 'table', id: 'losses2', head: [L.lossTitle, '%'], rows: LIGHT_LOSSES.map((x) => [L[x.label], `≈ ${fmtNumber(x.share)}`]), visible: () => pieShown },
          { type: 'note', id: 'losses2-note', icon: 'info', text: doc(ID, 7), visible: () => pieShown },
        ],
      },
      controls: [
        { type: 'slider', id: 'lambda2', label: doc(ID, 0), min: 300, max: 1300, step: 10, value: 550, unit: 'nm', marks: [{ value: 1107, label: 'E_g' }] },
        { type: 'segmented', id: 'field2', items: [{ id: 'off', label: noField }, { id: 'on', label: withField }], value: 'on' },
        { type: 'button', id: 'pie2', label: doc(ID, 5), icon: 'chart', onClick: () => ctx.stage.toggle(pieActor, (pieShown = !pieShown)) },
      ],
      callouts: [
        { anchor: junction.anchors.n, text: L.nLayer, side: 'left', color: 'teal' },
        { anchor: junction.anchors.p, text: L.pLayer, side: 'left', color: 'pink' },
        { anchor: junction.anchors.depletion, text: L.depletion, side: 'right', color: 'amber', visible: fieldOn },
        { anchor: junction.anchors.lamp, text: () => (fieldOn() && ph().absorbed ? L.lampOn : L.lampOff), side: 'right', color: 'yellow' },
        { anchor: bands.anchors.valence, text: L.bandGap, side: 'down' },
        ...LIGHT_LOSSES.map((x, i) => ({ anchor: pie.anchors[i]!, text: `${L[x.label]} ≈ ${fmtNumber(x.share)} %`, color: x.color, visible: () => pieShown && i < 2 })),
      ],
      hotspots: [
        { anchor: () => junction.group.localToWorld(junction.anchors.depletion.position.clone().setX(-0.4)), content: 'built-in-field', visible: fieldOn },
        { anchor: junction.anchors.p, content: 'hole' },
      ],
    },
    update(dt, t) {
      if (!lab.isCurrent(ID)) return;
      const p = ph();
      if (lambda() !== colourOf) {
        colourOf = lambda();
        photons.setWavelength(colourOf);
        // "too little energy" photons are drawn as pale ghosts
        photons.intensity = p.absorbed ? 1.6 : 0.7;
      }
      field += ((fieldOn() ? 1 : 0) - field) * Math.min(1, dt * 5);
      // absorption depth: blue near the surface, infrared deep in the base (illustrative)
      const yAbs = JUNCTION.top - 0.5 - ((Math.min(1107, lambda()) - 300) / 807) * 3.1;
      LANES.forEach((x, k) => {
        const u = (t / CYCLE + k / LANES.length) % 1;
        const fly = Math.min(1, u / 0.28);
        const yEnd = p.absorbed ? yAbs : JUNCTION.bottom - 2.4;
        const yPhoton = JUNCTION.top + 2.6 + (yEnd - JUNCTION.top - 2.6) * (p.absorbed ? fly : Math.min(1, u / 0.6));
        const shown = p.absorbed ? u < 0.28 : u < 0.6;
        photons.setPhoton(k, [x, yPhoton, 0.45], [0, -1, 0], k * 0.31, shown ? 1 : 0);
        const born = p.absorbed && u >= 0.28;
        const v = born ? Math.min(1, (u - 0.28) / 0.5) : 0;
        const ease = v * v * (3 - 2 * v);
        let ye: number;
        let yh: number;
        let xe = x;
        let xh = x;
        let size = born ? Math.min(1, (u - 0.28) / 0.05) : 0;
        if (field > 0.5) {
          // the field sweeps the electron up to the n-side finger and the hole down to the rear contact
          ye = yAbs + (JUNCTION.top - 0.05 - yAbs) * ease;
          yh = yAbs + (JUNCTION.bottom + 0.1 - yAbs) * ease;
          if (u > 0.9) size = Math.max(0, (1 - u) / 0.1);
        } else {
          // no field: they wander side by side and fall back into each other
          const w = Math.sin(v * Math.PI);
          xe = x + w * 0.5 * Math.cos(t * 2 + k);
          xh = x - w * 0.5 * Math.cos(t * 2 + k);
          ye = yAbs + w * 0.35 * Math.sin(t * 3 + k);
          yh = yAbs - w * 0.35 * Math.sin(t * 3 + k);
          if (v >= 1) size = 0;
        }
        electrons.setPosition(k, xe, ye, 0.45, size);
        holes.setPosition(k, xh, yh, 0.45, size);
        const f = flashes[k]!;
        const heatBump = born && u < 0.42 ? Math.sin(((u - 0.28) / 0.14) * Math.PI) : 0;
        const recombine = field <= 0.5 && born && v > 0.9 && v < 1 ? 1 : 0;
        f.position.set(x, yAbs, 0.5);
        f.intensity = 1.6 * heatBump * Math.min(1, p.heatEv / 1.2) + 0.8 * recombine;
      });
      photons.commit();
      electrons.commit();
      holes.commit();
      const current = p.absorbed ? field : 0;
      junction.set(field, current > 0.5 ? 0.75 + 0.25 * Math.sin(t * 5) : 0, t);
      bands.show(p, (t / CYCLE) % 1);
      pie.update(t);
      sound.power = current * 0.5;
    },
  };
};
