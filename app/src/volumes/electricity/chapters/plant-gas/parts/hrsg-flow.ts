/**
 * Flows of the combined cycle (step 6): the flue gas through the boiler in four stretches between the tube
 * bundles, cooling from the turbine exhaust (`orange`) to the stack (`steel`); water and steam in the bundles
 * (economisers `blue`, evaporators `sky`, superheaters `white`+`pink`); HP steam along the line to the steam
 * turbine; the exhaust up the bypass stack when the damper turns; duct-burner flames at the boiler inlet.
 */
import { CatmullRomCurve3, Color, Vector3, type Group } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFlow, createGasFlame, type Flow } from '@/fx';
import { col } from '@/style';
import { BYPASS, HRSG, ISLAND } from '../layout';
import type { Ccgt } from './ccgt';

export interface HrsgFlow {
  gas: Flow[];
  water: Flow[];
  steam: Flow;
  bypass: Flow;
  burners: ReturnType<typeof createGasFlame>[];
  /** Exhaust temperature and stack temperature, °C; boiler on/off; firing 0…1. */
  set(t4: number, tStack: number, on: number, firing: number): void;
}

/** Flue-gas colour: `orange` at the hot end → `steel` at ≈ 90 °C. */
export function flueColor(tC: number, out = new Color()): Color {
  return out.copy(col('steel')).lerp(col('orange'), Math.max(0, Math.min(1, (tC - 80) / 570)));
}

export function buildHrsgFlow(ctx: ChapterContext, parent: Group, ccgt: Ccgt): HrsgFlow {
  const L = HRSG.x1 - HRSG.x0;
  const y0 = ISLAND.y + 1.6;
  const H = HRSG.height - 2;
  const W = HRSG.width - 2.5;
  const lanes = (x0: number, x1: number): { path: Vector3[] }[] => {
    const out: { path: Vector3[] }[] = [];
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 3; j++) {
        const y = y0 + 1.5 + (i / 3) * (H - 3);
        const z = HRSG.z - W / 2 + 1 + (j / 2) * (W - 2) + 0.6;
        out.push({ path: [new Vector3(HRSG.x0 + x0 * L, y, z), new Vector3(HRSG.x0 + x1 * L, y, z)] });
      }
    return out;
  };
  const stretches: [number, number][] = [[0.0, 0.3], [0.3, 0.5], [0.5, 0.72], [0.72, 1.0]];
  const gas = stretches.map(([a, b]) => {
    const f = createFlow(ctx, { kind: 'blob', color: 'orange', paths: lanes(a, b), count: 90, radius: 0.32, speed: 5, spread: 0.3 });
    parent.add(f);
    return f;
  });
  // water / steam: vertical runs at the front of each bundle (up in evaporators and superheaters, down in economisers)
  const byKind = (kind: 'eco' | 'evap' | 'sh'): { path: Vector3[] }[] =>
    ccgt.hrsg.bundles
      .filter((u) => u.kind === kind)
      .flatMap((u) =>
        [W / 2 - 1, 1.5, -2.5].map((z) => {
          const lo = new Vector3(HRSG.x0 + u.x, y0 + 0.6, HRSG.z + z);
          const hi = new Vector3(HRSG.x0 + u.x, y0 + H - 0.4, HRSG.z + z);
          return { path: kind === 'eco' ? [hi, lo] : [lo, hi] };
        }),
      );
  const water = (
    [
      ['eco', 'blue'],
      ['evap', 'sky'],
      ['sh', 'white'],
    ] as const
  ).map(([kind, c]) => {
    const f = createFlow(ctx, { kind: 'blob', color: c, shade: kind === 'sh' ? 'pink' : undefined, paths: byKind(kind), count: 60, radius: 0.22, speed: kind === 'evap' ? 2.4 : 1.6 });
    parent.add(f);
    return f;
  });
  const steam = createFlow(ctx, { kind: 'blob', color: 'white', shade: 'pink', paths: new CatmullRomCurve3(ccgt.steamPath, false, 'catmullrom', 0.1), count: 70, radius: 0.32, speed: 7 });
  parent.add(steam);
  const top = ccgt.bypass.anchorWorld('top');
  const bypass = createFlow(ctx, { kind: 'blob', color: 'orange', paths: [new Vector3(BYPASS.x, ccgt.axisY, 4), new Vector3(BYPASS.x, ccgt.axisY + 3, BYPASS.z), new Vector3(BYPASS.x, top.y - 1, BYPASS.z)], count: 80, radius: 0.5, speed: 8, spread: 1.2 });
  parent.add(bypass);
  const burners = [0.25, 0.5, 0.75].map((f) => {
    const fl = createGasFlame({ height: 3.2, width: 1.4 });
    fl.position.set(HRSG.x0 + 1.4, y0 + f * H - 1.5, HRSG.z + W / 2 - 2);
    fl.rotation.z = -Math.PI / 2; // burn along +X, with the gas
    parent.add(fl);
    return fl;
  });
  const c = new Color();
  return {
    gas,
    water,
    steam,
    bypass,
    burners,
    set(t4, tStack, on, firing) {
      const temps = [t4 + firing * 60, (t4 * 2 + tStack) / 3, (t4 + tStack * 2) / 3, tStack];
      gas.forEach((f, i) => {
        f.setColor(flueColor(temps[i] ?? tStack, c));
        f.density = on;
      });
      for (const f of water) f.density = on;
      steam.density = on;
      bypass.density = 1 - on;
      for (const b of burners) {
        b.power = firing * on;
        b.visible = firing * on > 0.02;
      }
    },
  };
}
