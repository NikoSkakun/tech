/**
 * Step 1 `sunlight` — how much light reaches a square metre. The Sun slides along its arc («Висота Сонця»):
 * the ray's path through the atmosphere slab grows with the air mass, fewer photons reach the 1 m² frame on
 * the ground and the counter follows `atmosphere(h)` of the simulation. In front: the AM1.5 spectrum as bars —
 * tap one (the «фотонна піпетка») and a photon of that colour rises with its wavelength and energy.
 */
import { Vector3 } from 'three';
import { fmtNumber } from '@/content';
import { createPhotons } from '@/fx';
import { atmosphere, photon } from '@electricity/sim/lab-pv';
import type { StepFactory } from '../chapter';
import { doc } from '../content';
import { L, fill } from '../labels';
import { createSkyColumn } from '../parts/sky-column';
import { AM15_BANDS, createSpectrum } from '../parts/spectrum';
import { group } from '../world';

const ID = 'sunlight';
const SOLAR_CONSTANT = 1361; // W/m² (document, step 1)

export const sunlight: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const sky = createSkyColumn(ctx);
  sky.group.position.set(0.5, 0, -0.9);
  const spectrum = createSpectrum();
  spectrum.group.position.set(0.1, 0, 3.0);
  spectrum.group.scale.setScalar(0.8);
  // the pipette's photon: one packet that rises from the chosen bar and hovers
  const pick = createPhotons({ count: 1, wavelength: 550, length: 0.9, amplitude: 0.13, width: 0.055, intensity: 1.7 });
  spectrum.group.add(pick);
  const set = group('set:sunlight', 0, 0, 0, [sky.group, spectrum.group]);
  lab.stageRoot.add(set);

  let selected = 2;
  let pickedAt = -10;
  let now = 0;
  const air = () => atmosphere(ui.value<number>('sun1'));
  const pickAnchor = new Vector3();
  AM15_BANDS.forEach((b, i) => {
    ctx.input.register(spectrum.bars[i]!, {
      tooltip: fill(L.pipetteTip, { a: b.from, b: b.to }),
      cursor: 'pointer',
      enabled: () => lab.isCurrent(ID),
      click: () => {
        selected = i;
        pickedAt = now;
        pick.setWavelength(b.nm);
      },
    });
    ctx.qa.probe(`bar1-${i}`, spectrum.bars[i]!);
  });
  ctx.qa.expose('sun1', () => ({ ...air(), selected, nm: AM15_BANDS[selected]!.nm }));
  ctx.qa.probe('sun1', sky.lamp.ball);

  return {
    id: ID,
    shots: {
      [ID]: { position: [1.4, 4.6, 13.2], target: [0.4, 3.3, 0.4], frameAspect: 0.86, fov: 34, fit: { center: [0.4, 3.3, 0.4], radius: 4.6 }, orbit: { azimuth: 0.5, polar: 0.22 } },
    },
    stage: {
      show: [set],
      enter() {
        pickedAt = -10;
      },
    },
    ui: {
      hint: L.hint1,
      honesty: ['notToScale', { kind: 'illustrative', text: L.spectrumNote }],
      board: {
        title: L.board1,
        size: 'sm',
        children: [
          {
            type: 'stats',
            id: 'air1',
            columns: 1,
            items: [
              { label: L.airMass, get: () => air().airMass, digits: 2, color: () => 'sky' },
              { label: L.beamNormal, get: () => air().dniWm2, unit: 'W/m²', digits: 0, color: () => 'yellow' },
              { label: L.beamHorizontal, get: () => air().beamHorizontalWm2, unit: 'W/m²', digits: 0, color: () => 'cyan' },
            ],
          },
          { type: 'note', id: 'air1-note', icon: 'info', text: L.beamNote },
        ],
      },
      controls: [{ type: 'slider', id: 'sun1', label: doc(ID, 0), min: 5, max: 90, step: 0.1, digits: 1, value: 41.8, unit: '°', snaps: [41.8, 90] }],
      callouts: [
        { anchor: sky.anchors.slab, text: L.atmosphere, side: 'left', color: 'sky' },
        { anchor: spectrum.anchors.uv, text: L.zoneUv, side: 'up', color: 'violet' },
        { anchor: spectrum.anchors.visible, text: L.zoneVisible, side: 'up' },
        { anchor: spectrum.anchors.ir, text: L.zoneIr, side: 'up', color: 'orange' },
        {
          anchor: () => spectrum.group.localToWorld(pickAnchor.set(...spectrum.top(selected)).setY(spectrum.top(selected)[1] + 1.1)),
          text: () => fill(L.photonChip, { nm: fmtNumber(AM15_BANDS[selected]!.nm), ev: fmtNumber(Math.round(photon(AM15_BANDS[selected]!.nm).energyEv * 100) / 100) }),
          side: 'left',
          color: 'yellow',
        },
      ],
      hotspots: [
        { anchor: () => sky.group.localToWorld(pickAnchor.set(2.3, 3.2, 1.2)), content: 'atmosphere' },
        { anchor: () => sky.group.localToWorld(pickAnchor.set(0.75, 0.05, 0.75)), content: '1-m-frame' },
      ],
    },
    update(_dt, t) {
      if (!lab.isCurrent(ID)) return;
      now = t;
      const a = air();
      sky.set(a.elevationDeg, a.dniWm2 / SOLAR_CONSTANT, t);
      sky.counter.text = `${fmtNumber(Math.round(a.beamHorizontalWm2))} W/m²`;
      sky.topCounter.text = L.solarConstant;
      sky.pathLabel.text = fill(L.airPath, { am: fmtNumber(Math.round(a.airMass * 100) / 100) });
      spectrum.update(selected, t);
      // the picked photon rises out of its bar (0.6 s) and then hovers above it
      const [x, y, z] = spectrum.top(selected);
      const rise = Math.min(1, (t - pickedAt) / 0.6);
      const lift = 0.2 + 0.45 * (1 - (1 - rise) ** 3) + Math.sin(t * 1.7) * 0.04;
      pick.setPhoton(0, [x, y + lift, z + 0.1], [0, 1, 0], 0, 1);
      pick.commit();
    },
  };
};
