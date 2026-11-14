/**
 * Step 6 `reactor` — «Корпус реактора». The containment opens (its front half fades), the camera stands on the
 * operating floor beside the vessel: polar crane above, the spent-fuel pool glowing behind. The vessel's front
 * quarter slides away with «Розріз»; cold water (blue) runs down the gap, up through the glowing core and out
 * hot (sky). «шари» highlight vessel / barrel / core / drives and dim the rest. «Знеструмити приводи»: the
 * magnets let go, 61 rod clusters fall in ≈ 3 s (counter), the core glow sinks to a faint residual glow.
 */
import { Vector3 } from 'three';
import { damp } from '@/engine/api';
import { HOTSPOTS } from '../hotspots';
import { CONTAINMENT_TUNE } from '../looks';
import { RPV } from '../layout';
import { ROD_TRAVEL, VESSEL } from '../parts/rpv';
import { hot, probe } from './hot';
import type { StepFactory } from './types';

const FALL_S = 3;
type Layer = 'all' | 'vessel' | 'barrel' | 'core' | 'drives';

export const reactor: StepFactory = ({ ctx, ui, L, plant, actors }) => {
  const it = plant.interior;
  const rpv = it.rpv;
  let dropT = -1; // < 0: rods held by the magnets; ≥ 0: seconds since the drives lost power
  let glow = 1;
  const cut = (): number => ui.value<number>('re.cut') / 100;
  const layer = (): Layer => ui.value<Layer>('re.layer');
  const fadeOf = (models: { mats: { list(): unknown[] } }[], f: number): void => {
    for (const m of models) for (const mat of m.mats.list() as { fade: number }[]) mat.fade = f;
  };
  const coreMat = rpv.core.material as unknown as { fade: number };
  const w = (x: number, y: number, z: number): Vector3 => it.world(new Vector3(x, y, z));
  const unpower = (): void => {
    if (dropT < 0) dropT = 0;
  };
  const restore = (): void => {
    dropT = -1;
  };
  ctx.qa.expose('reactor', () => ({ cut: cut(), layer: layer(), dropT, glow, rodsY: rpv.rods.position.y }));
  probe('reactor.core', () => w(0, RPV.y + VESSEL.coreY + 1.8, 0));
  return {
    id: 'reactor',
    stage: {
      camera: 'reactor',
      show: [actors.interior],
      envTune: CONTAINMENT_TUNE,
      enter: () => {
        it.restore();
        dropT = -1;
        glow = 1;
      },
    },
    ui: {
      reset: true,
      honesty: ['notToScale'],
      controls: [
        { type: 'slider', id: 're.cut', label: L.cut, min: 0, max: 100, step: 1, unit: '%', value: 100 },
        {
          type: 'segmented',
          id: 're.layer',
          label: L.layers,
          items: [
            { id: 'all', label: L.all },
            { id: 'vessel', label: L.layerVessel },
            { id: 'barrel', label: L.layerBarrel },
            { id: 'core', label: L.layerCore },
            { id: 'drives', label: L.layerDrives },
          ],
          value: 'all',
        },
        { type: 'button', id: 're.scram', label: L.unpower, icon: 'lightning', primary: true, visible: () => dropT < 0, onClick: unpower },
        { type: 'button', id: 're.restore', label: L.restore, icon: 'resetView', visible: () => dropT >= 0, onClick: restore },
      ],
      board: {
        title: L.vessel,
        size: 'sm',
        children: [
          { type: 'stats', id: 're.facts', columns: 2, items: [{ label: L.rpvPressure, get: () => L.rpvPressureValue }, { label: L.flowRate, get: () => L.flowRateValue }, { label: L.tIn, get: () => '≈ 290 °C' }, { label: L.tOut, get: () => '≈ 320 °C' }] },
          { type: 'readout', id: 're.rods', label: L.rodsIn, text: () => (dropT < 0 ? L.rodsReady : dropT < FALL_S ? `${dropT.toFixed(1).replace('.', ',')} s` : `${FALL_S} s ✓`) },
          { type: 'gauge', id: 're.p', kind: 'linear', label: L.fissionPower, min: 0, max: 100, unit: '%', digits: 0, zones: [{ from: 0, to: 100, color: 'orange' }], get: () => glow * 100 },
        ],
      },
      callouts: [
        { anchor: () => w(VESSEL.r + 0.2, RPV.y + 10.6, 0), text: L.vessel, side: 'left', priority: 0 },
        { anchor: () => w(0, RPV.y + VESSEL.coreY + 1.8, 0.9), text: L.core, side: 'right', priority: 1 },
        { anchor: () => w(-1.2, RPV.y + VESSEL.top + 4, 0), text: L.drives, side: 'left', priority: 2 },
        { anchor: () => w(-VESSEL.barrelR, RPV.y + 8.5, 0.4), text: L.barrel, side: 'left', priority: 3, visible: () => cut() > 0.4 },
        { anchor: () => it.world(it.loops.paths.cold[0]![it.loops.paths.cold[0]!.length - 1]!), text: L.coldWater, color: 'blue', side: 'down', priority: 4 },
        { anchor: () => it.world(it.loops.paths.hot[0]![0]!), text: L.hotWater, color: 'sky', side: 'up', priority: 5 },
        { anchor: () => w(-12, 35.5, 0), text: L.polarCrane, side: 'up', priority: 6 },
        { anchor: () => w(-17, 5, 0), text: L.pool, side: 'up', priority: 7 },
      ],
      hotspots: [
        hot(() => it.world(rpv.barrel.anchorLocal('specimen').add(new Vector3(0, RPV.y, 0))), HOTSPOTS.reactor.specimens, { visible: () => cut() > 0.5 }),
        hot(() => w(0.4, RPV.y + VESSEL.coreY + VESSEL.coreH + 0.4, 0.6), HOTSPOTS.reactor.incore, { visible: () => cut() > 0.5 }),
      ],
    },
    update(dt) {
      // cutaway: the front quarters slide out and fade
      const k = cut();
      rpv.quarter.group.position.set(0, 0, k * 3.2);
      rpv.barrelQuarter.group.position.set(0, 0, k * 2.2);
      fadeOf([rpv.quarter], 1 - k);
      fadeOf([rpv.barrelQuarter], 1 - Math.min(1, k * 1.3));
      rpv.quarter.group.visible = k < 0.99;
      rpv.barrelQuarter.group.visible = k < 0.99;
      // layers: the chosen one stays solid, the others dim
      const l = layer();
      const dim = (x: Layer): number => (l === 'all' || l === x ? 1 : 0.28);
      fadeOf([rpv.vessel], dim('vessel'));
      fadeOf([rpv.barrel], dim('barrel'));
      fadeOf([rpv.head], dim('drives'));
      coreMat.fade = dim('core');
      // the scram: rods fall under gravity in ≈ 3 s; fission power drops, the residual glow stays
      if (dropT >= 0) dropT += dt;
      const fall = dropT < 0 ? 0 : Math.min(1, (dropT / FALL_S) ** 2);
      rpv.rods.position.y = -ROD_TRAVEL * fall;
      glow = damp(glow, dropT < 0 ? 1 : 0.07, dropT < 0 ? 2 : 0.8, dt);
      rpv.setGlow(glow);
    },
  };
};
