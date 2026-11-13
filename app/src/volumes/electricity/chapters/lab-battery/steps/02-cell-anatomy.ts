/**
 * Step 2 `cell-anatomy` — the hero 21700 with a window, its jelly roll that lifts out and unrolls into a
 * carpet of sheets, the header that comes apart (gasket, CID, PTC, vent, cap) and the gallery of formats.
 */
import { type Object3D, Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtSI } from '@/content';
import { createExplodedView } from '@/fx';
import { cell as kitCell } from '@/kit';
import { notices } from '../hud-bits';
import type { StepFactory } from '../lab';
import { L } from '../labels';
import { CYLINDER_FORMATS, FORMATS, createHeroCell, createJellyRoll, type FormatId } from '../parts';
import { group, nowhere } from '../world';

const ID = 'cell-anatomy';
const HERO_AT = new Vector3(-1.45, 0, -1.3);

export const cellAnatomy: StepFactory = (lab) => {
  const { ctx, ui, mats } = lab;
  const hero = createHeroCell();
  const heroScale = group('hero-scale', HERO_AT.x, 0, HERO_AT.z, [hero.group]);
  hero.group.rotation.y = 0.5; // turn the window toward the camera
  const jelly = createJellyRoll(mats, new Vector3(HERO_AT.x, 1.08, HERO_AT.z), new Vector3(-3.0, 0, 1.6));
  // big prismatic and pouch cells that replace the cylinder when their tab is chosen (kit cells, not to scale)
  const prismatic = kitCell('prismatic');
  prismatic.group.scale.setScalar(9.5);
  const pouch = kitCell('pouch');
  pouch.group.scale.setScalar(13);
  const bigs = {
    prismatic: group('big-prismatic', HERO_AT.x, 0, HERO_AT.z, [prismatic.group]),
    pouch: group('big-pouch', HERO_AT.x, 0, HERO_AT.z, [pouch.group]),
  };
  bigs.prismatic.rotation.y = 0.45;
  bigs.pouch.rotation.y = 0.45;

  // gallery of the other formats along the back-right arc (small, not to scale)
  const gallery = group('gallery', 1.75, 0, -2.0);
  const small = (model: { group: Object3D }, x: number, z: number, scale: number): Object3D => {
    model.group.position.set(x, 0, z);
    model.group.scale.setScalar(scale);
    model.group.rotation.y = 0.4;
    gallery.add(model.group);
    return model.group;
  };
  const g18650 = small(createHeroCell('blue'), -1.0, 0.1, 0.5);
  g18650.scale.set(
    0.5 * CYLINDER_FORMATS['18650'][0],
    0.5 * CYLINDER_FORMATS['18650'][1],
    0.5 * CYLINDER_FORMATS['18650'][0],
  );
  const g4680 = small(createHeroCell('violet'), -0.05, -0.25, 0.5);
  g4680.scale.set(
    0.5 * CYLINDER_FORMATS['4680'][0],
    0.5 * CYLINDER_FORMATS['4680'][1],
    0.5 * CYLINDER_FORMATS['4680'][0],
  );
  small(kitCell('prismatic'), 1.05, -0.1, 5.2);
  small(kitCell('pouch'), 1.95, 0.6, 7);
  const set = group(`set:${ID}`, 0, 0, 0, [heroScale, jelly.group, bigs.prismatic, bigs.pouch, gallery]);
  lab.stageRoot.add(set);

  /* ------------------------------------------------------------------------------------- state */
  const header = createExplodedView(
    (['gasket', 'cid', 'ptc', 'vent', 'cap'] as const).map((name, i) => ({
      object: hero.part(name),
      axis: [0, 1, 0] as const,
      distance: 0.22 + i * 0.3,
      delay: 0.04 * i,
    })),
  );
  const view = { cap: 0, sx: 1, sy: 1, prismatic: 0, pouch: 0 };
  const notes = notices('notes2', { later: { text: L.capLater, tone: 'info' } });
  const sync = (): void => {
    header.amount = view.cap;
    heroScale.scale.set(Math.max(view.sx, 1e-3), Math.max(view.sy, 1e-3), Math.max(view.sx, 1e-3));
    heroScale.visible = view.sx > 0.01;
    for (const k of ['prismatic', 'pouch'] as const) {
      bigs[k].scale.setScalar(Math.max(view[k], 1e-3));
      bigs[k].visible = view[k] > 0.01;
    }
  };
  const format = (): FormatId => ui.value<FormatId>('format2');
  const applyFormat = (instant: boolean): void => {
    const f = format();
    const cyl = f in CYLINDER_FORMATS ? CYLINDER_FORMATS[f as keyof typeof CYLINDER_FORMATS] : null;
    const to = {
      sx: cyl ? cyl[0] : 0,
      sy: cyl ? cyl[1] : 0,
      prismatic: f === 'prismatic' ? 1 : 0,
      pouch: f === 'pouch' ? 1 : 0,
    };
    if (instant) Object.assign(view, to);
    else ctx.tweens.to(view, to, { duration: 0.55, ease: 'back.out', onUpdate: sync });
    sync();
  };
  const setCap = (open: boolean, instant = false): void => {
    notes.show('later', open);
    ctx.tweens.to(
      view,
      { cap: open ? 1 : 0 },
      { duration: instant ? 0 : 0.9, ease: 'power2.inOut', onUpdate: sync },
    );
  };
  // camera follows the state: header close-up, wide view of the carpet, or the tight product shot
  let shot = ID;
  const frame = (instant = false): void => {
    const want = capOpen ? `${ID}:cap` : ui.value<number>('unroll') > 15 ? `${ID}:carpet` : ID;
    if (want === shot && !instant) return;
    shot = want;
    ctx.camera.go(want, { duration: 1.5, instant });
  };
  let capOpen = false;
  ui.onChange('format2', (f) => {
    // only the 21700 hero carries the roll: other formats put it back and close the header
    if (f !== '21700') ui.set('unroll', 0);
    if (capOpen && f !== '21700') setCap((capOpen = false));
    audio.play('tick');
    applyFormat(false);
  });
  ui.onChange('unroll', (v) => {
    if ((v as number) > 0 && format() !== '21700') {
      ui.set('format2', '21700');
      applyFormat(false);
    }
  });

  /* ------------------------------------------------------------------------- anchors by state */
  const v = new Vector3();
  const hide = (): Vector3 => nowhere(ctx, v);
  const unrolled = (): boolean => jelly.amount > 0.62;
  /** The object while the carpet is out; otherwise a point of the hero's window (or nowhere). */
  const layerOr = (layer: Object3D, dy: number | null) => (): Vector3 => {
    if (unrolled()) return layer.getWorldPosition(v);
    if (dy === null || format() !== '21700' || view.cap > 0.5) return hide();
    return hero
      .anchor('window')
      .getWorldPosition(v)
      .setY(v.y + dy);
  };
  const capPart = (name: string) => (): Vector3 =>
    view.cap > 0.5
      ? hero
          .part(name)
          .getWorldPosition(v)
          .setX(v.x + 0.3)
      : hide();
  const f = (): { ah: number; wh: number; kg: number } => FORMATS[format()];
  let shown = 0;

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [2.3, 3.0, 6.3],
        target: [0.15, 1.45, -1.3],
        fov: 28,
        orbit: { azimuth: 0.9, polar: 0.3 },
      },
      [`${ID}:carpet`]: {
        position: [2.9, 4.9, 9.1],
        target: [-0.3, 0.9, 0.0],
        fov: 28,
        orbit: { azimuth: 0.9, polar: 0.3 },
      },
      [`${ID}:cap`]: {
        position: [1.1, 4.7, 2.9],
        target: [-1.2, 3.1, -1.3],
        fov: 28,
        focus: hero.part('ptc'),
      },
    },
    stage: {
      show: [gallery, heroScale, jelly.group, bigs.prismatic, bigs.pouch],
      enter: (info) => {
        capOpen = false;
        setCap(false, true);
        applyFormat(true);
        shot = ID; // the stage is already heading to the default shot
        if (info.instant) {
          jelly.amount = shown = ui.value<number>('unroll') / 100;
          frame(true);
        }
      },
    },
    ui: {
      hint: L.hint2,
      honesty: ['notToScale', 'simplified'],
      controls: [
        { type: 'slider', id: 'unroll', label: L.unroll, min: 0, max: 100, step: 1, unit: '%', value: 0 },
        {
          type: 'segmented',
          id: 'format2',
          items: [
            { id: '18650', label: '18650' },
            { id: '21700', label: '21700' },
            { id: '4680', label: '4680' },
            { id: 'prismatic', label: L.fmtPrismatic },
            { id: 'pouch', label: L.fmtPouch },
          ],
          value: '21700',
        },
        { type: 'readout', id: 'ah2', label: L.capacityAh, unit: 'Ah', digits: 1, get: () => f().ah },
        { type: 'readout', id: 'wh2', label: L.energyWh, format: (x) => fmtSI(x, 'Wh'), get: () => f().wh },
        { type: 'readout', id: 'kg2', label: L.mass, format: (x) => fmtSI(x * 1000, 'g'), get: () => f().kg },
        notes.spec,
        {
          type: 'button',
          id: 'capCut',
          label: L.capCut,
          icon: 'layers',
          onClick: () => {
            if (format() !== '21700') {
              ui.set('format2', '21700');
              applyFormat(false);
            }
            ui.set('unroll', 0);
            setCap((capOpen = !capOpen));
          },
        },
      ],
      callouts: [
        { anchor: layerOr(jelly.layers[3]!, null), text: L.anodeSheet, color: 'orange', side: 'up' },
        { anchor: layerOr(jelly.layers[1]!, null), text: L.cathodeSheet, color: 'violet', side: 'up' },
        {
          anchor: () =>
            jelly.amount < 0.1 && view.cap < 0.5 && format() === '21700'
              ? hero.anchor('window').getWorldPosition(v)
              : hide(),
          text: L.jellyRoll,
          side: 'right',
        },
        { anchor: capPart('gasket'), text: L.partGasket, side: 'right' },
        { anchor: capPart('cid'), text: L.partCid, side: 'right' },
        { anchor: capPart('ptc'), text: L.partPtc, color: 'amber', side: 'right' },
        { anchor: capPart('vent'), text: L.partVent, side: 'right' },
        { anchor: capPart('cap'), text: L.partCap, color: 'coral', side: 'right' },
      ],
      hotspots: [
        { anchor: layerOr(jelly.layers[2]!, 0.55), title: 'Separator — сепаратор' },
        { anchor: layerOr(jelly.layers[3]!, 0), title: 'Copper foil — мідна фольга' },
        {
          anchor: () => (unrolled() ? jelly.mist.getWorldPosition(v) : layerOr(jelly.mist, -0.55)()),
          title: 'Electrolyte — електроліт',
        },
      ],
    },
    probe: () => ({ unrolled: jelly.amount, cap: view.cap, format: format(), sx: view.sx, wh: f().wh }),
    update(dt) {
      // the roll follows the slider smoothly; its pose is a pure function of the amount
      const target = ui.value<number>('unroll') / 100;
      shown += (target - shown) * Math.min(1, dt * 5);
      if (Math.abs(target - shown) < 1e-4) shown = target;
      jelly.amount = shown;
      if (lab.isCurrent(ID)) frame();
      gallery.children.forEach((c, i) => (c.rotation.y = 0.4 + Math.sin(ctx.clock.time * 0.5 + i) * 0.08));
    },
  };
};
