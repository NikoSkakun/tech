/**
 * Step 8 effects on the gas path (world space). Inside the opened precipitator: earthed collecting plates,
 * discharge electrodes between them and short `amber` strokes of the electric field (semantic **E**); every few
 * seconds the plates are rapped and dust falls into the hoppers. In the absorber: a `mist` rain of limestone slurry
 * against the rising gas. Along the path the four species ride as neutral chips: fly ash (`slate`), SO₂ (`mist`),
 * NOₓ (`steel`), CO₂ (`white`). Each pollutant's stream is cut at its cleaner: after it, it keeps only the share
 * the cleaner lets through (model M3) — CO₂ passes everything.
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { boxEmitter, createFlow, createParticles, createRain, type Flow, type ParticleSystem } from '@/fx';
import { Builder } from '@/kit';
import { GAS, ISLAND } from '../layout';
import type { GasPath } from './gas-path';

export type Species = 'dust' | 'so2' | 'nox' | 'co2';

export interface GasFx {
  group: Group;
  /** Share of each species left after its cleaner (0…1, drawn as stream density). */
  setPass(pass: Record<Exclude<Species, 'co2'>, number>): void;
  /** World points where each species is easy to see (callouts) — just ahead of its cleaner. */
  points: Record<Species, Vector3>;
  plates: Group;
  update(dt: number, t: number): void;
}

const g = ISLAND.ground;

export function buildGasFx(ctx: ChapterContext, gas: GasPath): GasFx {
  const group = new Group();
  group.name = 'gas-fx';
  const R = gas.route;
  const z = GAS.z;
  // precipitator internals: plates along the flow, electrode rows between them, field strokes
  const plates = new Group();
  const b = new Builder('esp-internals');
  const e = new Builder('esp-field');
  for (const f of gas.marks.espFields) {
    for (const dz of [-6, -2, 2, 6]) b.box(10, 12, 0.25, { r: 0, slot: 'metal', c: 'steel.light', at: [f.x, g + 8, z + dz] });
    for (const dz of [-4, 0, 4]) {
      for (const dx of [-3, 0, 3]) {
        b.cyl(0.12, 12, { seg: 6, slot: 'metal', c: 'slate', at: [f.x + dx, g + 8, z + dz] });
        for (const dy of [3, 7, 11]) for (const s of [-1, 1]) e.box(0.18, 0.18, 1.5, { r: 0, slot: 'glow', c: 'amber', at: [f.x + dx, g + 8 + dy, z + dz + s * 1.05] });
      }
    }
  }
  plates.add(b.build().group);
  group.add(plates, e.build().group);
  // rapping: dust falls from the plates into the three hoppers
  const falls: ParticleSystem[] = gas.marks.espFields.map((f) => {
    const p = createParticles(ctx, { count: ctx.quality.count(40, 14), loop: false, emitter: boxEmitter([8, 1, 12]), sprite: 'puff', color: ['slate', 'steel'], life: [1.2, 1.8], speed: [0.5, 1.5], size: [0.6, 1.2], gravity: [0, -9, 0], drag: 1.5, blend: 'normal', opacity: 0.85 });
    p.position.set(f.x, g + 14, z);
    group.add(p);
    return p;
  });
  // absorber: limestone slurry rain from the spray headers
  const rain = createRain(ctx, { size: [GAS.fgd.r * 1.6, GAS.fgd.h * 0.5, GAS.fgd.r * 1.6], count: ctx.quality.count(160, 60), speed: 12, color: 'mist', dropSize: 0.25 });
  rain.position.set(GAS.fgd.x, g + GAS.fgd.h * 0.45, z);
  group.add(rain);
  // species streams: [before the cleaner, after it]
  const stream = (pts: Vector3[], color: 'slate' | 'mist' | 'steel' | 'white', radius: number, n: number): Flow =>
    createFlow(ctx, { kind: 'blob', color, paths: pts.map((p) => p.clone()), count: ctx.quality.count(n, Math.ceil(n / 3)), radius, speed: 9, spread: 1.6, halo: false });
  const cut = (i: number): [Vector3[], Vector3[]] => [R.slice(0, i + 1), R.slice(i)];
  const [dustA, dustB] = cut(6);
  const [so2A, so2B] = cut(11);
  const [noxA, noxB] = cut(2);
  const pairs: Record<Exclude<Species, 'co2'>, [Flow, Flow]> = {
    dust: [stream(dustA, 'slate', 0.45, 60), stream(dustB, 'slate', 0.45, 60)],
    so2: [stream(so2A, 'mist', 0.55, 70), stream(so2B, 'mist', 0.55, 40)],
    nox: [stream(noxA, 'steel', 0.55, 14), stream(noxB, 'steel', 0.55, 80)],
  };
  const co2 = stream(R, 'white', 0.5, 110);
  for (const [a, c] of Object.values(pairs)) group.add(a, c);
  group.add(co2);
  let nextRap = 0;
  let rapUntil = 0;
  return {
    group,
    plates,
    points: { dust: R[5]!.clone().add(new Vector3(-2, 3, 0)), so2: R[10]!.clone().add(new Vector3(-4, 3, 0)), nox: R[1]!.clone().add(new Vector3(0, 4, 0)), co2: R[R.length - 1]!.clone().add(new Vector3(0, -18, 0)) },
    setPass(pass) {
      for (const k of ['dust', 'so2', 'nox'] as const) pairs[k][1].density = Math.max(0, Math.min(1, pass[k]));
    },
    update(_dt, t) {
      // rap every 4 s: the plates jerk for 0,25 s, a puff of ash drops into each hopper
      if (t >= nextRap) {
        nextRap = t + 4;
        rapUntil = t + 0.25;
        for (const f of falls) f.emit(16);
      }
      plates.position.y = t < rapUntil ? Math.sin(t * 90) * 0.12 : 0;
    },
  };
}
