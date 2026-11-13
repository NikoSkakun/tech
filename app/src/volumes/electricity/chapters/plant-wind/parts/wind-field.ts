/**
 * `windField` — the wind made visible (document, «Наскрізна візуальна ідея»): translucent `white` streaks
 * streaming with the wind; their length and travel speed follow the wind speed, and behind every rotor they
 * shorten, slow down and darken to `slate` — the wake. Drawn with two alpha-blended `RibbonLines` sets
 * (`blend: 'normal'`: paint, not added light, so the streaks stay visible against the bright day sky and
 * white machines): one white, one slate; a streak in a wake is cross-faded between them.
 *
 * The streaks are advanced on the CPU (a few hundred heads; a per-streak travel offset, so speed changes
 * never make them jump). The darkening is the simulation's own `wakeDeficit` (Jensen expansion, Gaussian
 * cross profile) evaluated at the head of each streak for every rotor upstream of it.
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { RibbonLines, type RibbonLine } from '@/fx';
import { WAKE_K, wakeDeficit } from '@electricity/sim/plant-wind';
import { WIND, flowDir } from '../layout';

export const MAX_WAKES = 20;
/** Points per streak (tail → head). */
const POINTS = 5;
/** Thrust coefficient of a working rotor (document, step 8). */
const CT = 0.8;

export interface WindField {
  group: Group;
  /** Wind speed, m/s: drives streak travel and length. */
  speed: number;
  /** Compass direction the wind comes from, degrees. */
  fromDeg: number;
  /** 0…1 overall visibility (tweenable). */
  opacity: number;
  /** Box the streaks fill: centre x/z, lowest height; extent along the wind, height range, across. */
  readonly centre: Vector3;
  readonly size: Vector3;
  /** Rotor discs that leave wakes: hub position and rotor radius (metres). */
  setWake(i: number, hub: Vector3, radius: number, strength?: number): void;
  setWakeCount(n: number): void;
  update(dt: number): void;
}

interface Streak {
  along: number;
  height: number;
  lateral: number;
  vary: number;
  points: Vector3[];
  white: number[];
  slate: number[];
}

export function buildWindField(ctx: ChapterContext, count = 300): WindField {
  const n = ctx.quality.count(count, 120);
  const rng = ctx.random.fork('wind');
  const streaks: Streak[] = Array.from({ length: n }, () => ({
    along: rng.next(),
    height: rng.next(),
    lateral: rng.next(),
    vary: rng.next(),
    points: Array.from({ length: POINTS }, () => new Vector3()),
    white: new Array<number>(POINTS).fill(0),
    slate: new Array<number>(POINTS).fill(0),
  }));
  const ribbon = (color: 'white' | 'slate'): RibbonLines => {
    const r = new RibbonLines({ capacity: n * POINTS, color, width: 0.62, minPixels: 2.2, intensity: color === 'white' ? 1.25 : 1, dashStrength: 0, base: 1, hotCore: 0, endFade: [0.5, 0.06], blend: 'normal' });
    r.name = `wind-streaks-${color}`;
    r.renderOrder = 4;
    return r;
  };
  const white = ribbon('white');
  const slate = ribbon('slate');
  const group = new Group();
  group.name = 'wind-field';
  group.add(white, slate);
  const whiteLines: RibbonLine[] = streaks.map((s) => ({ points: s.points, brightness: s.white }));
  const slateLines: RibbonLine[] = streaks.map((s) => ({ points: s.points, brightness: s.slate }));
  const wakes = Array.from({ length: MAX_WAKES }, () => ({ hub: new Vector3(0, -9999, 0), radius: 1, strength: 1 }));
  let wakeCount = 0;
  const head = new Vector3();
  const field: WindField = {
    group,
    speed: WIND.speed,
    fromDeg: WIND.fromDeg,
    opacity: 1,
    centre: new Vector3(0, 20, 0),
    size: new Vector3(520, 70, 300),
    setWake(i, hub, radius, strength = 1) {
      const w = wakes[i]!;
      w.hub.copy(hub);
      w.radius = radius;
      w.strength = strength;
    },
    setWakeCount(k) {
      wakeCount = Math.min(k, MAX_WAKES);
    },
    update(dt) {
      const f = flowDir(field.fromDeg);
      const { centre, size } = field;
      const travel = field.speed * WIND.streakSpeed;
      // a streak is as long as the air travels in ≈ 1.1 s at toy speed: a calm is dots, a storm long strokes
      const base = 3 + travel * 1.1;
      const visible = field.opacity * Math.min(1, 0.3 + field.speed / 6);
      for (const s of streaks) {
        head.set(centre.x + f.x * (s.along - 0.5) * size.x - f.z * (s.lateral - 0.5) * size.z, centre.y + s.height * size.y, centre.z + f.z * (s.along - 0.5) * size.x + f.x * (s.lateral - 0.5) * size.z);
        // velocity deficit at the head: every rotor upstream of it (root-sum-square, as the farm model sums wakes)
        let deficit = 0;
        for (let i = 0; i < wakeCount; i++) {
          const w = wakes[i]!;
          const dx = head.x - w.hub.x;
          const dy = head.y - w.hub.y;
          const dz = head.z - w.hub.z;
          const x = dx * f.x + dz * f.z;
          if (x < 0 || x > w.radius * 30) continue;
          const r = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - x * x));
          const d = wakeDeficit(Math.max(x, 0.01), r, w.radius * 2, CT, WAKE_K.onshore) * w.strength * Math.min(1, x / (w.radius * 0.3));
          deficit = Math.hypot(deficit, d);
        }
        const wake = Math.min(1, deficit * 2.2);
        // slower air: the streak advances more slowly and is shorter
        s.along += ((travel * (1 - deficit)) / size.x) * dt;
        if (s.along >= 1) s.along -= Math.floor(s.along);
        const length = base * (0.55 + 0.9 * s.vary) * (1 - 0.6 * deficit);
        const ends = Math.min(1, s.along * 10, (1 - s.along) * 10);
        for (let k = 0; k < POINTS; k++) {
          const u = k / (POINTS - 1);
          const p = s.points[k]!;
          const back = (1 - u) * length;
          p.set(head.x - f.x * back, head.y, head.z - f.z * back);
          // gentle vertical meander so the ribbons feel like air, not rain
          p.y += Math.sin((p.x * f.x + p.z * f.z) * 0.045 + s.vary * 6.2831) * (0.8 + 1.4 * s.height);
          const level = visible * ends * (0.2 + 0.8 * u) * (0.75 + 0.5 * s.lateral);
          s.white[k] = level * (1 - wake) * 0.62;
          s.slate[k] = level * wake * 0.85;
        }
      }
      white.setLines(whiteLines);
      slate.setLines(slateLines);
    },
  };
  return field;
}
