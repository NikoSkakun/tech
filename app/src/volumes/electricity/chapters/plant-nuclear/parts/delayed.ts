/**
 * The delayed-neutron «timer» of step 4: a fission fragment (a small coral/steel cluster, a precursor such as
 * Br-87) sits and waits; a ring around it fills up over the mean delay (≈ 13 s, real time), then the fragment
 * lets a neutron go (it flies off with a trail) and the clock starts again.
 */
import { Group, Vector3 } from 'three';
import { RibbonLines, createNeutron, createOrbs, createTrail } from '@/fx';
import { packCluster } from './nucleus';

export const MEAN_DELAY_S = 13;

export interface Delayed {
  group: Group;
  /** Seconds left until the next delayed neutron. */
  left: number;
  update(dt: number, t: number): void;
  reset(): void;
}

export function buildDelayed(): Delayed {
  const group = new Group();
  const pts = packCluster(36, 0.42);
  const p = createOrbs({ kind: 'proton', count: 15, radius: 0.42 });
  const n = createOrbs({ kind: 'neutron', count: 21, radius: 0.42 });
  pts.forEach((q, i) => (i < 15 ? p.setPosition(i, q.x, q.y, q.z) : n.setPosition(i - 15, q.x, q.y, q.z)));
  p.commit();
  n.commit();
  const cluster = new Group();
  cluster.add(p, n);
  group.add(cluster);
  const ring = new RibbonLines({ capacity: 70, color: 'violet.light', width: 0.32, intensity: 1.2, blend: 'normal' });
  const track = new RibbonLines({ capacity: 70, color: 'slate', width: 0.26, intensity: 0.7, blend: 'normal' });
  group.add(track, ring);
  const arc = (frac: number): Vector3[] => {
    const m = Math.max(2, Math.round(64 * frac));
    return Array.from({ length: m + 1 }, (_, i) => {
      const a = Math.PI / 2 - (i / m) * frac * Math.PI * 2;
      return new Vector3(Math.cos(a) * 3.6, Math.sin(a) * 3.6, 0);
    });
  };
  track.setLines([{ points: arc(1), closed: true }]);
  const out = createNeutron({ radius: 0.5 });
  const trail = createTrail(out, { color: 'mist', duration: 0.8, width: 0.3 });
  group.add(out, trail);
  const dir = new Vector3(0.7, 0.55, 0.45).normalize();
  let since = 99;
  const d: Delayed = {
    group,
    left: MEAN_DELAY_S,
    reset() {
      d.left = MEAN_DELAY_S;
      since = 99;
      trail.reset();
    },
    update(dt, t) {
      d.left -= dt;
      since += dt;
      if (d.left <= 0) {
        d.left = MEAN_DELAY_S;
        since = 0;
        trail.reset();
      }
      ring.setLines([{ points: arc(1 - d.left / MEAN_DELAY_S) }]);
      out.position.copy(dir).multiplyScalar(1.5 + since * 9);
      out.scale.setScalar(since < 2.2 ? 1 : 0.001);
      trail.visible = since < 2.6;
      // waiting fragment trembles a little, more just before it lets go
      const k = 0.05 + 0.25 * Math.max(0, 1 - d.left / 2);
      cluster.position.set(Math.sin(t * 17) * k, Math.sin(t * 13 + 1) * k, 0);
      cluster.rotation.y = t * 0.3;
    },
  };
  return d;
}
