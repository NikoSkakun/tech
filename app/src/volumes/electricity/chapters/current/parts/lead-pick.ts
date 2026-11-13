/** Nearest point on a set of leads to a point on the table — for dragging the lens along the wires. */
import { type Vector3 } from 'three';
import type { Lead } from './leads';

const SAMPLES = 96;
const cache = new WeakMap<Lead, Vector3[]>();
const samplesOf = (lead: Lead): Vector3[] => {
  let pts = cache.get(lead);
  if (!pts) {
    pts = lead.curve.getSpacedPoints(SAMPLES);
    cache.set(lead, pts);
  }
  return pts;
};

/**
 * `u` is the arc-length parameter 0…1 on `leads[lead]`, kept inside `[margin, 1 − margin]` so the lens never
 * sits on a terminal. Distances are measured in the table plane.
 */
export function nearestOnLeads(
  leads: readonly Lead[],
  p: Vector3,
  margin = 0.1,
): { lead: number; u: number } {
  let best = { lead: 0, u: 0.5 };
  let dBest = Infinity;
  leads.forEach((lead, k) => {
    const pts = samplesOf(lead);
    const from = Math.ceil(margin * SAMPLES);
    for (let i = from; i <= SAMPLES - from; i++) {
      const q = pts[i]!;
      const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
      if (d < dBest) {
        dBest = d;
        best = { lead: k, u: i / SAMPLES };
      }
    }
  });
  return best;
}
