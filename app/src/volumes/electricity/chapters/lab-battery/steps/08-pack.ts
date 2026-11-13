/**
 * Step 8 `pack` — the builder's bench: choose a cell, S and P; the tray fills with cells and busbars, the
 * board shows the pack's numbers and the hybrid inverter «ЛІ-6» answers whether the voltage window fits.
 * Model: `buildPack` (§M4) with the three-state compatibility verdict.
 */
import { Mesh, TorusGeometry, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { audio } from '@/audio';
import { fmtNumber, fmtUnit } from '@/content';
import { createWire } from '@/fx';
import { batteryCabinet, hybridInverter } from '@/kit';
import { CELLS, buildPack, type CellId, type PackResult } from '@electricity/sim/lab-battery';
import { K } from '@/style';
import { Chip, STATUS, row } from '@/ui3d';
import { factTable, notices } from '../hud-bits';
import type { StepFactory } from '../lab';
import { L } from '../labels';
import { createPackGrid } from '../parts';
import { group, mesh } from '../world';

const ID = 'pack';
const CELL_TABS: readonly { id: CellId; label: string }[] = [
  { id: '18650-NMC', label: L.cell18650 },
  { id: '21700-NMC', label: L.cell21700 },
  { id: 'LFP-100', label: L.cellLfp100 },
  { id: 'LFP-314', label: L.cellLfp314 },
];
const PRESETS: readonly { id: string; label: string; cell: CellId; s: number; p: number }[] = [
  { id: 'powerbank', label: L.presetPowerbank, cell: '21700-NMC', s: 1, p: 4 },
  { id: 'ebike', label: L.presetEbike, cell: '18650-NMC', s: 10, p: 4 },
  { id: 'home5', label: L.presetHome5, cell: 'LFP-100', s: 16, p: 1 },
  { id: 'home16', label: L.presetHome16, cell: 'LFP-314', s: 16, p: 1 },
  { id: 'ev', label: L.presetEv, cell: '18650-NMC', s: 96, p: 74 },
];
const ROWS = ['U_{nom}', 'U_{min}…U_{max}', 'Q', 'W', 'I_{max} · P_{max}', 'R', 'm', 'w', 'N'] as const;

export const pack: StepFactory = (lab) => {
  const { ctx, ui, mats } = lab;
  const grid = createPackGrid(mats);
  grid.group.position.set(-1.0, 0, 0.35);
  // the inverter «ЛІ-6» on a wall panel, the home-battery cabinet beside it (kit models in metres, ×2.1)
  const wall = group('wall', 2.75, 0, -1.55);
  wall.rotation.y = -0.5;
  wall.add(mesh(new RoundedBoxGeometry(2.9, 3.3, 0.14, 3, 0.05), mats.plinth, 0, 1.65, -0.1));
  const inverter = hybridInverter();
  inverter.group.scale.setScalar(2.1);
  inverter.group.position.set(-0.6, 2.25, 0);
  const cabinet = batteryCabinet();
  cabinet.group.scale.setScalar(2.1);
  const cabinetAt = group('cabinet', 0.75, 0, 0.42, [cabinet.group]);
  cabinet.setSoc(0.8);
  const rings = ([STATUS.ok, STATUS.warning, STATUS.alarm] as const).map((c) => {
    const ring = new Mesh(
      new TorusGeometry(0.95, 0.03, 8, 64),
      K.glow({ color: c, intensity: 1.7, keepHue: true, whiten: 0, falloff: 0 }),
    );
    ring.position.set(-0.6, 2.25, 0.02);
    ring.visible = false;
    wall.add(ring);
    return ring;
  });
  wall.add(inverter.group, cabinetAt);
  const link = createWire(
    [
      new Vector3(1.75, 0.2, 0.3),
      new Vector3(2.3, 0.12, 0.2),
      new Vector3(2.6, 0.5, -0.6),
      new Vector3(2.55, 1.35, -0.95),
    ],
    { radius: 0.05, color: 'ink', repeat: 1.2, speed: 1.4, power: 0 },
  );
  const set = group(`set:${ID}`, 0, 0, 0, [grid.group, wall, link]);
  lab.stageRoot.add(set);

  /* --------------------------------------------------------------------------------------- board */
  const table = factTable('pack8', ROWS);
  // the permanent caveat of the document sits on the board, under the numbers it qualifies
  const caveat = notices('caveat8', { text: { text: L.li6Caveat, tone: 'info' } }, ['text']);
  const presets = PRESETS.map(
    (p) =>
      new Chip({
        text: p.label,
        kind: 'plain',
        onClick: ui.action(`preset8-${p.id}`, () => {
          ui.set('cell8', p.cell);
          ui.set('series8', p.s);
          ui.set('parallel8', p.p);
          audio.play('click');
          rebuild();
        }),
      }),
  );
  lab.holo.add(ID, {
    title: L.boardPack,
    width: 400,
    children: [
      table.spec.node,
      row({ wrap: true, gap: 8, width: 'fill', children: presets }),
      caveat.spec.node,
    ],
  });
  const notes = notices('notes8', {
    ok: { text: L.li6Ok, tone: 'ok' },
    partial: { text: L.li6Partial, tone: 'warning' },
    over: { text: L.li6Over, tone: 'alarm' },
    under: { text: `${L.li6Over.split(':')[0]}: ${L.li6Under}`, tone: 'alarm' },
    blocks: { text: L.asBlocks, tone: 'info' },
  });

  /* --------------------------------------------------------------------------------------- state */
  let verdict: 'ok' | 'partial' | 'over' | 'under' = 'ok';
  const home = { on: 0 };
  const n = (x: number, digits: number): string => fmtNumber(x, { digits });
  function rebuild(instant = false): void {
    const cell = CELLS[ui.value<CellId>('cell8')];
    const s = ui.value<number>('series8');
    const p = ui.value<number>('parallel8');
    const pk: PackResult = buildPack(cell, s, p);
    const blocks = grid.set(
      cell.chem === 'LFP' ? 'brick' : 'cylinder',
      cell.chem === 'LFP' ? 'sky' : 'violet',
      pk.series,
      pk.parallel,
    );
    [
      fmtUnit(pk.uNomV, 'V', { digits: 1 }),
      `${n(pk.uMinV, 1)}…${fmtUnit(pk.uMaxV, 'V', { digits: 1 })}`,
      fmtUnit(pk.capacityAh, 'Ah', { maxDigits: 1 }),
      fmtUnit(pk.energyKwh, 'kWh', { digits: 2 }),
      `${fmtUnit(pk.iMaxA, 'A', { maxDigits: 0 })} · ${fmtUnit(pk.pMaxKw, 'kW', { digits: 2 })}`,
      fmtUnit(pk.resistanceMOhm, 'mΩ', { digits: 1 }),
      fmtUnit(pk.massKg, 'kg', { digits: pk.massKg < 10 ? 2 : 1 }),
      fmtUnit(pk.whPerKg, 'Wh/kg', { digits: 1 }),
      `${pk.series}S${pk.parallel}P = ${n(pk.cells, 0)}`,
    ].forEach((text, i) => table.set(i, text));
    // «ЛІ-6» battery window 40…60 V: ok / works partly / refuses
    verdict =
      pk.li6.verdict === 'ok'
        ? 'ok'
        : pk.li6.verdict === 'partial'
          ? 'partial'
          : pk.li6.reason === 'overvoltage'
            ? 'over'
            : 'under';
    for (const key of ['ok', 'partial', 'over', 'under'] as const) notes.show(key, key === verdict);
    notes.show('blocks', blocks);
    rings.forEach((r, i) => (r.visible = i === (verdict === 'ok' ? 0 : verdict === 'partial' ? 1 : 2)));
    inverter.setLeds({
      bat: verdict === 'ok' || verdict === 'partial',
      alarm: verdict === 'over' || verdict === 'under',
      grid: true,
    });
    link.material.power = verdict === 'ok' ? 1 : verdict === 'partial' ? 0.45 : 0;
    // a 16S LFP pack is the lab's home battery: it "puts on" its cabinet next to the inverter
    const isHome = cell.chem === 'LFP' && pk.series === 16 ? 1 : 0;
    ctx.tweens.to(home, { on: isHome }, { duration: instant ? 0 : 0.5, ease: isHome ? 'back.out' : 'power2.in', onUpdate: () => {
      cabinetAt.scale.setScalar(Math.max(home.on, 1e-3));
      cabinetAt.visible = home.on > 0.01;
    } }); // prettier-ignore
    if (!instant) audio.play(verdict === 'ok' ? 'success' : 'tick', { gain: 0.5 });
  }
  for (const id of ['cell8', 'series8', 'parallel8']) ui.onChange(id, () => rebuild());
  const v = new Vector3();

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [1.2, 5.3, 12.9],
        target: [-1.75, 2.0, 0],
        fov: 28,
        orbit: { azimuth: 0.8, polar: 0.3 },
      },
    },
    stage: { show: [grid.group, wall, link], enter: () => rebuild(true) },
    ui: {
      hint: L.hint8,
      honesty: ['simplified', 'notToScale'],
      controls: [
        { type: 'segmented', id: 'cell8', items: CELL_TABS, value: 'LFP-100' },
        {
          type: 'slider',
          id: 'series8',
          label: L.seriesS,
          min: 1,
          max: 120,
          step: 1,
          value: 16,
          snaps: [16],
        },
        { type: 'slider', id: 'parallel8', label: L.parallelP, min: 1, max: 80, step: 1, value: 2 },
        notes.spec,
      ],
      callouts: [
        { anchor: () => inverter.group.getWorldPosition(v).setY(v.y + 0.85), text: L.inverter, side: 'up' },
        {
          anchor: () =>
            home.on > 0.5
              ? cabinetAt.getWorldPosition(v).setY(v.y + 2.4)
              : ctx.camera.camera.localToWorld(v.set(0, 0, 1)),
          text: L.homeBattery,
          color: 'lime',
          side: 'up',
        },
        {
          anchor: () => grid.group.getWorldPosition(v).setY(v.y + 1.5),
          text: L.busbar,
          color: 'orange',
          side: 'up',
        },
      ],
      hotspots: [
        {
          anchor: () => grid.group.getWorldPosition(v).set(v.x - grid.halfWidth - 0.2, v.y + 0.5, v.z + 1.0),
          title: 'Series string — послідовний ланцюжок',
        },
        {
          anchor: () => grid.group.getWorldPosition(v).set(v.x + grid.halfWidth * 0.5, v.y + 1.2, v.z - 0.6),
          title: 'Busbar torque — затягування шин',
        },
        {
          anchor: () => grid.group.getWorldPosition(v).set(v.x + 2.75, v.y + 0.3, v.z + 1.45),
          title: 'Short circuit — коротке замикання',
        },
      ],
    },
    probe: () => ({
      verdict,
      home: home.on,
      halfWidth: grid.halfWidth,
      blocks: notes.isShown('blocks'),
      cell: ui.value<string>('cell8'),
      s: ui.value<number>('series8'),
      p: ui.value<number>('parallel8'),
    }),
    update(dt, t) {
      grid.update(dt);
      rings.forEach((r) => r.scale.setScalar(1 + 0.03 * Math.sin(t * 3)));
    },
  };
};
