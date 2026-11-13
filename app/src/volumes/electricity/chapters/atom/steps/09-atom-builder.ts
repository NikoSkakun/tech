/**
 * Step 9 `atom-builder` — «Конструктор атома». Three baskets (p⁺, n⁰, e⁻) feed an atom that rebuilds itself
 * live; the element card names it and judges it with the sim (§4: `buildAtom` — element, isotope stability
 * and half-life, ion charge, configuration, shells). Unstable nuclei tremble and glow red; an anion that
 * cannot exist loses its extra electron at once.
 */
import { Group, LatheGeometry, Mesh, Vector2, Vector3 } from 'three';
import { audio } from '@/audio';
import { damp, toOverlay } from '@/engine/api';
import { createHalo, createOrbs, type OrbKind } from '@/fx';
import { BUILDER_PRESETS, BUILDER_RANGES, buildAtom, type BuilderResult } from '@electricity/sim/atom';
import { K, type ColorLike } from '@/style';
import { Text3D } from '@/text';
import type { StepFactory } from '../chapter';
import { L } from '../labels';
import { builderRows, nuclideName, statusText } from '../parts/builder-text';
import { createCountStepper } from '../parts/count-stepper';
import { ShellAtom } from '../parts/shell-atom';

type Kind = 'np' | 'nn' | 'ne';
const KINDS: readonly { id: Kind; orb: OrbKind; color: ColorLike; label: string; x: number }[] = [
  { id: 'np', orb: 'proton', color: 'coral', label: L.builder.protons, x: -3.6 },
  { id: 'nn', orb: 'neutron', color: 'mist', label: L.builder.neutrons, x: -0.6 },
  { id: 'ne', orb: 'electron', color: 'cyan', label: L.builder.electrons, x: 2.4 },
];
const ATOM = new Vector3(-0.6, 1.0, 0);
const BASKET_Y = -4.6;
/** The name plate right of the atom: symbol, name and the stability badge (details: the dock's table). */
const PLATE = { x: 5.6, y: 2.3 };
const STATUS_COLOR = { green: 'green', amber: 'amber', red: 'red', mist: 'mist' } as const;
const FLIGHTS = 5;

interface Flight {
  age: number;
  from: Vector3;
  to: Vector3;
}

export const atomBuilderStep: StepFactory = ({ ctx, ui }) => {
  const { stage } = ctx;
  const on = (): boolean => stage.current === 'atom-builder';
  const set = new Group();
  set.name = 'atom-builder';
  ctx.root.add(set);

  const atom = new ShellAtom(ctx.random.fork('builder'), {
    maxProtons: BUILDER_RANGES.z.max,
    maxNeutrons: BUILDER_RANGES.n.max,
    nucleusScale: 0.3,
  });
  atom.group.position.copy(ATOM);
  atom.group.scale.setScalar(0.95);
  const alarm = createHalo({ color: 'red', size: 3.8, intensity: 0 });
  alarm.position.copy(ATOM);
  const plate = (size: number, y: number): Text3D => {
    const text = new Text3D('', {
      font: 'display',
      size,
      color: 'white',
      anchorX: 'center',
      anchorY: 'middle',
      billboard: true,
    });
    text.position.set(PLATE.x, y, 0.5);
    toOverlay(text);
    return text;
  };
  const symbol = plate(1.3, PLATE.y);
  const name = plate(0.5, PLATE.y - 1.35);
  const badge = plate(0.44, PLATE.y - 2.2);
  set.add(atom.group, alarm, symbol, name, badge);

  // baskets: a bowl per particle kind with a few particles inside; flights travel between basket and atom
  const bowlProfile = [
    [0, 0],
    [0.7, 0],
    [1.0, 0.25],
    [1.12, 0.75],
    [1.02, 0.78],
    [0.9, 0.34],
    [0.62, 0.14],
    [0, 0.14],
  ].map(([x, y]) => new Vector2(x, y));
  const bowlGeometry = new LatheGeometry(bowlProfile, 40);
  const baskets = KINDS.map((kind) => {
    const group = new Group();
    group.position.set(kind.x, BASKET_Y, 1.2);
    const bowl = new Mesh(
      bowlGeometry,
      K.toon({
        color: kind.color,
        gradient: { bottom: 'bg.indigo', top: kind.color, range: [0, 0.8] },
        rim: 1.2,
        gloss: 0.4,
      }),
    );
    bowl.castShadow = true;
    const stock = createOrbs({ kind: kind.orb, count: 7, radius: 0.24, halo: false });
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      const r = i === 0 ? 0 : 0.5;
      stock.setPosition(i, Math.cos(a) * r, 0.42 + (i % 3) * 0.2, Math.sin(a) * r);
    }
    stock.commit();
    const flying = createOrbs({ kind: kind.orb, count: FLIGHTS, radius: 0.22 });
    flying.instances = FLIGHTS;
    group.add(bowl, stock);
    set.add(group, flying);
    ctx.input.register(group, {
      tooltip: `${kind.label} — ${L.builder.basket}`,
      enabled: on,
      click: () => change(kind.id, count[kind.id] + 1),
    });
    return { kind, group, flying, flights: [] as Flight[], last: -1 };
  });

  /* --------------------------------------------------------------------------------- model binding */
  // the three counts: plain state, shown by the dock's steppers (the step UI has no stepper control)
  const count: Record<Kind, number> = {
    np: BUILDER_PRESETS.hydrogen.protons,
    nn: BUILDER_PRESETS.hydrogen.neutrons,
    ne: BUILDER_PRESETS.hydrogen.electrons,
  };
  const limit: Record<Kind, () => number> = {
    np: () => BUILDER_RANGES.z.max,
    nn: () => BUILDER_RANGES.n.max,
    ne: () => count.np + 1, // Ne ≤ Z + 1 (sim §4)
  };
  let result: BuilderResult = buildAtom(BUILDER_PRESETS.hydrogen);
  const done = { isotope: false, ion: false, copper: false };
  const award = (key: keyof typeof done, text: string): void => {
    if (done[key]) return;
    done[key] = true;
    audio.play('success', { gain: 0.6 });
    ui.toast(text, { icon: 'star', tone: 'ok', duration: 4 });
  };
  const fly = (index: number, outward: boolean): void => {
    const b = baskets[index]!;
    if (ctx.clock.time - b.last < 0.07 || b.flights.length >= FLIGHTS) return; // a preset sends a few, not dozens
    b.last = ctx.clock.time;
    const basket = b.group.position.clone().setY(BASKET_Y + 0.8);
    const target = ATOM.clone().add(index === 2 ? new Vector3(1.6, 1.2, 0.6) : new Vector3());
    b.flights.push({ age: 0, from: outward ? target : basket, to: outward ? basket : target });
  };
  const apply = (instant = false): void => {
    result = buildAtom({ protons: count.np, neutrons: count.nn, electrons: count.ne });
    count.ne = result.electrons; // Ne ≤ Z + 1
    atom.set(result.protons, result.neutrons, result.shells, instant);
    const status = statusText(result);
    symbol.text = result.element ? result.ionLabel : '—';
    name.text = nuclideName(result);
    // the badge keeps to the headline of the status; the dock's note carries the whole sentence
    badge.text = result.element ? status.text.split(/[:(]/)[0]!.trim() : '';
    badge.color = STATUS_COLOR[status.tone];
    if (result.anionUnstable && !instant) {
      // the extra electron cannot stay: it leaves, and the atom is neutral again
      ui.toast(L.builder.anionUnstable, { icon: 'warning', tone: 'warning', duration: 4.5 });
      stage.scope.delay(0.9, () => {
        if (!result.anionUnstable) return;
        count.ne = result.protons;
        fly(2, true);
        apply();
      });
    }
    if (
      result.protons === 29 &&
      (result.neutrons === 34 || result.neutrons === 36) &&
      result.charge === 0 &&
      !instant
    )
      award('copper', L.builder.copperDone);
  };
  const change = (id: Kind, value: number): void => {
    const index = KINDS.findIndex((k) => k.id === id);
    const before = count[id];
    const next = Math.min(Math.max(Math.round(value), 0), limit[id]());
    count[id] = next;
    changed(index, next - before);
  };
  /** A count changed by `delta` (`count` already holds the new value). */
  const changed = (index: number, delta: number): void => {
    if (delta !== 0) {
      fly(index, delta < 0);
      audio.play('tick', { pitch: delta > 0 ? 1.2 : 0.8, gain: 0.5 });
    }
    apply();
    if (index === 1 && delta !== 0 && result.protons > 0) award('isotope', L.builder.firstIsotope);
    if (index === 2 && delta !== 0 && result.protons > 0 && result.charge !== 0 && !result.anionUnstable)
      award('ion', L.builder.firstIon);
  };
  const preset = (key: keyof typeof BUILDER_PRESETS): void => {
    const p = BUILDER_PRESETS[key];
    Object.assign(count, { np: p.protons, nn: p.neutrons, ne: p.electrons });
    audio.play('click');
    [0, 1, 2].forEach((i) => fly(i, false));
    apply();
    if (key === 'copperIon') award('ion', L.builder.firstIon);
  };

  /* ------------------------------------------------------------------------------- stage & step UI */
  stage.define({
    'atom-builder': {
      show: [set],
      camera: 'builder',
      enter() {
        apply(true);
        for (const s of steppers) s.release();
        for (const b of baskets) b.flights.length = 0;
      },
    },
  });

  // «+» / «−» with auto-repeat while held, one row per particle kind
  const steppers = KINDS.map((kind) =>
    createCountStepper({
      id: kind.id,
      label: kind.label,
      color: kind.color,
      minus: L.builder.minus,
      plus: L.builder.plus,
      get: () => count[kind.id],
      min: () => 0,
      max: limit[kind.id],
      onStep: (delta) => change(kind.id, count[kind.id] + delta),
    }),
  );
  const presetButton = (key: keyof typeof BUILDER_PRESETS, primary = false) => ({
    type: 'button' as const,
    id: `preset-${key}`,
    label: L.builder[key],
    primary,
    onClick: () => preset(key),
  });
  ui.define({
    'atom-builder': {
      hint: L.builder.hint,
      honesty: ['simplified', 'notToScale'],
      controls: [
        { type: 'table', id: 'card', rows: () => builderRows(result) },
        {
          type: 'note',
          id: 'stability',
          text: () => `${L.builder.nucleus}: ${statusText(result).text}`,
          icon: 'info',
          color: () => STATUS_COLOR[statusText(result).tone],
          visible: () => result.element !== undefined,
        },
        ...KINDS.map((kind, i) => ({
          type: 'custom' as const,
          id: kind.id,
          node: steppers[i]!.node,
          update: (t: number) => steppers[i]!.update(t),
        })),
        presetButton('hydrogen'),
        presetButton('helium4'),
        presetButton('carbon12'),
        presetButton('iron56'),
        presetButton('copper63', true),
        presetButton('copperIon'),
      ],
      callouts: baskets.map((b) => ({
        anchor: b.group,
        text: b.kind.label,
        color: b.kind.color,
        side: 'down' as const,
      })),
      hotspots: [
        { anchor: [PLATE.x + 1.9, PLATE.y + 0.7, 0.5], content: 'element-card' },
        { anchor: [PLATE.x + 2.3, PLATE.y - 2.3, 0.5], content: 'stability-badge' },
      ],
    },
  });
  ctx.qa.probe('builder.basket', () => baskets[1]!.group.position.clone().setY(BASKET_Y + 0.5));
  ctx.qa.expose('builder', () => ({ ...count, symbol: result.ionLabel, status: result.status }));

  /* -------------------------------------------------------------------------------------- per frame */
  const p = new Vector3();
  let heat = 0;
  return {
    update(dt, t) {
      // an unstable nucleus trembles and flickers red; a listed radioactive one is merely restless
      const unstable =
        result.status === 'instant' || result.status === 'fastDecay' || result.status === 'unbound';
      const restless = unstable ? 1 : result.status === 'radioactive' ? 0.35 : 0;
      heat = damp(heat, restless, 5, dt);
      atom.nucleus.jiggle = 1 + 4 * heat;
      alarm.intensity = unstable ? heat * (1.1 + 0.6 * Math.sin(t * 9)) : 0;
      alarm.visible = alarm.intensity > 0.02;
      atom.update(dt, t);
      for (const b of baskets) {
        b.group.position.y = BASKET_Y + Math.sin(t * 1.2 + b.kind.x) * 0.06;
        for (let i = 0; i < FLIGHTS; i++) {
          const f = b.flights[i];
          if (!f) {
            b.flying.setScale(i, 0);
            continue;
          }
          f.age += dt / 0.55;
          const k = Math.min(f.age, 1);
          const e = k * k * (3 - 2 * k);
          p.lerpVectors(f.from, f.to, e);
          p.y += Math.sin(Math.PI * e) * 2.2; // arc
          b.flying.setPosition(i, p.x, p.y, p.z, Math.min(1, 4 * k * (1 - k) + 0.25));
        }
        b.flights = b.flights.filter((f) => f.age < 1);
        b.flying.commit();
      }
    },
  };
};
