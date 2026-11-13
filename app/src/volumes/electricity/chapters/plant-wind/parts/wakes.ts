/**
 * Step 8 farm overlay: behind every rotor a `slate` plume of slow ribbons whose darkness is the velocity
 * deficit of the simulation itself (`wakeDeficit`, Jensen expansion with a Gaussian cross profile, evaluated
 * per point in real metres), deflected for steered turbines exactly as the model deflects it; and above every
 * turbine a `yellow` bar with its power in % of a free-standing turbine.
 * The plumes are alpha-blended `RibbonLines` (paint over the bright field, slow dashes drifting downstream).
 */
import { BoxGeometry, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { fmtPercent } from '@/content';
import { toOverlay } from '@/engine/api';
import { RibbonLines, type RibbonLine } from '@/fx';
import { STEER_YAW_DEG, TURBINE_6MW, thrustCoefficient, turbinePowerW, wakeDeficit, type FarmResult } from '@electricity/sim/plant-wind';
import { K } from '@/style';
import { Text3D } from '@/text';
import { FARM, flowDir } from '../layout';
import type { Farm } from './farm';

/** Points along a plume ribbon and ribbons across a plume. */
const NX = 18;
const NY = 7;
/** Plume length drawn, in rotor diameters. */
const LENGTH_D = 13;

export interface Wakes {
  group: Group;
  /** Redraw plumes, bars and labels from a simulation result. */
  set(result: FarmResult, windFromDeg: number, k: number, vMs: number): void;
}

export function buildWakes(farm: Farm): Wakes {
  const n = FARM.rows * FARM.perRow;
  const plumes = new RibbonLines({ capacity: n * NY * (NX + 1), color: 'slate', width: 1.5, minPixels: 1.6, intensity: 0.85, dashRepeat: 0.14, dashStrength: 0.45, dashSpeed: 5, base: 0.55, hotCore: 0, endFade: [0.02, 0.2], blend: 'normal' });
  plumes.name = 'wake-plumes';
  plumes.renderOrder = 3;
  const lines: (RibbonLine & { points: Vector3[]; brightness: number[] })[] = Array.from({ length: n * NY }, () => ({
    points: Array.from({ length: NX + 1 }, () => new Vector3()),
    brightness: new Array<number>(NX + 1).fill(0),
  }));
  const bars = new InstancedMesh(new BoxGeometry(1, 1, 1).translate(0, 0.5, 0), K.glow({ color: 'yellow', intensity: 1.5, whiten: 0, keepHue: true }), n);
  bars.frustumCulled = false;
  const labels: Text3D[] = Array.from({ length: n }, () => {
    const label = new Text3D('', { font: 'display', size: 18, color: 'yellow', anchorX: 'center', anchorY: 'bottom', billboard: true, screenSpace: true, depthTest: false, depthWrite: false });
    label.renderOrder = 20;
    toOverlay(label);
    return label;
  });
  const group = new Group();
  group.name = 'farm-wakes';
  group.add(plumes, bars, ...labels);
  const hub = new Vector3();
  const m = new Matrix4();
  const q = new Quaternion();
  const dReal = TURBINE_6MW.diameterM;
  const toy = 1 / FARM.realPerToy;
  return {
    group,
    set(result, windFromDeg, k, vMs) {
      const f = flowDir(windFromDeg);
      // left of the flow (the model's positive cross-wind direction), in world XZ
      const lx = f.z;
      const lz = -f.x;
      const single = turbinePowerW(TURBINE_6MW, vMs) || 1;
      const tan = Math.tan((STEER_YAW_DEG * Math.PI) / 180);
      result.turbines.forEach((t, i) => {
        farm.hub(i, hub);
        const ct = thrustCoefficient(t.inflowMs);
        for (let b = 0; b < NY; b++) {
          const line = lines[i * NY + b]!;
          const across = (b / (NY - 1)) * 2 - 1; // −1 … 1 over the plume width
          for (let a = 0; a <= NX; a++) {
            const x = ((a / NX) ** 1.25) * LENGTH_D * dReal; // real metres downstream, denser near the rotor
            const centre = t.yawed ? 0.25 * x * tan : 0;
            const y = across * (dReal / 2 + k * x) * 1.45;
            const cross = (centre + y) * toy;
            line.points[a]!.set(hub.x + f.x * x * toy + lx * cross, hub.y - 0.4, hub.z + f.z * x * toy + lz * cross);
            // darkness = the model's deficit, relative to the deficit right behind a rotor at C_T = 0.8
            line.brightness[a] = Math.min(1, wakeDeficit(Math.max(x, 1), y, dReal, ct, k) / 0.553) * Math.min(1, a / 1.2);
          }
        }
        // power bar and its label above the blade tips
        const share = t.powerW / single;
        const top = hub.y + FARM.rotorDiameter / 2 + 2.5;
        bars.setMatrixAt(i, m.compose(hub.clone().setY(top), q, new Vector3(1.7, Math.max(0.15, share * 9), 1.7)));
        labels[i]!.position.set(hub.x, top + share * 9 + 1.2, hub.z);
        const text = fmtPercent(share, 0);
        if (labels[i]!.text !== text) labels[i]!.text = text;
      });
      plumes.setLines(lines);
      bars.instanceMatrix.needsUpdate = true;
    },
  };
}
