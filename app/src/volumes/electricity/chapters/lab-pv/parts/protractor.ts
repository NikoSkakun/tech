/**
 * The protractor of step 8: the angle of incidence θ drawn at the test module — a `cyan` spoke along the
 * module's normal, an `orange` spoke toward the Sun and the arc between them. Everything is computed in the frame
 * of the object it is added to (`set` takes the centre, the normal and the point toward the Sun in that frame).
 */
import { Vector3 } from 'three';
import { RibbonLines } from '@/fx';

const STEPS = 32;

export interface Protractor {
  lines: RibbonLines;
  normal: RibbonLines;
  /** Midpoint of the arc (callout anchor, same frame). */
  mid: Vector3;
  /** Hidden when the Sun is behind the module (θ ≥ 90°). */
  set(centre: Vector3, normal: Vector3, toSun: Vector3, radius: number): void;
}

export function createProtractor(): Protractor {
  const lines = new RibbonLines({ capacity: STEPS + 4, color: 'orange', width: 0.14, intensity: 1.8, base: 1, dashStrength: 0, blend: 'normal' });
  const normal = new RibbonLines({ capacity: 4, color: 'cyan', width: 0.14, intensity: 1.8, base: 1, dashStrength: 0, blend: 'normal' });
  const arc = Array.from({ length: STEPS + 1 }, () => new Vector3());
  const n = new Vector3();
  const s = new Vector3();
  const u = new Vector3();
  const mid = new Vector3();
  return {
    lines,
    normal,
    mid,
    set(centre, nrm, toSun, radius) {
      n.copy(nrm).normalize();
      s.copy(toSun).sub(centre).normalize();
      const theta = Math.acos(Math.min(1, Math.max(-1, n.dot(s))));
      const on = theta < Math.PI / 2 - 1e-3;
      lines.visible = normal.visible = on;
      if (!on) return;
      // the arc runs in the plane of n and s: p(φ) = c + r·(n cos φ + u sin φ), u ⟂ n toward the Sun
      u.copy(s).addScaledVector(n, -n.dot(s));
      if (u.lengthSq() < 1e-8) u.set(1, 0, 0).cross(n);
      u.normalize();
      arc.forEach((p, i) => {
        const phi = (theta * i) / STEPS;
        p.copy(centre).addScaledVector(n, radius * Math.cos(phi)).addScaledVector(u, radius * Math.sin(phi));
      });
      mid.copy(arc[STEPS >> 1]!);
      lines.setLines([{ points: arc }, { points: [centre.clone(), centre.clone().addScaledVector(s, radius * 1.25)] }]);
      normal.setLines([{ points: [centre.clone(), centre.clone().addScaledVector(n, radius * 1.25)] }]);
    },
  };
}
