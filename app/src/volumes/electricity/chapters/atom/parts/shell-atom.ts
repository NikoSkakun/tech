/**
 * ShellAtom — an atom drawn as shells K, L, M, N… (steps `shells` and `atom-builder`): a nucleus cluster in
 * the middle, faint glass spheres for the shells and the electrons of each shell spread evenly over it, every
 * shell turning slowly around its own axis. The electrons of the outermost shell are drawn as full hero
 * characters (brighter, with a halo) — the valence electrons. Shells are energy levels, not solid spheres:
 * steps that show it carry the «спрощена модель» chip.
 */
import { Group, Mesh, Quaternion, SphereGeometry, Vector3 } from 'three';
import { damp, type Rng } from '@/engine/api';
import { createOrbs, type Orbs } from '@/fx';
import { K } from '@/style';
import { Nucleus } from './nucleus';

const MAX_SHELLS = 6;
/** Largest shell populations we ever show (Au: 2–8–18–32–18–1; builder / Z ≤ 36: up to 2–8–18–8). */
const SHELL_CAPACITY = [2, 8, 18, 32, 18, 8] as const;
export const shellRadius = (k: number): number => 1.25 + 0.82 * k;

interface Electron {
  shell: number;
  /** Direction on the unit sphere (before the shell's rotation). */
  dir: Vector3;
  scale: number;
  alive: boolean;
}

export interface ShellAtomOptions {
  maxProtons: number;
  maxNeutrons: number;
  /** Scale of the nucleus cluster inside the K shell. */
  nucleusScale?: number;
}

export class ShellAtom {
  readonly group = new Group();
  readonly nucleus: Nucleus;
  private readonly inner: Orbs;
  private readonly outer: Orbs;
  private readonly spheres: Mesh[] = [];
  private readonly sphereScale: number[] = [];
  private readonly electrons: Electron[] = [];
  private readonly axes: Vector3[];
  private counts: number[] = [];
  private outermost = -1;
  private readonly q = new Quaternion();
  private readonly v = new Vector3();

  constructor(rng: Rng, opts: ShellAtomOptions) {
    this.group.name = 'shell-atom';
    this.nucleus = new Nucleus(rng, {
      maxProtons: opts.maxProtons,
      maxNeutrons: opts.maxNeutrons,
      protons: 0,
      neutrons: 0,
    });
    this.nucleus.group.scale.setScalar(opts.nucleusScale ?? 0.2);
    const total = SHELL_CAPACITY.reduce((a, b) => a + b, 0);
    this.inner = createOrbs({ kind: 'electron', count: total, radius: 0.13, halo: false });
    this.outer = createOrbs({ kind: 'electron', count: Math.max(...SHELL_CAPACITY), radius: 0.19 });
    const glass = new SphereGeometry(1, 48, 32);
    for (let k = 0; k < MAX_SHELLS; k++) {
      const sphere = new Mesh(
        glass,
        K.glass({ color: 'sky', opacity: 0.012, edgeOpacity: 0.3, specular: 0.05 }),
      );
      sphere.visible = false;
      this.spheres.push(sphere);
      this.sphereScale.push(0);
      for (let i = 0; i < SHELL_CAPACITY[k]!; i++)
        this.electrons.push({ shell: k, dir: new Vector3(0, 1, 0), scale: 0, alive: false });
    }
    this.axes = Array.from({ length: MAX_SHELLS }, () => new Vector3(...rng.onSphere()));
    this.group.add(this.nucleus.group, ...this.spheres, this.inner, this.outer);
  }

  /** Electrons per shell, e.g. [2, 8, 18, 1]; nucleus composition Z, N. */
  set(protons: number, neutrons: number, shells: readonly number[], instant = false): void {
    this.nucleus.setCounts(protons, neutrons, instant);
    this.counts = shells.slice(0, MAX_SHELLS).map((c, k) => Math.min(c, SHELL_CAPACITY[k]!));
    this.outermost = this.counts.length - 1;
    let offset = 0;
    for (let k = 0; k < MAX_SHELLS; k++) {
      const n = this.counts[k] ?? 0;
      for (let i = 0; i < SHELL_CAPACITY[k]!; i++) {
        const e = this.electrons[offset + i]!;
        e.alive = i < n;
        if (e.alive) {
          // even spread over the sphere (Fibonacci lattice): reads as "n electrons on this shell"
          const y = n === 1 ? 0 : 1 - (2 * (i + 0.5)) / n;
          const r = Math.sqrt(Math.max(1 - y * y, 0));
          const a = i * 2.399963;
          e.dir.set(Math.cos(a) * r, y, Math.sin(a) * r);
        }
        if (instant) e.scale = e.alive ? 1 : 0;
      }
      if (instant) this.sphereScale[k] = n > 0 ? 1 : 0;
      offset += SHELL_CAPACITY[k]!;
    }
  }

  /** Local position of the first electron of the outermost shell (valence electron) this frame. */
  valencePosition(out: Vector3): Vector3 {
    return out.copy(this.v);
  }

  /** Local radius of shell k (0 = K). */
  radiusOf(k: number): number {
    return shellRadius(k);
  }

  update(dt: number, t: number): void {
    this.nucleus.group.rotation.y = t * 0.2;
    this.nucleus.update(dt, t);
    let innerIndex = 0;
    let outerIndex = 0;
    for (const e of this.electrons) {
      e.scale = damp(e.scale, e.alive ? 1 : 0, 9, dt);
      if (e.scale < 0.01) continue;
      const k = e.shell;
      const isOuter = k === this.outermost;
      this.q.setFromAxisAngle(this.axes[k]!, t * (0.5 - 0.05 * k) + k);
      // the valence shell floats a little farther out and breathes
      const r = shellRadius(k) + (isOuter ? 0.22 + 0.08 * Math.sin(t * 1.7) : 0);
      const p = this.v.copy(e.dir).applyQuaternion(this.q).multiplyScalar(r);
      if (isOuter) this.outer.setPosition(outerIndex++, p.x, p.y, p.z, e.scale);
      else this.inner.setPosition(innerIndex++, p.x, p.y, p.z, e.scale);
    }
    // remember the valence electron's place for callouts (recomputed: `v` is scratch above)
    const lead = this.electrons.find((e) => e.shell === this.outermost && e.alive);
    if (lead) {
      this.q.setFromAxisAngle(this.axes[this.outermost]!, t * (0.5 - 0.05 * this.outermost) + this.outermost);
      this.v
        .copy(lead.dir)
        .applyQuaternion(this.q)
        .multiplyScalar(shellRadius(this.outermost) + 0.22);
    }
    this.inner.instances = innerIndex;
    this.outer.instances = outerIndex;
    this.inner.commit();
    this.outer.commit();
    for (let k = 0; k < MAX_SHELLS; k++) {
      const s = (this.sphereScale[k] = damp(this.sphereScale[k]!, (this.counts[k] ?? 0) > 0 ? 1 : 0, 7, dt));
      this.spheres[k]!.visible = s > 0.02;
      this.spheres[k]!.scale.setScalar(shellRadius(k) * Math.max(s, 1e-3));
    }
  }
}
