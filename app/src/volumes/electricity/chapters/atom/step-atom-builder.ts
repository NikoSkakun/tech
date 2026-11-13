/**
 * Step 9 `atom-builder` — «Конструктор атома». Three baskets (p⁺, n⁰, e⁻) feed an atom that rebuilds itself
 * live; the element card names it and judges it with the sim (§4: `buildAtom` — element, isotope stability
 * and half-life, ion charge, configuration, shells). Unstable nuclei tremble and glow red; an anion that
 * cannot exist loses its extra electron at once.
 */
import { Group, LatheGeometry, Mesh, Vector2, Vector3 } from 'three';
import { audio } from '@/audio';
import { damp, type TweenScope } from '@/engine/api';
import { createHalo, createOrbs, type OrbKind } from '@/fx';
import { hud } from '@/hud';
import { BUILDER_PRESETS, BUILDER_RANGES, buildAtom, type BuilderResult } from '@electricity/sim/atom';
import { K, type ColorLike } from '@/style';
import { qaProbe, type StepFactory } from './chapter';
import { hotspotName } from './content';
import { L } from './labels';
import { builderCard } from './parts/builder-text';
import { createElementCard } from './parts/element-card';
import { ShellAtom } from './parts/shell-atom';

type Kind = 'np' | 'nn' | 'ne';
const KINDS: readonly { id: Kind; orb: OrbKind; color: ColorLike; label: string; x: number }[] = [
  { id: 'np', orb: 'proton', color: 'coral', label: L.builder.protons, x: -6.2 },
  { id: 'nn', orb: 'neutron', color: 'mist', label: L.builder.neutrons, x: -3.4 },
  { id: 'ne', orb: 'electron', color: 'cyan', label: L.builder.electrons, x: -0.6 },
];
const ATOM = new Vector3(-3.1, 0.9, 0);
const BASKET_Y = -4.5;
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
  atom.group.scale.setScalar(0.8);
  const alarm = createHalo({ color: 'red', size: 3.2, intensity: 0 });
  alarm.position.copy(ATOM);
  const card = createElementCard(ctx, 0.0185);
  card.surface.position.set(5.2, 0.7, 0.5);
  set.add(atom.group, alarm, card.surface);

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
      click: () => change(kind.id, ui.value<number>(kind.id) + 1),
    });
    return { kind, group, flying, flights: [] as Flight[], last: -1 };
  });

  /* --------------------------------------------------------------------------------- model binding */
  let scope: TweenScope = ctx.tweens;
  let result: BuilderResult = buildAtom(BUILDER_PRESETS.hydrogen);
  const done = { isotope: false, ion: false, copper: false };
  const award = (key: keyof typeof done, text: string): void => {
    if (done[key]) return;
    done[key] = true;
    audio.play('success', { gain: 0.6 });
    hud()?.toast(text, { icon: 'star', tone: 'ok', duration: 4 });
  };
  const fly = (index: number, outward: boolean): void => {
    const b = baskets[index]!;
    if (ctx.clock.time - b.last < 0.07 || b.flights.length >= FLIGHTS) return; // a slider sweep sends a few, not hundreds
    b.last = ctx.clock.time;
    const basket = b.group.position.clone().setY(BASKET_Y + 0.8);
    const target = ATOM.clone().add(index === 2 ? new Vector3(1.6, 1.2, 0.6) : new Vector3());
    b.flights.push({ age: 0, from: outward ? target : basket, to: outward ? basket : target });
  };
  const apply = (instant = false): void => {
    result = buildAtom({
      protons: ui.value<number>('np'),
      neutrons: ui.value<number>('nn'),
      electrons: ui.value<number>('ne'),
    });
    if (result.electrons !== ui.value<number>('ne')) ui.set('ne', result.electrons); // Ne ≤ Z + 1
    atom.set(result.protons, result.neutrons, result.shells, instant);
    card.set(builderCard(result));
    if (result.anionUnstable && !instant) {
      // the extra electron cannot stay: it leaves, and the atom is neutral again
      hud()?.toast(L.builder.anionUnstable, { icon: 'warning', tone: 'warning', duration: 4.5 });
      scope.delay(0.9, () => {
        if (!result.anionUnstable) return;
        ui.set('ne', result.protons);
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
    const before = ui.value<number>(id);
    const max =
      id === 'np' ? BUILDER_RANGES.z.max : id === 'nn' ? BUILDER_RANGES.n.max : BUILDER_RANGES.z.max + 1;
    const next = Math.min(Math.max(Math.round(value), 0), max);
    if (next !== before) ui.set(id, next);
    changed(index, next - before);
  };
  /** A count changed by `delta` (the slider already holds the new value). */
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
    ui.set('np', p.protons);
    ui.set('nn', p.neutrons);
    ui.set('ne', p.electrons);
    audio.play('click');
    [0, 1, 2].forEach((i) => fly(i, false));
    apply();
    if (key === 'copperIon') award('ion', L.builder.firstIon);
  };

  /* ------------------------------------------------------------------------------- stage & step UI */
  const prev: Record<Kind, number> = { np: 1, nn: 0, ne: 1 };
  const sync = (): void => KINDS.forEach((k) => (prev[k.id] = ui.value<number>(k.id)));
  ctx.camera.shots({
    builder: {
      position: [0.7, 0.8, 21],
      target: [0.7, -1.1, 0],
      frameAspect: 1.5,
      orbit: { azimuth: 0.3, polar: 0.15 },
    },
  });
  stage.define({
    'atom-builder': {
      show: [set],
      camera: 'builder',
      enter(info) {
        scope = info.scope;
        apply(true);
        sync();
        for (const b of baskets) b.flights.length = 0;
      },
    },
  });

  const slider = (index: number, max: number, value: number) => {
    const kind = KINDS[index]!;
    return {
      type: 'slider' as const,
      id: kind.id,
      label: kind.label,
      min: 0,
      max,
      step: 1,
      value,
      onChange: (v: number) => {
        const delta = v - prev[kind.id];
        changed(index, delta);
        sync();
      },
    };
  };
  const presetButton = (key: keyof typeof BUILDER_PRESETS, primary = false) => ({
    type: 'button' as const,
    id: `preset-${key}`,
    label: L.builder[key],
    primary,
    onClick: () => {
      preset(key);
      sync();
    },
  });
  ui.define({
    'atom-builder': {
      hint: L.builder.hint,
      honesty: ['simplified', 'notToScale'],
      controls: [
        slider(0, BUILDER_RANGES.z.max, BUILDER_PRESETS.hydrogen.protons),
        slider(1, BUILDER_RANGES.n.max, BUILDER_PRESETS.hydrogen.neutrons),
        slider(2, BUILDER_RANGES.z.max + 1, BUILDER_PRESETS.hydrogen.electrons),
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
        { anchor: [2.2, 2.9, 0.5], title: hotspotName('atom-builder', 0) },
        { anchor: [8.5, 0.35, 0.5], title: hotspotName('atom-builder', 1) },
      ],
    },
  });
  qaProbe(ctx, 'builder.symbol', () => result.ionLabel);
  qaProbe(ctx, 'builder.status', () => result.status);
  qaProbe(ctx, 'builder.basket', () => baskets[1]!.group.position.clone().setY(BASKET_Y + 0.5));

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
