/**
 * What flows through the hero gas turbine (steps 3–5): air and hot gas as five flows along the annulus — inlet +
 * front compressor, rear compressor, combustor, turbine, exhaust — each tinted by the model's temperature at that
 * station (`gasColor`: 15 °C `sky` → ≈ 450 °C `amber` → `orange` → ≈ 1600 °C near-`white`); `violet` fuel from
 * the ring into the burners; a flickering ring of flame in the combustor. Paths are in the GT's local frame.
 */
import { Color, Mesh, Vector3, type Group } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFlow, type Flow } from '@/fx';
import { G } from '@/kit';
import { K, col, type KGlowMaterial } from '@/style';
import { GT_STAGES, GT_X } from './gt-model';

/** Gas colour by temperature, °C (semantic: cold `sky`, heat `orange` → hot near-white). */
export function gasColor(tC: number, out = new Color()): Color {
  const stops: [number, Color][] = [
    [15, col('sky')],
    [450, col('amber')],
    [800, col('orange')],
    [1250, col('orange').lerp(col('yellow'), 0.5)],
    [1650, col('yellow').lerp(col('white'), 0.7)],
  ];
  if (tC <= stops[0]![0]) return out.copy(stops[0]![1]);
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i]!;
    const [t0, c0] = stops[i - 1]!;
    if (tC <= t1) return out.copy(c0).lerp(c1, (tC - t0) / (t1 - t0));
  }
  return out.copy(stops[stops.length - 1]![1]);
}

export interface GtFlow {
  flows: Record<'inlet' | 'comp' | 'burn' | 'turb' | 'exhaust', Flow>;
  fuel: Flow;
  flame: Mesh;
  /** Temperatures at the stations, °C: inlet, compressor exit, turbine inlet, exhaust. */
  setTemps(t1: number, t2: number, t3: number, t4: number): void;
  /** Overall speed / density 0…1 (0 = machine stopped). */
  setLoad(load: number): void;
  update(t: number): void;
}

/** Annulus paths between stations x0 → x1 with radius r0 → r1, `n` of them around the axis. */
function annulus(x0: number, x1: number, r0: number, r1: number, n: number, phase = 0): { path: Vector3[] }[] {
  return Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    const pts: Vector3[] = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      const r = r0 + (r1 - r0) * t;
      pts.push(new Vector3(x0 + (x1 - x0) * t, Math.cos(a) * r, Math.sin(a) * r));
    }
    return { path: pts };
  });
}

export function buildGtFlow(ctx: ChapterContext, parent: Group): GtFlow {
  const X = GT_X;
  const n = 10;
  const mk = (paths: { path: Vector3[] }[], count: number, speed: number, radius: number): Flow => {
    const f = createFlow(ctx, { kind: 'blob', color: 'sky', paths, count, radius, speed, spread: 0.12 });
    parent.add(f);
    return f;
  };
  const flows = {
    inlet: mk(annulus(X.plenum0 + 0.4, X.comp0 + 2.2, 1.6, 1.12, n), 160, 2.6, 0.075),
    comp: mk(annulus(X.comp0 + 2.2, X.burn0 + 0.3, 1.12, 1.0, n, 0.2), 200, 1.7, 0.07),
    burn: mk(annulus(X.burn0 + 0.3, X.turb0, 1.45, 1.0, n, 0.1), 140, 2.4, 0.09),
    turb: mk(annulus(X.turb0, X.turb1, 1.0, 1.3, n, 0.3), 140, 3.6, 0.08),
    exhaust: mk(annulus(X.turb1, X.end - 0.1, 1.35, 1.95, n, 0.4), 120, 4.6, 0.08),
  };
  // fuel: from the ring (r 2.42) into each burner (r 1.42)
  const fuelPaths = Array.from({ length: GT_STAGES.burners }, (_, i) => {
    const a = (i / GT_STAGES.burners) * Math.PI * 2;
    return { path: [new Vector3(X.burn0 + 0.05, Math.cos(a) * 2.42, Math.sin(a) * 2.42), new Vector3(X.burn0 + 0.2, Math.cos(a) * 1.5, Math.sin(a) * 1.5), new Vector3(X.burn0 + 0.6, Math.cos(a) * 1.45, Math.sin(a) * 1.45)] };
  });
  const fuel = createFlow(ctx, { kind: 'blob', color: 'violet', paths: fuelPaths, count: 70, radius: 0.06, speed: 1.2 });
  parent.add(fuel);
  const flame = new Mesh(G.ring(1.45, 0.32, 48, 10), K.glow({ color: 'orange', intensity: 1.6, whiten: 0.45 }));
  flame.rotation.z = Math.PI / 2; // the kit ring lies in XZ: turn its axis onto the shaft (X)
  flame.position.x = X.burn0 + 0.95;
  parent.add(flame);
  const c = new Color();
  return {
    flows,
    fuel,
    flame,
    setTemps(t1, t2, t3, t4) {
      flows.inlet.setColor(gasColor((t1 * 2 + t2) / 3, c));
      flows.comp.setColor(gasColor((t1 + t2 * 3) / 4, c));
      flows.burn.setColor(gasColor(t3 * 0.92, c));
      flows.turb.setColor(gasColor((t3 + t4) / 2, c));
      flows.exhaust.setColor(gasColor(t4, c));
      (flame.material as KGlowMaterial).setColor(gasColor(t3, c));
    },
    setLoad(load) {
      for (const f of Object.values(flows)) f.density = load;
      fuel.density = load;
      flame.visible = load > 0.05;
    },
    update(t) {
      const flick = 1 + 0.06 * Math.sin(t * 23) + 0.04 * Math.sin(t * 37 + 1.3);
      flame.scale.set(1, flick, 1);
    },
  };
}
