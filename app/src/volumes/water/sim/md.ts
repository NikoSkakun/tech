/**
 * Molecular dynamics of a thin slab of water — the solver behind every molecular scene of the volume.
 *
 * WHAT IS MODELLED. Each molecule is a rigid body: a position (3D) and an orientation (quaternion). It carries four
 * arms in the true geometry of H₂O: two hydrogen arms 104.5° apart (the «+» side) and two lone-pair arms on the
 * other side of the oxygen (the «−» side), close to a tetrahedron. Two molecules interact by
 *   - a Lennard-Jones core between the oxygens (soft repulsion, weak attraction), and
 *   - a hydrogen bond: a hydrogen arm of one molecule pointing at a lone-pair arm of the other, strongest at the
 *     O···O distance 1 (= 0.276 nm) and when both arms lie along the line between the oxygens (Gaussians in the
 *     distance and in both angles). This is the «Mercedes-Benz» family of water models (Ben-Naim 1971; Bizjak,
 *     Urbic, Vlachy, Dill 2009 for 3D) with donors told from acceptors.
 * The molecules live in a slab: free within |z| < `slab`, pushed back beyond it. A slab one molecule thick is a
 * basal slice of ordinary ice: every molecule has three neighbours in the layer, the fourth arm points out of it.
 *
 * WHAT EMERGES (nothing of this is scripted): the open hexagonal sheet at low temperature, its collapse into a
 * denser liquid, bonds that break and re-form, vapour, the temperature that stops rising while the sheet melts.
 *
 * STATED SIMPLIFICATIONS: classical rigid molecules (no vibration inside a molecule, no quantum effects); one
 * moment of inertia for all axes (a spherical top; equilibrium structure does not depend on it); one layer instead
 * of bulk; the density drop on freezing is larger than the real 9 %; temperatures are mapped to °C by two points
 * (melting, boiling) in `scale.ts`.
 *
 * UNITS (reduced): length 0.276 nm; energy = one hydrogen bond (≈ 23 kJ/mol); mass = one molecule; k_B = 1.
 * Time unit ≈ 0.25 ps. Deterministic: fixed step, no randomness after the initial state.
 *
 * No imports: the file runs under plain Node for tuning (`sim/README.md`).
 */

/** Reduced length unit in nanometres: the O···O distance of a hydrogen bond in ice at 0 °C. */
export const UNIT_NM = 0.276;
/** O–H bond length, reduced (0.0957 nm). */
export const OH_LENGTH = 0.0957 / UNIT_NM;
/** Half of the H–O–H angle 104.5°, radians. */
export const HALF_HOH = (104.5 / 2) * (Math.PI / 180);
/** Body-frame arms: hydrogens in the xy plane about +x, lone pairs in the xz plane about −x (tetrahedral 109.47°). */
const HX = Math.cos(HALF_HOH);
const HY = Math.sin(HALF_HOH);
const LX = -Math.sqrt(1 / 3);
const LZ = Math.sqrt(2 / 3);

export interface MdConfig {
  /** Capacity: molecules are added with `add()` up to this number. */
  capacity: number;
  /** Inner box: walls at x = 0, x = width, y = 0; the lid (or the open top) at y = height. */
  width: number;
  height: number;
  /** Lennard-Jones core: depth and diameter (bond energy = 1, bond length = 1). */
  epsLJ?: number;
  sigmaLJ?: number;
  /** Widths of the hydrogen-bond Gaussians: in distance, and in the angle (radians) between an arm and the bond. */
  bondWidthR?: number;
  bondWidthA?: number;
  /** Moment of inertia (all axes). */
  inertia?: number;
  /** Half-thickness of the free slab and the stiffness of its walls. */
  slab?: number;
  slabK?: number;
  /** Stiffness of the box walls. */
  wallK?: number;
  /**
   * Depth of the walls' pull on a molecule (the floor and both side walls; 0 = none): water wets glass, so the
   * liquid spreads over the floor and climbs the walls a little instead of balling up.
   */
  adhesion?: number;
  /** Acceleration toward y = 0 (keeps the liquid on the bottom; far stronger than real gravity at this size). */
  gravity?: number;
  /** Time step. */
  dt?: number;
}

/**
 * How heat enters or leaves: a bath at `temperature` with relaxation time `tau`, or a constant `power`.
 * With `below`, only molecules lower than that height exchange heat (a hot plate under the sample).
 */
export type Heating =
  | { mode: 'off' }
  | { mode: 'bath'; temperature: number; tau: number; below?: number }
  | { mode: 'power'; power: number; below?: number }
  /** Two baths: molecules left of x = `at` are held at `left`, the others at `right`. */
  | { mode: 'halves'; at: number; left: number; right: number; tau: number };

/** The lid: absent (molecules that pass y = height are gone), fixed, or a piston under a pressure. */
export type Lid = { mode: 'open' } | { mode: 'fixed' } | { mode: 'piston'; pressure: number; mass: number; damping: number };

const RC = 2.0; // cut-off of the core, reduced units

export class WaterMd {
  readonly capacity: number;
  readonly width: number;
  readonly height: number;
  readonly epsLJ: number;
  readonly sigmaLJ: number;
  readonly wR: number;
  readonly wA: number;
  readonly inertia: number;
  readonly slab: number;
  readonly slabK: number;
  readonly wallK: number;
  readonly adhesion: number;
  gravity: number;
  dt: number;
  heating: Heating = { mode: 'off' };
  lid: Lid = { mode: 'fixed' };
  /** Height of the lid now (= `height` unless it is a piston) and its speed. */
  lidY: number;
  lidV = 0;
  /** Simulated time. */
  time = 0;
  /** Molecules added so far (slots 0 … count − 1); `alive[i]` = 0 once molecule i left through the open top. */
  count = 0;
  readonly alive: Uint8Array;
  readonly pos: Float64Array;
  readonly vel: Float64Array;
  /** Orientation quaternions (w, x, y, z) and angular velocities in the world frame. */
  readonly quat: Float64Array;
  readonly omega: Float64Array;
  /** World-frame unit arms, 12 per molecule: H1, H2, L1, L2. */
  readonly arms: Float64Array;
  readonly force: Float64Array;
  readonly torque: Float64Array;
  /** Per hydrogen (2 per molecule): strength 0…1 of its best bond and the molecule it points at (−1: none). */
  readonly bond: Float32Array;
  readonly bondTo: Int32Array;
  /** Per molecule: kinetic energy (translation + rotation), smoothed over ≈ `speedMemory` time units. */
  readonly warmth: Float32Array;
  speedMemory = 0.6;
  /**
   * A partition at this x (null: none): a molecule stays on the side where `placePartition` found it.
   */
  partition: number | null = null;
  private readonly side: Int8Array;
  /** Potential energy and kinetic temperature after the last step. */
  potential = 0;
  temperature = 0;
  /** Heat that entered through the bath or the heater since the start (reduced energy units). */
  heatIn = 0;
  private readonly lj0: number;
  private readonly cellHead: Int32Array;
  private readonly cellNext: Int32Array;
  private readonly nx: number;
  private ny: number;

  constructor(cfg: MdConfig) {
    const n = (this.capacity = cfg.capacity);
    this.width = cfg.width;
    this.height = this.lidY = cfg.height;
    this.epsLJ = cfg.epsLJ ?? 0.35;
    this.sigmaLJ = cfg.sigmaLJ ?? 0.84;
    this.wR = cfg.bondWidthR ?? 0.11;
    this.wA = cfg.bondWidthA ?? 0.36;
    this.inertia = cfg.inertia ?? 0.035;
    this.slab = cfg.slab ?? 0.2;
    this.slabK = cfg.slabK ?? 60;
    this.wallK = cfg.wallK ?? 120;
    this.adhesion = cfg.adhesion ?? 0;
    this.gravity = cfg.gravity ?? 0;
    this.dt = cfg.dt ?? 0.006;
    this.alive = new Uint8Array(n);
    this.pos = new Float64Array(3 * n);
    this.vel = new Float64Array(3 * n);
    this.quat = new Float64Array(4 * n);
    this.omega = new Float64Array(3 * n);
    this.arms = new Float64Array(12 * n);
    this.force = new Float64Array(3 * n);
    this.torque = new Float64Array(3 * n);
    this.bond = new Float32Array(2 * n);
    this.bondTo = new Int32Array(2 * n).fill(-1);
    this.warmth = new Float32Array(n);
    this.side = new Int8Array(n);
    const s6 = (this.sigmaLJ / RC) ** 6;
    this.lj0 = 4 * this.epsLJ * (s6 * s6 - s6);
    this.nx = Math.max(1, Math.floor(this.width / RC));
    this.ny = 1;
    this.cellHead = new Int32Array(this.nx * 512);
    this.cellNext = new Int32Array(n);
  }

  /** Add a molecule; returns its index. `q` = (w, x, y, z), unit length. */
  add(p: readonly number[], q: readonly number[], v: readonly number[] = [0, 0, 0], w: readonly number[] = [0, 0, 0]): number {
    const i = this.count++;
    if (i >= this.capacity) throw new Error('WaterMd: capacity exceeded');
    this.alive[i] = 1;
    for (let k = 0; k < 3; k++) {
      this.pos[3 * i + k] = p[k]!;
      this.vel[3 * i + k] = v[k]!;
      this.omega[3 * i + k] = w[k]!;
    }
    for (let k = 0; k < 4; k++) this.quat[4 * i + k] = q[k]!;
    return i;
  }

  /** Molecules still in the box. */
  get living(): number {
    let n = 0;
    for (let i = 0; i < this.count; i++) n += this.alive[i]!;
    return n;
  }

  /** Refresh the world-frame arms from the quaternions. */
  private updateArms(): void {
    const { quat: Q, arms: A } = this;
    for (let i = 0; i < this.count; i++) {
      const w = Q[4 * i]!, x = Q[4 * i + 1]!, y = Q[4 * i + 2]!, z = Q[4 * i + 3]!;
      // columns of the rotation matrix: images of the body axes x, y, z
      const xx = 1 - 2 * (y * y + z * z), xy = 2 * (x * y + w * z), xz = 2 * (x * z - w * y);
      const yx = 2 * (x * y - w * z), yy = 1 - 2 * (x * x + z * z), yz = 2 * (y * z + w * x);
      const zx = 2 * (x * z + w * y), zy = 2 * (y * z - w * x), zz = 1 - 2 * (x * x + y * y);
      const o = 12 * i;
      A[o] = HX * xx + HY * yx; A[o + 1] = HX * xy + HY * yy; A[o + 2] = HX * xz + HY * yz;
      A[o + 3] = HX * xx - HY * yx; A[o + 4] = HX * xy - HY * yy; A[o + 5] = HX * xz - HY * yz;
      A[o + 6] = LX * xx + LZ * zx; A[o + 7] = LX * xy + LZ * zy; A[o + 8] = LX * xz + LZ * zz;
      A[o + 9] = LX * xx - LZ * zx; A[o + 10] = LX * xy - LZ * zy; A[o + 11] = LX * xz - LZ * zz;
    }
  }

  /** Forces, torques, potential energy and the bond list for the positions and orientations now. */
  computeForces(): void {
    const { pos: P, force: F, torque: T, count, alive } = this;
    this.updateArms();
    F.fill(0, 0, 3 * count);
    T.fill(0, 0, 3 * count);
    this.bond.fill(0, 0, 2 * count);
    this.bondTo.fill(-1, 0, 2 * count);
    let pot = 0;
    let lidPush = 0;
    const { width, wallK, slab, slabK, gravity } = this;
    const open = this.lid.mode === 'open';
    for (let i = 0; i < count; i++) {
      if (!alive[i]) continue;
      const x = P[3 * i]!, y = P[3 * i + 1]!, z = P[3 * i + 2]!;
      if (x < 0) { F[3 * i]! -= wallK * x; pot += 0.5 * wallK * x * x; }
      else if (x > width) { const d = x - width; F[3 * i]! -= wallK * d; pot += 0.5 * wallK * d * d; }
      if (y < 0) { F[3 * i + 1]! -= wallK * y; pot += 0.5 * wallK * y * y; }
      else if (y > this.lidY) {
        if (open) { alive[i] = 0; continue; }
        const d = y - this.lidY;
        F[3 * i + 1]! -= wallK * d; pot += 0.5 * wallK * d * d; lidPush += wallK * d;
      }
      if (this.adhesion > 0) {
        // each wall pulls with −A·exp(−d² / 2s²), d = distance to the wall, s = 0.6
        const A = this.adhesion;
        for (let w = 0; w < 3; w++) {
          const d = w === 0 ? x : w === 1 ? width - x : y;
          if (d <= 0 || d > 2) continue;
          const g = A * Math.exp(-d * d * 1.3889);
          pot -= g;
          const f = g * d * 2.7778; // toward the wall
          if (w === 0) F[3 * i]! -= f;
          else if (w === 1) F[3 * i]! += f;
          else F[3 * i + 1]! -= f;
        }
      }
      if (this.partition !== null) {
        // half a molecule of room on each side of the partition
        const d = this.side[i]! < 0 ? x - (this.partition - 0.4) : this.partition + 0.4 - x;
        if (d > 0) { F[3 * i]! -= wallK * d * -this.side[i]!; pot += 0.5 * wallK * d * d; }
      }
      const az = Math.abs(z) - slab;
      if (az > 0) { F[3 * i + 2]! -= slabK * az * Math.sign(z); pot += 0.5 * slabK * az * az; }
      F[3 * i + 1]! -= gravity;
      pot += gravity * y;
    }
    this.lidPush = lidPush;
    // cell list over x, y
    const nx = this.nx;
    const cw = width / nx;
    const ny = (this.ny = Math.min(512, Math.max(1, Math.ceil((this.lidY + 1) / RC))));
    const head = this.cellHead, next = this.cellNext;
    head.fill(-1, 0, nx * ny);
    for (let i = 0; i < count; i++) {
      if (!alive[i]) continue;
      let cx = Math.floor(P[3 * i]! / cw), cy = Math.floor(P[3 * i + 1]! / RC);
      cx = cx < 0 ? 0 : cx >= nx ? nx - 1 : cx;
      cy = cy < 0 ? 0 : cy >= ny ? ny - 1 : cy;
      const c = cy * nx + cx;
      next[i] = head[c]!;
      head[c] = i;
    }
    for (let cy = 0; cy < ny; cy++)
      for (let cx = 0; cx < nx; cx++) {
        const c = cy * nx + cx;
        for (let i = head[c]!; i >= 0; i = next[i]!) {
          for (let j = next[i]!; j >= 0; j = next[j]!) pot += this.pair(i, j);
          // half of the neighbouring cells: E, NW, N, NE
          if (cx + 1 < nx) for (let j = head[c + 1]!; j >= 0; j = next[j]!) pot += this.pair(i, j);
          if (cy + 1 < ny) {
            const up = c + nx;
            if (cx > 0) for (let j = head[up - 1]!; j >= 0; j = next[j]!) pot += this.pair(i, j);
            for (let j = head[up]!; j >= 0; j = next[j]!) pot += this.pair(i, j);
            if (cx + 1 < nx) for (let j = head[up + 1]!; j >= 0; j = next[j]!) pot += this.pair(i, j);
          }
        }
      }
    this.potential = pot;
  }

  /** Sum of the molecules' push on the lid (force, ≥ 0) after the last `computeForces`. */
  lidPush = 0;

  /** One pair: adds forces and torques, returns its potential energy. */
  private pair(i: number, j: number): number {
    const { pos: P, force: F } = this;
    const dx = P[3 * j]! - P[3 * i]!, dy = P[3 * j + 1]! - P[3 * i + 1]!, dz = P[3 * j + 2]! - P[3 * i + 2]!;
    const r2 = dx * dx + dy * dy + dz * dz;
    if (r2 >= RC * RC) return 0;
    // Lennard-Jones, shifted to zero at the cut-off; below r = 0.6 σ the force is held (two molecules thrown at
    // each other by a careless initial state must not explode the step)
    const sg2 = this.sigmaLJ * this.sigmaLJ;
    const q2 = Math.max(r2, 0.36 * sg2);
    const s2 = sg2 / q2, s6 = s2 * s2 * s2;
    let e = 4 * this.epsLJ * (s6 * s6 - s6) - this.lj0;
    const fr = (24 * this.epsLJ * (2 * s6 * s6 - s6)) / q2; // force on j = fr · d
    let gx = -fr * dx, gy = -fr * dy, gz = -fr * dz; // gradient of the energy in d = r_j − r_i
    const r = Math.sqrt(r2);
    const dr = r - 1;
    const wR = this.wR;
    if (dr < 3.3 * wR && dr > -3.3 * wR) {
      const inv = 1 / r;
      const ux = dx * inv, uy = dy * inv, uz = dz * inv;
      const gr = Math.exp((-dr * dr) / (2 * wR * wR));
      const dgr = (-dr / (wR * wR)) * gr;
      // donor i → acceptor j, then donor j → acceptor i (the line between the oxygens seen from the donor: ±u)
      e += this.bondTerms(i, j, 1, ux, uy, uz, inv, gr, dgr);
      e += this.bondTerms(j, i, -1, ux, uy, uz, inv, gr, dgr);
      gx += this.gx; gy += this.gy; gz += this.gz;
      this.gx = this.gy = this.gz = 0;
    }
    F[3 * i]! += gx; F[3 * i + 1]! += gy; F[3 * i + 2]! += gz;
    F[3 * j]! -= gx; F[3 * j + 1]! -= gy; F[3 * j + 2]! -= gz;
    return e;
  }

  /** Forces are known for the state now (false until the first step and after an outside change of the state). */
  primed = false;
  private gx = 0;
  private gy = 0;
  private gz = 0;

  /**
   * Hydrogen arms of `d` (donor) against lone-pair arms of `a` (acceptor). `s` = +1 when u points from the donor to
   * the acceptor, −1 otherwise. Energy of one arm pair: −g(r) · A(c₁) · A(c₂), where c₁ = h·(s·u) and
   * c₂ = l·(−s·u) are the cosines between each arm and the line to the other oxygen, A(c) = exp(−(1 − c) / w²) —
   * for small angles θ a Gaussian exp(−θ² / 2w²), so a bent bond is pulled straight in proportion to the bend.
   * Accumulates the gradient in d = r_j − r_i into (gx, gy, gz) and the torques −arm × ∂E/∂arm.
   */
  private bondTerms(d: number, a: number, s: number, ux: number, uy: number, uz: number, inv: number, gr: number, dgr: number): number {
    const { arms: A, torque: T } = this;
    const k = 1 / (this.wA * this.wA);
    let e = 0;
    for (let ia = 0; ia < 2; ia++) {
      const ho = 12 * d + 3 * ia;
      const hx = A[ho]!, hy = A[ho + 1]!, hz = A[ho + 2]!;
      const c1 = s * (hx * ux + hy * uy + hz * uz);
      if (c1 < 0) continue;
      const a1 = Math.exp(-k * (1 - c1));
      for (let ib = 0; ib < 2; ib++) {
        const lo = 12 * a + 6 + 3 * ib;
        const lx = A[lo]!, ly = A[lo + 1]!, lz = A[lo + 2]!;
        const c2 = -s * (lx * ux + ly * uy + lz * uz);
        if (c2 < 0) continue;
        const a2 = Math.exp(-k * (1 - c2));
        const w = gr * a1 * a2;
        e -= w;
        if (w > this.bond[2 * d + ia]!) { this.bond[2 * d + ia] = w; this.bondTo[2 * d + ia] = a; }
        const eC1 = -w * k; // ∂E/∂c₁ = ∂E/∂c₂
        const eC2 = eC1;
        const eR = -dgr * a1 * a2;
        // ∂c₁/∂d = s (h − (h·u) u) / r ;  ∂c₂/∂d = −s (l − (l·u) u) / r
        const hu = s * c1, lu = -s * c2;
        const p = eC1 * s * inv, q = -eC2 * s * inv;
        this.gx += eR * ux + p * (hx - hu * ux) + q * (lx - lu * ux);
        this.gy += eR * uy + p * (hy - hu * uy) + q * (ly - lu * uy);
        this.gz += eR * uz + p * (hz - hu * uz) + q * (lz - lu * uz);
        // torque = −arm × ∂E/∂arm ; ∂E/∂h = eC1 · s · u ; ∂E/∂l = −eC2 · s · u
        const th = -eC1 * s, tl = eC2 * s;
        T[3 * d]! += th * (hy * uz - hz * uy); T[3 * d + 1]! += th * (hz * ux - hx * uz); T[3 * d + 2]! += th * (hx * uy - hy * ux);
        T[3 * a]! += tl * (ly * uz - lz * uy); T[3 * a + 1]! += tl * (lz * ux - lx * uz); T[3 * a + 2]! += tl * (lx * uy - ly * ux);
      }
    }
    return e;
  }

  /** Put a partition at x: every molecule is kept on the side it is on now. */
  placePartition(x: number): void {
    this.partition = x;
    for (let i = 0; i < this.count; i++) this.side[i] = this.pos[3 * i]! < x ? -1 : 1;
  }

  /** Kinetic temperature of the living molecules with x0 ≤ x < x1. */
  temperatureIn(x0: number, x1: number): number {
    const { vel: V, omega: W, pos: P, alive, count, inertia } = this;
    let k = 0;
    let n = 0;
    for (let i = 0; i < count; i++) {
      const o = 3 * i;
      if (!alive[i] || P[o]! < x0 || P[o]! >= x1) continue;
      k += 0.5 * (V[o]! * V[o]! + V[o + 1]! * V[o + 1]! + V[o + 2]! * V[o + 2]!);
      k += 0.5 * inertia * (W[o]! * W[o]! + W[o + 1]! * W[o + 1]! + W[o + 2]! * W[o + 2]!);
      n++;
    }
    return n ? k / (3 * n) : 0;
  }

  /** Kinetic energy (translation + rotation) of the living molecules. */
  kinetic(): number {
    const { vel: V, omega: W, alive, count, inertia } = this;
    let k = 0;
    for (let i = 0; i < count; i++) {
      if (!alive[i]) continue;
      const o = 3 * i;
      k += 0.5 * (V[o]! * V[o]! + V[o + 1]! * V[o + 1]! + V[o + 2]! * V[o + 2]!);
      k += 0.5 * inertia * (W[o]! * W[o]! + W[o + 1]! * W[o + 1]! + W[o + 2]! * W[o + 2]!);
    }
    return k;
  }

  /** Advance by `steps` time steps (velocity Verlet; the heat bath acts after each step). */
  step(steps = 1): void {
    const { pos: P, vel: V, quat: Q, omega: W, force: F, torque: T, alive, inertia } = this;
    const dt = this.dt, h = 0.5 * dt, hi = h / inertia;
    if (!this.primed) {
      this.computeForces();
      this.primed = true;
    }
    for (let n = 0; n < steps; n++) {
      const count = this.count;
      for (let i = 0; i < count; i++) {
        if (!alive[i]) continue;
        const o = 3 * i, q = 4 * i;
        V[o]! += h * F[o]!; V[o + 1]! += h * F[o + 1]!; V[o + 2]! += h * F[o + 2]!;
        W[o]! += hi * T[o]!; W[o + 1]! += hi * T[o + 1]!; W[o + 2]! += hi * T[o + 2]!;
        P[o]! += dt * V[o]!; P[o + 1]! += dt * V[o + 1]!; P[o + 2]! += dt * V[o + 2]!;
        // q ← q + ½ dt · (0, ω) ⊗ q, renormalised
        const w = Q[q]!, x = Q[q + 1]!, y = Q[q + 2]!, z = Q[q + 3]!;
        const wx = W[o]!, wy = W[o + 1]!, wz = W[o + 2]!;
        let nw = w - h * (wx * x + wy * y + wz * z);
        let nxq = x + h * (w * wx + wy * z - wz * y);
        let nyq = y + h * (w * wy + wz * x - wx * z);
        let nzq = z + h * (w * wz + wx * y - wy * x);
        const s = 1 / Math.sqrt(nw * nw + nxq * nxq + nyq * nyq + nzq * nzq);
        nw *= s; nxq *= s; nyq *= s; nzq *= s;
        Q[q] = nw; Q[q + 1] = nxq; Q[q + 2] = nyq; Q[q + 3] = nzq;
      }
      if (this.lid.mode === 'piston') {
        // the lid: molecules push it up, the outside pressure (force per unit of width) pushes it down
        const { pressure, mass, damping } = this.lid;
        this.lidV += (dt * (this.lidPush - pressure * this.width - damping * this.lidV)) / mass;
        this.lidY = Math.max(1, this.lidY + dt * this.lidV);
      }
      this.computeForces();
      const heat = this.heating;
      const below = heat.mode === 'bath' || heat.mode === 'power' ? (heat.below ?? Infinity) : Infinity;
      let kin = 0;
      let living = 0;
      // the molecules that exchange heat (all, or those near the plate) and their kinetic energy
      let kinHot = 0;
      let hot = 0;
      for (let i = 0; i < count; i++) {
        if (!alive[i]) continue;
        const o = 3 * i;
        V[o]! += h * F[o]!; V[o + 1]! += h * F[o + 1]!; V[o + 2]! += h * F[o + 2]!;
        W[o]! += hi * T[o]!; W[o + 1]! += hi * T[o + 1]!; W[o + 2]! += hi * T[o + 2]!;
        const k =
          0.5 * (V[o]! * V[o]! + V[o + 1]! * V[o + 1]! + V[o + 2]! * V[o + 2]!) +
          0.5 * inertia * (W[o]! * W[o]! + W[o + 1]! * W[o + 1]! + W[o + 2]! * W[o + 2]!);
        kin += k;
        living++;
        if (P[o + 1]! < below) {
          kinHot += k;
          hot++;
        }
        this.warmth[i]! += (k - this.warmth[i]!) * Math.min(1, dt / this.speedMemory);
      }
      // six quadratic degrees of freedom per molecule: ⟨K⟩ = 3 T per molecule
      let gain = 0;
      if (heat.mode === 'bath') gain = hot ? (3 * hot * (heat.temperature - kinHot / (3 * hot)) * dt) / heat.tau : 0;
      else if (heat.mode === 'power') gain = heat.power * dt;
      if (gain !== 0 && kinHot > 1e-9) {
        // Berendsen: the velocities of the heated molecules are scaled so that their kinetic energy changes by `gain`
        const scale = Math.sqrt(Math.max(0.25, 1 + gain / kinHot));
        gain = kinHot * (scale * scale - 1);
        for (let i = 0; i < count; i++) {
          if (!alive[i] || P[3 * i + 1]! >= below) continue;
          const o = 3 * i;
          V[o]! *= scale; V[o + 1]! *= scale; V[o + 2]! *= scale;
          W[o]! *= scale; W[o + 1]! *= scale; W[o + 2]! *= scale;
        }
        kin += gain;
        this.heatIn += gain;
      }
      if (heat.mode === 'halves') {
        // each half is scaled toward its own bath
        for (const sign of [-1, 1]) {
          let k = 0;
          let m = 0;
          for (let i = 0; i < count; i++) {
            if (!alive[i] || (P[3 * i]! < heat.at ? -1 : 1) !== sign) continue;
            const o = 3 * i;
            k += 0.5 * (V[o]! * V[o]! + V[o + 1]! * V[o + 1]! + V[o + 2]! * V[o + 2]!) + 0.5 * inertia * (W[o]! * W[o]! + W[o + 1]! * W[o + 1]! + W[o + 2]! * W[o + 2]!);
            m++;
          }
          if (!m || k < 1e-9) continue;
          const want = sign < 0 ? heat.left : heat.right;
          const g = (3 * m * (want - k / (3 * m)) * dt) / heat.tau;
          const scale = Math.sqrt(Math.max(0.25, 1 + g / k));
          for (let i = 0; i < count; i++) {
            if (!alive[i] || (P[3 * i]! < heat.at ? -1 : 1) !== sign) continue;
            const o = 3 * i;
            V[o]! *= scale; V[o + 1]! *= scale; V[o + 2]! *= scale;
            W[o]! *= scale; W[o + 1]! *= scale; W[o + 2]! *= scale;
          }
          kin += k * (scale * scale - 1);
          this.heatIn += k * (scale * scale - 1);
        }
      }
      this.temperature = living ? kin / (3 * living) : 0;
      this.time += dt;
    }
  }

  /** Give every living molecule a random velocity and spin of temperature `t` (seeded). */
  thermalise(t: number, seed: number): void {
    const rnd = mulberry(seed);
    const gauss = (): number => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
    const sv = Math.sqrt(t), sw = Math.sqrt(t / this.inertia);
    for (let i = 0; i < this.count; i++)
      for (let k = 0; k < 3; k++) {
        this.vel[3 * i + k] = sv * gauss();
        this.omega[3 * i + k] = sw * gauss();
      }
  }
}

/** Small seeded generator (mulberry32): the same seed gives the same initial state on every machine. */
export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
