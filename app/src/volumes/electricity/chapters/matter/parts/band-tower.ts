/**
 * `BandTower` — the 3D band diagram «вежа енергій» (document §3, DECISIONS §16 colours): energy runs up, each
 * allowed band is a platform (valence `violet`, conduction `sky`), the gap between them is a dark `bg.deep` slab.
 * For N = 1…16 atoms the platforms are N thin sub-levels E_k = E₀ − 2t·cos(kπ/(N+1)); for 10²³ they merge into
 * a solid slab. `cyan` electrons fill the states up to the `yellow` dashed Fermi level (copper) or the whole
 * valence band (semiconductors, insulators); `hop()` throws one across the gap and leaves a `coral` hole.
 */
import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, Vector3 } from 'three';
import { createOrbs, type Orbs } from '@/fx';
import { G } from '@/kit';
import { K, SEMANTIC } from '@/style';
import { BAND_LOWER_E0_EV, type BandTower } from '@electricity/sim/matter';

/** World units per eV of the tower (bands are illustrative; only E_g is to scale). */
export const EV = 0.36;
/** Energy at the tower's local y = 0. */
const E_BASE = -8.4;
const W = 2.7;
const D = 1.3;
const LEVELS = 16;
/** Modelled length of the energy axis (it is scaled to the bands shown). */
const AXIS = 6.4;
const SEA = 44;

export const towerY = (eV: number): number => (eV - E_BASE) * EV;

export interface Tower {
  group: Group;
  /** 0…1 per band: share of the sub-level bars vs the merged slab (1 = slab). */
  merged: number;
  /** Animated band edges and levels (eV), written by `setTarget`, eased in `update`. */
  setTarget(t: BandTower, metal: boolean): void;
  /** Throw a valence electron across the gap (semiconductors). Returns false if nothing to throw. */
  hop(): boolean;
  /** Local positions of interesting points (for anchors). */
  fermi: Vector3;
  gapMid: Vector3;
  hole: Vector3;
  /** Tip of the energy axis: it grows only a little above the highest band shown (no empty sky over copper). */
  axisTop: Vector3;
  /** Number of holes currently open. */
  holes: number;
  update(dt: number, t: number): void;
}

interface Band {
  bars: InstancedMesh;
  slab: Mesh;
  levels: number[];
  shown: number[];
  bottom: number;
  top: number;
  showBottom: number;
  showTop: number;
  visible: number;
  want: number;
}

function band(color: 'violet' | 'sky'): Band {
  const bars = new InstancedMesh(
    new BoxGeometry(W, 0.04, D),
    K.glow({ color, whiten: 0, keepHue: true, intensity: 1.25 }),
    LEVELS,
  );
  const slab = new Mesh(G.rbox(W, 1, D, 0.06, 2), K.glass({ color, opacity: 0.55, edgeOpacity: 0.9 }));
  return {
    bars,
    slab,
    levels: [],
    shown: new Array(LEVELS).fill(0),
    bottom: 0,
    top: 0,
    showBottom: 0,
    showTop: 0,
    visible: 0,
    want: 0,
  };
}

export function createBandTower(): Tower {
  const group = new Group();
  group.name = 'band-tower';
  const lower = band('violet');
  const upper = band('sky');
  const gap = new Mesh(G.rbox(W * 0.94, 1, D * 0.94, 0.03, 1), K.toon({ color: 'bg.deep', rim: 0.4 }));
  // vertical energy axis on the left edge with an arrow tip
  const axis = new Group();
  const rod = new Mesh(G.cyl(0.025, AXIS, { seg: 10 }), K.toon({ color: 'mist' }));
  const tip = new Mesh(G.cone(0.08, 0.22, { seg: 16 }), K.toon({ color: 'mist' }));
  tip.position.y = AXIS;
  axis.add(rod, tip);
  axis.position.set(-W / 2 - 0.22, 0, 0);
  // Fermi level: a dashed `yellow` line across the tower front
  const dashes = new Group();
  const dashGeo = new BoxGeometry(0.16, 0.03, 0.03);
  const dashMat = K.glow({ color: SEMANTIC.current, whiten: 0, keepHue: true, intensity: 1.5 });
  for (let i = 0; i < 9; i++) {
    const d = new Mesh(dashGeo, dashMat);
    d.position.set(-W / 2 - 0.1 + i * 0.27, 0, D / 2 + 0.05);
    dashes.add(d);
  }
  const sea = createOrbs({ kind: 'electron', count: SEA, radius: 0.06 });
  const holeOrbs = createOrbs({ kind: 'hole', count: 6, radius: 0.08 });
  const flyer = createOrbs({ kind: 'electron', count: 6, radius: 0.065 });
  group.add(lower.bars, lower.slab, upper.bars, upper.slab, gap, axis, dashes, sea, holeOrbs, flyer);
  return assemble(group, lower, upper, gap, dashes, sea, holeOrbs, flyer, { rod, tip });
}

interface Hop {
  sea: number;
  from: Vector3;
  to: Vector3;
  age: number;
  life: number;
}

const ease = (x: number): number => x * x * (3 - 2 * x);
const hash = (i: number, k: number): number => {
  const s = Math.sin(i * 91.7 + k * 47.3) * 43758.5453;
  return s - Math.floor(s);
};

function assemble(
  group: Group,
  lower: Band,
  upper: Band,
  gap: Mesh,
  dashes: Group,
  sea: Orbs,
  holeOrbs: Orbs,
  flyer: Orbs,
  axis: { rod: Mesh; tip: Mesh },
): Tower {
  let axisH = AXIS;
  let metal = true;
  let count = 1; // atoms in the chain (≤ 16 drawn as levels; more = slab)
  let fermiEv = BAND_LOWER_E0_EV;
  let fermiShown = fermiEv;
  const hops: Hop[] = [];
  const m = new Matrix4();
  const p = new Vector3();
  const seaHome = Array.from({ length: SEA }, () => new Vector3());
  const seaOn = new Float32Array(SEA);

  function placeSea(): void {
    const slab = tower.merged > 0.5;
    const n = Math.min(count, LEVELS);
    // Pauli: two electrons per state; copper's band is half filled, the valence band of the others is full
    const electrons = slab ? (metal ? SEA / 2 : SEA) : metal ? n : 2 * n;
    for (let i = 0; i < SEA; i++) {
      seaOn[i] = i < electrons ? 1 : 0;
      const x = (hash(i, 1) - 0.5) * (W - 0.25);
      const z = (hash(i, 2) - 0.5) * (D - 0.25);
      let e: number;
      if (slab) {
        const top = metal ? fermiEv : lower.top;
        e = lower.bottom + 0.08 + (top - lower.bottom - 0.16) * hash(i, 3);
      } else {
        // two electrons (opposite spins) per sub-level, lowest first
        e = lower.levels[Math.min(Math.floor(i / 2), lower.levels.length - 1)] ?? lower.bottom;
      }
      seaHome[i]!.set(x, towerY(e) + 0.06, z);
    }
  }

  const tower: Tower = {
    group,
    merged: 1,
    fermi: new Vector3(),
    gapMid: new Vector3(),
    hole: new Vector3(),
    axisTop: new Vector3(-W / 2 - 0.22, AXIS, 0),
    holes: 0,
    setTarget(t, isMetal) {
      metal = isMetal;
      count = t.lower.levels.length || 1e23;
      lower.levels = t.lower.levels;
      lower.bottom = t.lower.bottomEv;
      lower.top = t.lower.topEv;
      lower.want = 1;
      if (t.upper) {
        upper.levels = t.upper.levels;
        upper.bottom = t.upper.bottomEv;
        upper.top = t.upper.topEv;
      }
      upper.want = t.upper ? 1 : 0;
      fermiEv = t.fermiEv;
      if (!t.upper) hops.length = 0;
      placeSea();
    },
    hop() {
      if (metal || tower.merged < 0.9 || hops.length >= 6) return false;
      const busy = new Set(hops.map((h) => h.sea));
      // an electron from the top of the valence band
      let best = -1;
      for (let i = 0; i < SEA; i++)
        if (
          seaOn[i] &&
          !busy.has(i) &&
          (best < 0 || seaHome[i]!.y > seaHome[best]!.y - 0.05 * hash(i, hops.length))
        )
          best = i;
      if (best < 0) return false;
      const from = seaHome[best]!.clone();
      const to = new Vector3(from.x * 0.8, towerY(upper.bottom) + 0.12 + 0.3 * hash(best, 7), from.z);
      hops.push({ sea: best, from, to, age: 0, life: 2.6 + 1.8 * hash(best, 9) });
      return true;
    },
    update(dt, t) {
      const want = count > LEVELS ? 1 : 0;
      tower.merged += (want - tower.merged) * Math.min(dt * 2.5, 1);
      if (tower.merged > 0.5 !== want > 0.5 || dt === 0) placeSea();
      fermiShown += (fermiEv - fermiShown) * Math.min(dt * 3, 1);
      for (const b of [lower, upper]) {
        b.visible += (b.want - b.visible) * Math.min(dt * 3, 1);
        b.showBottom += (b.bottom - b.showBottom) * Math.min(dt * 3, 1);
        b.showTop += (b.top - b.showTop) * Math.min(dt * 3, 1);
        const n = Math.min(b.levels.length, LEVELS);
        for (let i = 0; i < LEVELS; i++) {
          const target = i < n ? b.levels[i]! : (b.bottom + b.top) / 2;
          b.shown[i] = b.shown[i]! + (target - b.shown[i]!) * Math.min(dt * 4, 1);
          const s = (i < n ? 1 : 0) * (1 - tower.merged) * b.visible;
          m.makeScale(s, s, s).setPosition(0, towerY(b.shown[i]!), 0);
          b.bars.setMatrixAt(i, m);
        }
        b.bars.instanceMatrix.needsUpdate = true;
        const h = Math.max((b.showTop - b.showBottom) * EV, 0.04);
        b.slab.scale.set(b.visible, h * tower.merged * b.visible + 1e-4, b.visible);
        b.slab.position.y = towerY(b.showBottom) + h / 2;
      }
      const g0 = towerY(lower.showTop);
      const g1 = towerY(upper.showBottom);
      gap.visible = upper.visible > 0.02;
      gap.scale.set(1, Math.max(g1 - g0, 0.01) * tower.merged, upper.visible);
      gap.position.y = (g0 + g1) / 2;
      dashes.position.y = towerY(fermiShown);
      dashes.visible = tower.merged > 0.5;
      tower.fermi.set(W / 2 + 0.2, towerY(fermiShown), D / 2);
      tower.gapMid.set(W / 2 + 0.1, (g0 + g1) / 2, 0);
      const topEv = lower.showTop + Math.max(upper.showTop - lower.showTop, 0) * upper.visible;
      axisH += (towerY(topEv) + 1.1 - axisH) * Math.min(dt * 3, 1);
      axis.rod.scale.y = axisH / AXIS;
      axis.tip.position.y = axisH;
      tower.axisTop.set(-W / 2 - 0.22, axisH, 0);
      // electrons of the sea: a gentle sideways shuffle (copper: they slide along the band)
      const busy = new Map(hops.map((hp, k) => [hp.sea, k]));
      for (let i = 0; i < SEA; i++) {
        const home = seaHome[i]!;
        const wob = metal ? 0.35 : 0.05;
        p.set(
          home.x + wob * Math.sin(t * (0.6 + hash(i, 4)) + i),
          home.y + 0.02 * Math.sin(t * 3 + i * 1.3),
          home.z + 0.05 * Math.cos(t * (0.7 + hash(i, 5)) + i),
        );
        p.x = Math.max(-W / 2 + 0.1, Math.min(W / 2 - 0.1, p.x));
        const s = seaOn[i]! * lower.visible * (busy.has(i) ? 0 : 1);
        sea.setPosition(i, p.x, p.y, p.z, s);
      }
      sea.commit();
      // hops: up across the gap, a while in the conduction band, back down into the hole (recombination)
      for (let k = hops.length - 1; k >= 0; k--) {
        const hp = hops[k]!;
        hp.age += dt;
        if (hp.age > hp.life || metal) hops.splice(k, 1);
      }
      for (let k = 0; k < 6; k++) {
        const hp = hops[k];
        if (!hp) {
          flyer.setPosition(k, 0, 0, 0, 0);
          holeOrbs.setPosition(k, 0, 0, 0, 0);
          continue;
        }
        const up = ease(Math.min(hp.age / 0.6, 1));
        const down = ease(Math.max((hp.age - hp.life + 0.5) / 0.5, 0));
        const f = up * (1 - down);
        p.lerpVectors(hp.from, hp.to, f);
        p.y += Math.sin(f * Math.PI) * 0.25;
        if (up >= 1 && down === 0) p.x += 0.3 * Math.sin(t * 1.4 + k);
        flyer.setPosition(k, p.x, p.y, p.z, 1);
        holeOrbs.setPosition(k, hp.from.x, hp.from.y, hp.from.z, up * (1 - down));
        tower.hole.copy(hp.from);
      }
      flyer.commit();
      holeOrbs.commit();
      tower.holes = hops.length;
    },
  };
  return tower;
}
