/**
 * Step 5 `hot-section` — «Гаряча частина: лопатка, гарячіша за власну точку плавлення». Macro on one first-stage
 * blade (drawn ≈ ×14) in the stream of hot gas (`orange` → near-`white` by TIT): translucent metal, the
 * serpentine channel with `sky` air inside, `sky` films leaving the holes and hugging the pressure side, the thin
 * `mist` ceramic coat; beside it a lattice «one big crystal». The three toggles and the TIT slider (linked to
 * step 4) feed model M2 (illustrative): the «термометр шарів» on the board, the blade's colour; above 1100 °C it
 * pulses `red` with the creep note, above 1300 °C its edge «melts» and «Відновити» brings everything back.
 */
import { CatmullRomCurve3, Group, InstancedMesh, Matrix4, Vector3 } from 'three';
import { fmtUnit } from '@/content';
import { createFlow } from '@/fx';
import { G } from '@/kit';
import { K, col } from '@/style';
import type { Chart } from '@/ui3d';
import { TIT_RANGE_C, bladeMetalTempC, bladeState } from '@electricity/sim/plant-gas';
import { HOTSPOTS } from '../hotspots';
import { fill } from '../labels';
import { MACRO } from '../layout';
import { BLADE, bladeSurface, buildBlade } from '../parts/blade';
import { gasColor } from '../parts/gt-flow';
import { hot } from './hot';
import type { StepFactory } from './types';

export const hotSection: StepFactory = ({ ctx, ui, L, live, shell }) => {
  const rig = new Group();
  rig.name = 'hot-section';
  rig.position.set(MACRO.x, MACRO.y, MACRO.z);
  ctx.root.add(rig);
  const blade = buildBlade();
  rig.add(blade.group);
  // hot gas streaming past (+X), above, below and on both faces of the blade
  const gasPaths = [];
  for (const z of [-1.1, -0.75, 0.55, 0.9, 1.3]) for (const y of [0.5, 1.4, 2.3, 3.0]) gasPaths.push({ path: [new Vector3(-3.4, y, z), new Vector3(3.6, y + 0.1, z + (z > 0 ? 0.25 : -0.25))] });
  const hotGas = createFlow(ctx, { kind: 'blob', color: 'orange', paths: gasPaths, count: 160, radius: 0.045, speed: 3.2, spread: 0.1 });
  rig.add(hotGas);
  const inner = createFlow(ctx, { kind: 'blob', color: 'sky', paths: new CatmullRomCurve3(G.roundPath(blade.channel, 0.25)), count: 60, radius: 0.06, speed: 1.4 });
  rig.add(inner);
  // films: from each hole along the surface toward the trailing edge, 4 cm off the wall
  const filmPaths = blade.holes.map((h) => {
    const y = h.y;
    const side: 1 | -1 = h.z > -0.25 ? 1 : -1;
    const t0 = (h.x + BLADE.chord / 2) / BLADE.chord;
    const pts = [h.clone()];
    for (let k = 1; k <= 5; k++) pts.push(bladeSurface(Math.min(1, t0 + ((1 - t0) * k) / 5), y + 0.04 * k, side).add(new Vector3(0, 0, side * 0.05)));
    return { path: pts };
  });
  const film = createFlow(ctx, { kind: 'blob', color: 'sky', paths: filmPaths, count: 150, radius: 0.035, speed: 0.9 });
  rig.add(film);
  // «одна велика ґратка без меж зерен»: a lattice of 5 × 5 × 5 atoms, turning slowly
  const lattice = new InstancedMesh(G.sphere(0.06, 10), K.toon({ color: 'steel.light' }), 125);
  const m4 = new Matrix4();
  let k = 0;
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) for (let l = 0; l < 5; l++) lattice.setMatrixAt(k++, m4.makeTranslation((i - 2) * 0.22, (j - 2) * 0.22, (l - 2) * 0.22));
  lattice.position.set(3.2, 2.2, -0.4);
  rig.add(lattice);
  const metalC = (): number => bladeMetalTempC(ui.value('hs.tbc'), ui.value('hs.film'), ui.value('hs.int'), ui.value('br.tit'));
  const state = (): ReturnType<typeof bladeState> => bladeState(metalC());
  let melt = 0;
  const tint = col('amber');
  const restore = (): void => {
    for (const id of ['hs.tbc', 'hs.film', 'hs.int']) ui.set(id, true, { notify: true });
  };
  const bars = (): number[] => {
    const m = metalC();
    return [ui.value<number>('br.tit'), ui.value('hs.tbc') ? m + 120 : 0, m, ui.value('hs.int') ? 550 : 0];
  };
  ctx.qa.expose('blade', () => ({ metal: metalC(), state: state(), coat: blade.coat.visible, film: film.density, inner: inner.density }));
  return {
    id: 'hot-section',
    stage: { camera: 'hot-section', show: [...shell.outside, rig], env: 'dusk', post: { bloomIntensity: 1.2 } },
    ui: {
      honesty: [{ text: L.bladeEnlarged }, { kind: 'illustrative', text: L.estimate }],
      controls: [
        { type: 'toggle', id: 'hs.int', label: L.internal, value: true },
        { type: 'toggle', id: 'hs.film', label: L.film, value: true },
        { type: 'toggle', id: 'hs.tbc', label: L.tbc, value: true },
        { type: 'slider', id: 'hs.tit', label: L.tit, min: TIT_RANGE_C[0], max: TIT_RANGE_C[1], step: 10, value: 1600, unit: '°C', digits: 0, onChange: (v) => ui.set('br.tit', v, { notify: true }) },
        { type: 'note', id: 'hs.creep', icon: 'warning', color: 'amber', text: L.creepNote, visible: () => state() === 'creep' },
        { type: 'note', id: 'hs.melt', icon: 'warning', color: 'red', text: L.melting, visible: () => state() === 'melting' },
        { type: 'button', id: 'hs.restore', label: L.restore, icon: 'resetView', visible: () => state() !== 'ok', onClick: restore },
      ],
      board: {
        title: L.thermometer,
        size: 'sm',
        children: [
          {
            type: 'chart',
            id: 'hs.thermo',
            chart: {
              height: 170,
              x: { min: 0.4, max: 4.6, ticks: [1, 2, 3, 4], format: (v: number) => [L.layerGas, L.layerCoat, L.layerMetal, L.layerChannels][Math.round(v) - 1] ?? '' },
              y: { min: 0, max: 1800, label: 't, °C', ticks: [0, 500, 1000, 1500] },
              series: [
                { id: 'gas', color: 'orange', kind: 'bars', width: 0.55 },
                { id: 'coat', color: 'mist', kind: 'bars', width: 0.55 },
                { id: 'ok', color: 'green', kind: 'bars', width: 0.55 },
                { id: 'creep', color: 'amber', kind: 'bars', width: 0.55 },
                { id: 'melting', color: 'red', kind: 'bars', width: 0.55 },
                { id: 'ch', color: 'sky', kind: 'bars', width: 0.55 },
              ],
              legend: false,
            },
            update: (c: Chart) => {
              const [g, co, m, ch] = bars() as [number, number, number, number];
              c.setData('gas', [1], [g]);
              c.setData('coat', [2], [co]);
              for (const s of ['ok', 'creep', 'melting'] as const) c.setData(s, [3], [state() === s ? m : 0]);
              c.setData('ch', [4], [ch]);
            },
          },
          { type: 'readout', id: 'hs.metal', label: L.layerMetal, text: () => fmtUnit(Math.round(metalC()), '°C'), color: () => (state() === 'ok' ? 'green' : state() === 'creep' ? 'amber' : 'red') },
        ],
      },
      callouts: [
        { anchor: () => rig.localToWorld(new Vector3(-2.6, 3.0, 1.0)), text: () => fill(L.hotGas, fmtUnit(ui.value<number>('br.tit'), '°C')), color: 'orange', priority: 2 },
        { anchor: () => rig.localToWorld(new Vector3(-0.55, 1.2, -0.1)), text: L.coolAir, color: 'sky', side: 'left', priority: 1, visible: () => ui.value<boolean>('hs.int') },
        { anchor: () => rig.localToWorld(new Vector3(0.6, 2.6, 0.3)), text: () => fill(L.metalNow, fmtUnit(Math.round(metalC()), '°C')), side: 'right', priority: 0 },
      ],
      hotspots: [hot(() => rig.localToWorld(blade.holes[13]!.clone()), HOTSPOTS['hot-section'].holes), hot(() => lattice.getWorldPosition(new Vector3()), HOTSPOTS['hot-section'].crystal)],
    },
    update(dt, t) {
      live.gtTarget = 1;
      if (ui.value<number>('hs.tit') !== ui.value<number>('br.tit')) ui.set('hs.tit', ui.value<number>('br.tit'));
      const tit = ui.value<number>('br.tit');
      hotGas.setColor(gasColor(tit * 0.8));
      inner.density = ui.value('hs.int') ? 1 : 0;
      film.density = ui.value('hs.film') ? 1 : 0;
      blade.coat.visible = ui.value<boolean>('hs.tbc');
      const m = metalC();
      const s = state();
      // metal colour: warm amber when cooled well → orange → `red` pulsing in creep / melting
      tint.copy(col('amber')).lerp(col('orange'), Math.min(1, Math.max(0, (m - 950) / 150)));
      if (s !== 'ok') tint.lerp(col('red'), 0.6 + 0.4 * Math.sin(t * 6));
      blade.metal.color.copy(tint);
      melt += ((s === 'melting' ? 1 : 0) - melt) * Math.min(1, dt * 2);
      blade.metal.fade = 1 - 0.45 * melt * (0.8 + 0.2 * Math.sin(t * 9));
      blade.group.scale.y = 1 + (s === 'creep' ? 0.015 : 0) + 0.03 * melt;
      lattice.rotation.y += dt * 0.3;
      lattice.rotation.x = 0.4;
    },
  };
};
