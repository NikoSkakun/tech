/**
 * Nuclei as clusters of nucleon orbs (FX characters: protons `coral`, neutrons `mist`→`steel`), the look of
 * `atom/nucleus`. `packCluster` places N touching spheres in a ball (golden spiral in volume + a few rounds of
 * relaxation, deterministic). `createNucleus` returns a swarm whose pose is a pure function of a few numbers:
 * wobble (the trembling liquid drop), stretch (the «dumbbell» of U-236*), the two fragment centres and how
 * round the fragments already are — so the fission animation is random-access (the rig just sets numbers).
 */
import { Group, Vector3 } from 'three';
import { createOrbs, type Orbs } from '@/fx';

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** N points filling a ball so that spheres of radius `r` just touch (packing fraction ≈ 0.6). */
export function packCluster(n: number, r: number): Vector3[] {
  const R = r * Math.cbrt(n / 0.6);
  const pts: Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const rad = R * Math.cbrt((i + 0.5) / n);
    const y = 1 - (2 * ((i * 0.6180339887) % 1));
    const ring = Math.sqrt(1 - y * y);
    pts.push(new Vector3(Math.cos(i * GOLDEN) * ring, y, Math.sin(i * GOLDEN) * ring).multiplyScalar(rad));
  }
  const d = new Vector3();
  const lim = R - r * 0.7;
  for (let it = 0; it < 14; it++) {
    // keep the drop round: nothing pokes out of the ball, then neighbours push apart
    for (const q of pts) if (q.length() > lim) q.setLength(lim);
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        d.subVectors(pts[j]!, pts[i]!);
        const l = d.length();
        if (l > 1e-6 && l < 2 * r) {
          d.multiplyScalar((2 * r - l) / l / 2);
          pts[i]!.sub(d);
          pts[j]!.add(d);
        }
      }
  }
  return pts;
}

export interface NucleusPose {
  /** 0…1 trembling of the drop (U-236* oscillates strongly). */
  wobble: number;
  /** 0…1 elongation into a dumbbell before the split. */
  stretch: number;
  /** Fragment centres (local), used once `split` > 0. */
  heavy: Vector3;
  light: Vector3;
  /** 0 = still one drop … 1 = two round fragments at `heavy` / `light`. */
  split: number;
}

export interface Nucleus {
  group: Group;
  protons: Orbs;
  neutrons: Orbs;
  /** Indices (into the neutron swarm) of the two neutrons that leave as free neutrons at the split. */
  freed: readonly number[];
  pose(p: NucleusPose, t: number): void;
}

/** U-235 → Ba-141 (56 p, 85 n) + Kr-92 (36 p, 56 n) + 3 n (two of the drop's neutrons + the captured one). */
export function createNucleus(r = 0.5, z = 92, a = 235, heavyZ = 56, heavyA = 141): Nucleus {
  const pts = packCluster(a, r);
  // mix protons and neutrons evenly through the drop (deterministic shuffle)
  const order = pts.map((_, i) => i).sort((i, j) => ((i * 7919) % 235) - ((j * 7919) % 235));
  const pIdx = order.slice(0, z);
  const nIdx = order.slice(z);
  const protons = createOrbs({ kind: 'proton', count: z, radius: r });
  const neutrons = createOrbs({ kind: 'neutron', count: a - z, radius: r });
  const group = new Group();
  group.add(protons, neutrons);
  // fragment membership by x (left = heavy): protons 56 / 36; neutrons 85 / 2 free / 56
  const byX = (ids: number[]): number[] => [...ids].sort((i, j) => pts[i]!.x - pts[j]!.x);
  const pSorted = byX(pIdx);
  const nSorted = byX(nIdx);
  const heavyN = heavyA - heavyZ;
  const side = new Map<number, 0 | 1 | 2>(); // 0 heavy, 1 light, 2 freed
  pSorted.forEach((id, k) => side.set(id, k < heavyZ ? 0 : 1));
  nSorted.forEach((id, k) => side.set(id, k < heavyN ? 0 : k < heavyN + 2 ? 2 : 1));
  // packed places inside each round fragment, matched to the nucleons in x order
  const fragPts = [packCluster(heavyA, r), packCluster(a - heavyA - 2, r)];
  const members: number[][] = [[], []];
  for (const id of [...pIdx, ...nIdx].sort((i, j) => pts[i]!.x - pts[j]!.x)) {
    const s = side.get(id)!;
    if (s < 2) members[s]!.push(id);
  }
  const home = new Map<number, Vector3>();
  members.forEach((ids, f) => {
    const places = [...fragPts[f]!].sort((u, v) => u.x - v.x);
    ids.forEach((id, k) => home.set(id, places[k]!));
  });
  const centroid = [0, 1].map((f) => members[f]!.reduce((s, id) => s.add(pts[id]!), new Vector3()).multiplyScalar(1 / members[f]!.length));
  const freed = nIdx.filter((id) => side.get(id) === 2).map((id) => nIdx.indexOf(id));
  const R = r * Math.cbrt(a / 0.6);
  const p = new Vector3();
  const place = (id: number, pose: NucleusPose, t: number): Vector3 => {
    const b = pts[id]!;
    const s = side.get(id)!;
    const sign = s === 0 ? -1 : s === 1 ? 1 : 0;
    // drop: ellipsoidal breathing + jitter, then the dumbbell pulls the halves apart along x
    const breathe = 1 + 0.12 * pose.wobble * Math.sin(t * 9);
    p.set(b.x * breathe, b.y / Math.sqrt(breathe), b.z / Math.sqrt(breathe));
    p.x += sign * pose.stretch * R * 0.75;
    p.y *= 1 - 0.3 * pose.stretch * Math.exp(-((b.x / R) ** 2) * 4);
    const j = 0.06 * pose.wobble * r;
    p.x += j * Math.sin(t * 23 + id);
    p.y += j * Math.sin(t * 19 + id * 1.7);
    if (pose.split > 0 && s < 2) {
      const c = s === 0 ? pose.heavy : pose.light;
      const roundP = home.get(id)!.clone().add(c);
      const moved = p.clone().sub(centroid[s]!).add(c);
      p.copy(moved.lerp(roundP, Math.min(1, pose.split * 1.4)));
    }
    return p;
  };
  return {
    group,
    protons,
    neutrons,
    freed,
    pose(pose, t) {
      pIdx.forEach((id, i) => {
        const q = place(id, pose, t);
        protons.setPosition(i, q.x, q.y, q.z);
      });
      nIdx.forEach((id, i) => {
        const q = place(id, pose, t);
        const gone = pose.split > 0 && side.get(id) === 2;
        neutrons.setPosition(i, q.x, q.y, q.z, gone ? 0 : 1);
      });
      protons.commit();
      neutrons.commit();
    },
  };
}
