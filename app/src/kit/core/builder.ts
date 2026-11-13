/**
 * Builder — how every kit model is assembled.
 *
 * A model is described as many small coloured shapes (primary form → secondary forms → tertiary accents,
 * STYLE_GUIDE §3). Drawing each shape separately would cost thousands of draw calls, so the builder *bakes the
 * palette colour of each shape into vertex colours and merges everything that shares a material slot into one
 * mesh*. A detailed hero model therefore costs 2–6 draw calls; only parts that move or come off (rotors, doors,
 * removable roofs — `part()`) are separate groups.
 *
 * Material slots (`Slot`) are a fixed, small set of `K.*` materials created per model by `MatSet`, so a model
 * can be faded, clipped or switched to night independently of its neighbours.
 */
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  Group,
  Matrix3,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  Vector3,
  type Material,
  type Plane,
} from 'three';
import {
  K,
  K_EMISSIVE_ATTRIBUTE,
  col,
  type ColorLike,
  type GlassParams,
  type KGlowMaterial,
  type KToonMaterial,
} from '@/style';
import * as G from './geo';

export type V3 = readonly [number, number, number];

/**
 * Material slot of a shape:
 * `toon` default solid · `matte` ground, roofs, concrete (no highlight band) · `soft` foliage, clouds ·
 * `metal` machined metal · `gloss` painted / ceramic / plastic with a crisp highlight · `facet` flat-shaded
 * (rocks, crystals) · `double` thin two-sided sheets · `window` panes that light up at night · `lamp` bulbs
 * that are dim by day and bright at night · `glow` always-on indicator lights · `flat` unlit exact colour ·
 * `glass` tinted translucent.
 */
export type Slot =
  | 'toon'
  | 'matte'
  | 'soft'
  | 'metal'
  | 'gloss'
  | 'facet'
  | 'double'
  | 'window'
  | 'lamp'
  | 'glow'
  | 'flat'
  | 'glass';

/** Colour of a shape: one token, a bottom → top gradient over the shape's own height, or a function of the local position. */
export type Tint =
  | ColorLike
  | readonly [ColorLike, ColorLike]
  | ((p: Vector3, n: Vector3, out: Color) => void);

export interface Place {
  /** Position (of the base centre for standing shapes, of the centre for centred ones). */
  at?: V3;
  /** Euler XYZ rotation in radians. */
  rot?: V3;
  /** Uniform or per-axis scale. */
  s?: number | V3;
}

export interface AddOptions extends Place {
  /** Colour. Default `mist`. */
  c?: Tint;
  /** Material slot. Default `toon`. */
  slot?: Slot;
  /**
   * `window` slot only: colour this pane glows with at night (per-vertex emissive, so panes of different colours
   * still share one draw call — a TV screen, a cool office pane). Default: the model's `windowGlow` / `windowTones`.
   */
  glow?: ColorLike;
}

type Axis = 'x' | 'y' | 'z';

export interface MatOptions {
  /** One emissive colour for every lit window of the model (overrides `windowTones`). */
  windowGlow?: ColorLike;
  /**
   * Night colours of lit windows that have no `glow` of their own: each pane takes one of them, picked by a hash
   * of its position (stable, independent of the build order; repeat an entry to weight it). Default
   * `LIT_WINDOW_TONES` (mostly warm yellow).
   */
  windowTones?: readonly ColorLike[];
  /** Parameters of the `glass` slot. */
  glass?: GlassParams;
  /** Local clipping planes applied to every material of the model (cutaways driven by the chapter / fx). */
  clippingPlanes?: Plane[];
}

const CASTS: Record<Slot, boolean> = {
  toon: true,
  matte: true,
  soft: true,
  metal: true,
  gloss: true,
  facet: true,
  double: true,
  window: true,
  lamp: false,
  glow: false,
  flat: false,
  glass: false,
};

/** Night colour of most lit windows: warm yellow, a touch toward orange (the kit's look before M2). */
const WARM_WINDOW = col('yellow').lerp(col('orange'), 0.22);

/**
 * Default lit-window mix: mostly the warm default, some paler warm-white and deeper warm panes, a few cool ones
 * (screens / LED light) — a living city instead of one flat yellow.
 */
export const LIT_WINDOW_TONES: readonly ColorLike[] = [
  WARM_WINDOW,
  WARM_WINDOW,
  WARM_WINDOW,
  WARM_WINDOW,
  col('yellow').lerp(col('white'), 0.3),
  col('yellow').lerp(col('white'), 0.3),
  col('orange').lerp(col('yellow'), 0.35),
  col('sky').lerp(col('white'), 0.35),
];

/** Stable 0…1 hash of a position (window tones). */
function hash3(x: number, y: number, z: number): number {
  const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return h - Math.floor(h);
}

/** The K materials of one model, created lazily per slot. */
export class MatSet {
  private readonly map = new Map<Slot, Material>();
  private nightValue = 0;

  constructor(private readonly options: MatOptions = {}) {}

  get(slot: Slot): Material {
    let m = this.map.get(slot);
    if (!m) {
      m = this.create(slot);
      if (this.options.clippingPlanes) m.clippingPlanes = this.options.clippingPlanes;
      this.map.set(slot, m);
      this.applyNight();
    }
    return m;
  }

  private create(slot: Slot): Material {
    const base = { color: 'white', vertexColors: true, name: `kit.${slot}` } as const;
    switch (slot) {
      case 'toon':
        return K.toon({ ...base });
      case 'matte':
        return K.toon({ ...base, highlight: 0.1, rim: 0.3, softness: 0.14 });
      case 'soft':
        return K.toon({ ...base, softness: 0.2, highlight: 0.35, rim: 0.7, terminator: -0.05 });
      case 'metal':
        return K.metal({ ...base, specular: 0.5, shininess: 40 });
      case 'gloss':
        return K.toon({ ...base, gloss: 0.75, highlight: 0.6 });
      case 'facet':
        return K.toon({ ...base, flatShading: true, rim: 0.3, highlight: 0.3 });
      case 'double':
        return K.toon({ ...base, side: DoubleSide });
      case 'window':
        // per-vertex emissive (`kEmissive`, written by the builder per pane) × night level; keepHue (M3) stops
        // warm / cool panes from washing to cream-white when lit wall + emissive passes 1
        return K.toon({ ...base, vertexEmissive: true, vertexEmissiveIntensity: 0, gloss: 0.6, highlight: 0.8, keepHue: true });
      case 'lamp':
        return K.glow({ ...base, core: 'white', intensity: 0.5, falloff: 0.8, edge: 0.75 });
      case 'glow':
        // small coloured indicator lights (aviation reds, status LEDs): keep the vertex-colour hue under bloom
        return K.glow({ ...base, core: 'white', keepHue: true, intensity: 2.4, falloff: 1.2, edge: 0.6 });
      case 'flat':
        return K.flat('white', { vertexColors: true });
      case 'glass':
        return K.glass({ color: 'sky', opacity: 0.16, edgeOpacity: 0.6, ...this.options.glass });
    }
  }

  /** 0 = day, 1 = night: windows become emissive, lamps switch on (tweenable). */
  get night(): number {
    return this.nightValue;
  }
  set night(v: number) {
    this.nightValue = v;
    this.applyNight();
  }

  private applyNight(): void {
    const v = this.nightValue;
    const w = this.map.get('window') as KToonMaterial | undefined;
    if (w) w.vertexEmissiveIntensity = v * 1.45; // warm glow with a mild bloom; higher values wash out to white
    const l = this.map.get('lamp') as KGlowMaterial | undefined;
    if (l) l.intensity = 0.5 + v * 2.9;
  }

  /** Night colour of a window pane without its own `glow` (see `MatOptions.windowTones`). */
  windowColor(x: number, y: number, z: number, out: Color): Color {
    if (this.options.windowGlow !== undefined) return col(this.options.windowGlow, out);
    const tones = this.options.windowTones ?? LIT_WINDOW_TONES;
    if (tones.length === 0) return out.copy(WARM_WINDOW);
    return col(tones[Math.floor(hash3(x, y, z) * tones.length) % tones.length]!, out);
  }

  /** Every material created so far (for clipping planes, fades, custom tweaks). */
  list(): Material[] {
    return [...this.map.values()];
  }

  has(slot: Slot): boolean {
    return this.map.has(slot);
  }

  setClipping(planes: Plane[] | null): void {
    this.options.clippingPlanes = planes ?? undefined;
    for (const m of this.map.values()) m.clippingPlanes = planes;
  }
}

/** What every kit builder returns. */
export class KitModel {
  /** Per-frame animation (rotors, blinking beacons, sway). No-op for static models. Engine-clock seconds. */
  update: (dt: number, t: number) => void = () => {};
  /** Named polylines in the model's local space (cable routes, pipe centre lines) for `fx` flows. */
  readonly paths: Record<string, Vector3[]> = {};

  constructor(
    /** Add this to your scene; position / rotate / scale it freely. Origin = centre of the footprint on the ground. */
    readonly group: Group,
    /** Sub-groups that move or come off (rotor, door, roof…). */
    readonly parts: Record<string, Group>,
    /** Named points for labels, hotspots, wire and pipe attachment (empty objects inside the hierarchy). */
    readonly anchors: Record<string, Object3D>,
    readonly mats: MatSet,
    /** Triangles of the model (cost notes). */
    readonly triangles: number,
  ) {}

  /** 0 = day … 1 = night. */
  get night(): number {
    return this.mats.night;
  }
  set night(v: number) {
    this.mats.night = v;
  }

  /** A part by name; throws on a typo instead of returning undefined. */
  part(name: string): Group {
    const p = this.parts[name];
    if (!p) throw new Error(`kit: model "${this.group.name}" has no part "${name}"`);
    return p;
  }

  anchor(name: string): Object3D {
    const a = this.anchors[name];
    if (!a) throw new Error(`kit: model "${this.group.name}" has no anchor "${name}"`);
    return a;
  }

  /** World position of an anchor (after the model has been placed in the scene). */
  anchorWorld(name: string, out = new Vector3()): Vector3 {
    this.group.updateWorldMatrix(true, true);
    return this.anchor(name).getWorldPosition(out);
  }

  /** Position of an anchor in the model's own space (group transform not applied). */
  anchorLocal(name: string, out = new Vector3()): Vector3 {
    this.group.updateWorldMatrix(true, true);
    this.anchor(name).getWorldPosition(out);
    return this.group.worldToLocal(out);
  }

  /** Number of meshes = draw calls per pass (the shadow pass draws shadow casters once more). */
  get drawCalls(): number {
    let n = 0;
    this.group.traverse((o) => {
      if ((o as Mesh).isMesh) n++;
    });
    return n;
  }
}

class Buf {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  uv: number[] = [];
  idx: number[] = [];
  /** Per-vertex night emissive (`window` slot only). */
  em: number[] | null = null;
}

function bufGeometry(buf: Buf): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(buf.pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(buf.nor, 3));
  g.setAttribute('color', new Float32BufferAttribute(buf.col, 3));
  g.setAttribute('uv', new Float32BufferAttribute(buf.uv, 2));
  if (buf.em) g.setAttribute(K_EMISSIVE_ATTRIBUTE, new Float32BufferAttribute(buf.em, 3));
  g.setIndex(buf.idx);
  return g;
}

const AXIS_ROT: Record<Axis, Matrix4> = {
  y: new Matrix4(),
  // base at the origin, growing along +X / +Z
  x: new Matrix4().makeRotationZ(-Math.PI / 2),
  z: new Matrix4().makeRotationX(Math.PI / 2),
};

const tmpM = new Matrix4();
const tmpN = new Matrix3();
const tmpV = new Vector3();
const tmpV2 = new Vector3();
const tmpC = new Color();
const tmpC2 = new Color();
const tmpQ = new Quaternion();
const tmpE = new Euler();
const tmpS = new Vector3();

function placeMatrix(p: Place, out: Matrix4): Matrix4 {
  const at = p.at ?? [0, 0, 0];
  const rot = p.rot ?? [0, 0, 0];
  const s = p.s ?? 1;
  tmpQ.setFromEuler(tmpE.set(rot[0], rot[1], rot[2]));
  if (typeof s === 'number') tmpS.set(s, s, s);
  else tmpS.set(s[0], s[1], s[2]);
  return out.compose(tmpV.set(at[0], at[1], at[2]), tmpQ, tmpS);
}

export class Builder {
  readonly mats: MatSet;
  private readonly bufs = new Map<Slot, Buf>();
  private frameM = new Matrix4();
  private prefix = '';
  private readonly children: { name: string; builder: Builder; pivot: Matrix4 }[] = [];
  private readonly anchorList: { name: string; m: Matrix4 }[] = [];
  private readonly attached: Object3D[] = [];
  private readonly pathMap: Record<string, Vector3[]> = {};

  constructor(
    readonly name = 'model',
    mats: MatSet | MatOptions = {},
  ) {
    this.mats = mats instanceof MatSet ? mats : new MatSet(mats);
  }

  /* ----------------------------------------------------------------------------------- structure */

  /** Run `fn` with everything it adds placed in a local frame (nested frames compose). `prefix` namespaces anchors and parts. */
  frame(place: Place, fn: () => void, prefix = ''): this {
    const saved = this.frameM;
    const savedPrefix = this.prefix;
    this.frameM = saved.clone().multiply(placeMatrix(place, tmpM));
    this.prefix = savedPrefix + prefix;
    fn();
    this.frameM = saved;
    this.prefix = savedPrefix;
    return this;
  }

  /**
   * A separate sub-group with its own pivot (origin of the returned builder) — for anything that moves or
   * comes off. Costs extra draw calls, so use it only for that.
   */
  part(name: string, place: Place = {}): Builder {
    const builder = new Builder(this.prefix + name, this.mats);
    this.children.push({
      name: this.prefix + name,
      builder,
      pivot: this.frameM.clone().multiply(placeMatrix(place, tmpM)),
    });
    return builder;
  }

  /** Named point (and orientation) in the current frame. */
  anchor(name: string, x = 0, y = 0, z = 0): this {
    this.anchorList.push({
      name: this.prefix + name,
      m: this.frameM.clone().multiply(tmpM.makeTranslation(x, y, z)),
    });
    return this;
  }

  /** Full name a part or anchor added now gets (current frame prefixes applied) — for handles that look parts up later. */
  fullName(name: string): string {
    return this.prefix + name;
  }

  /** Model-space position of an anchor added earlier (assemblers use it to wire components together). */
  locate(name: string, out = new Vector3()): Vector3 {
    const a = this.anchorList.find((x) => x.name === name);
    if (!a) throw new Error(`kit: builder "${this.name}" has no anchor "${name}"`);
    return out.setFromMatrixPosition(a.m);
  }

  /** Register a named polyline (current frame) on the resulting model (`model.paths`). */
  path(name: string, points: readonly Vector3[]): this {
    this.pathMap[this.prefix + name] = points.map((p) => p.clone().applyMatrix4(this.frameM));
    return this;
  }

  /** Attach a ready object (instanced mesh, water surface…) under the model, placed in the current frame. */
  attach(object: Object3D): this {
    object.applyMatrix4(this.frameM);
    this.attached.push(object);
    return this;
  }

  /** Night colour of a window pane placed with matrix `m`. */
  private windowGlowOf(o: AddOptions, m: Matrix4): Color {
    if (o.glow !== undefined) return col(o.glow, new Color());
    const e = m.elements;
    // the pane's placement (model space), rounded so that float noise never flips a tone
    const r = (v: number): number => Math.round(v * 100) / 100;
    return this.mats.windowColor(r(e[12]!), r(e[13]!), r(e[14]!), new Color());
  }

  /** Transform a point from the current frame to model space. */
  toModel(x: number, y: number, z: number, out = new Vector3()): Vector3 {
    return out.set(x, y, z).applyMatrix4(this.frameM);
  }

  /* -------------------------------------------------------------------------------------- shapes */

  /** Add any geometry (it is copied; the source can be reused for more placements). */
  add(geo: BufferGeometry, o: AddOptions = {}, pre?: Matrix4): this {
    const slot = o.slot ?? 'toon';
    let buf = this.bufs.get(slot);
    if (!buf) this.bufs.set(slot, (buf = new Buf()));
    const m = new Matrix4().multiplyMatrices(this.frameM, placeMatrix(o, tmpM));
    if (pre) m.multiply(pre);
    const normalMatrix = tmpN.getNormalMatrix(m);
    const mirrored = m.determinant() < 0;
    const position = geo.getAttribute('position');
    const normal = geo.getAttribute('normal');
    const uv = geo.getAttribute('uv');
    const base = buf.pos.length / 3;

    // a geometry that carries its own vertex colours (banded surfaces) keeps them unless `c` is given
    const own = o.c === undefined ? geo.getAttribute('color') : undefined;
    const tint = o.c ?? 'mist';
    let y0 = 0;
    let y1 = 1;
    let mode: 0 | 1 | 2 | 3 = 0;
    if (own) mode = 3;
    else if (typeof tint === 'function') mode = 2;
    else if (Array.isArray(tint)) {
      mode = 1;
      col(tint[0] as ColorLike, tmpC);
      col(tint[1] as ColorLike, tmpC2);
      if (!geo.boundingBox) geo.computeBoundingBox();
      y0 = geo.boundingBox!.min.y;
      y1 = geo.boundingBox!.max.y;
    } else col(tint as ColorLike, tmpC);
    const c = new Color();
    const glow = slot === 'window' ? this.windowGlowOf(o, m) : null;
    if (glow) buf.em ??= [];
    for (let i = 0; i < position.count; i++) {
      if (glow) buf.em!.push(glow.r, glow.g, glow.b);
      tmpV.fromBufferAttribute(position, i);
      tmpV2.fromBufferAttribute(normal, i);
      if (mode === 0) c.copy(tmpC);
      else if (mode === 1) c.copy(tmpC).lerp(tmpC2, y1 > y0 ? (tmpV.y - y0) / (y1 - y0) : 0);
      else if (mode === 3) c.fromBufferAttribute(own!, i);
      else (tint as (p: Vector3, n: Vector3, out: Color) => void)(tmpV, tmpV2, c);
      buf.col.push(c.r, c.g, c.b);
      tmpV.applyMatrix4(m);
      tmpV2.applyMatrix3(normalMatrix).normalize();
      buf.pos.push(tmpV.x, tmpV.y, tmpV.z);
      buf.nor.push(tmpV2.x, tmpV2.y, tmpV2.z);
      if (uv) buf.uv.push(uv.getX(i), uv.getY(i));
      else buf.uv.push(0, 0);
    }
    const index = geo.getIndex();
    const count = index ? index.count : position.count;
    for (let i = 0; i < count; i += 3) {
      const a = base + (index ? index.getX(i) : i);
      const b = base + (index ? index.getX(i + 1) : i + 1);
      const d = base + (index ? index.getX(i + 2) : i + 2);
      if (mirrored) buf.idx.push(a, d, b);
      else buf.idx.push(a, b, d);
    }
    return this;
  }

  /** Rounded box standing on y = 0 (`mid: true` centres it). `r: 0` = plain hard box for tiny details. */
  box(
    w: number,
    h: number,
    d: number,
    o: AddOptions & { r?: number; seg?: number; mid?: boolean } = {},
  ): this {
    const g = o.r === 0 ? G.box(w, h, d) : G.rbox(w, h, d, o.r ?? Math.min(w, h, d) * 0.12, o.seg ?? 1);
    return this.add(g, o, o.mid ? undefined : tmpM.makeTranslation(0, h / 2, 0).clone());
  }

  /** Bevelled cylinder / frustum; base at `at`, growing along `axis` (default +Y). */
  cyl(r: number, h: number, o: AddOptions & G.CylOptions & { axis?: Axis } = {}): this {
    return this.add(G.cyl(r, h, o), o, AXIS_ROT[o.axis ?? 'y']);
  }

  cone(r: number, h: number, o: AddOptions & { tip?: number; seg?: number; axis?: Axis } = {}): this {
    return this.add(G.cone(r, h, o), o, AXIS_ROT[o.axis ?? 'y']);
  }

  dome(r: number, h: number, o: AddOptions & { seg?: number; axis?: Axis } = {}): this {
    return this.add(G.dome(r, h, o.seg ?? 24), o, AXIS_ROT[o.axis ?? 'y']);
  }

  /** Sphere centred on `at`. */
  sphere(r: number, o: AddOptions & { seg?: number } = {}): this {
    return this.add(G.sphere(r, o.seg ?? 16), o);
  }

  /** Capsule centred on `at`, along `axis`; `length` includes the caps. */
  capsule(r: number, length: number, o: AddOptions & { seg?: number; axis?: Axis } = {}): this {
    return this.add(G.capsule(r, length, o.seg ?? 12), o, AXIS_ROT[o.axis ?? 'y']);
  }

  /** Torus band centred on `at`, around `axis`. */
  ring(R: number, r: number, o: AddOptions & { seg?: number; tubeSeg?: number; axis?: Axis } = {}): this {
    return this.add(G.ring(R, r, o.seg ?? 24, o.tubeSeg ?? 6), o, AXIS_ROT[o.axis ?? 'y']);
  }

  lathe(profile: readonly G.Pt[], o: AddOptions & G.LatheOptions & { axis?: Axis } = {}): this {
    return this.add(G.lathe(profile, o), o, AXIS_ROT[o.axis ?? 'y']);
  }

  /** Tube along a polyline given in the current frame. */
  tube(points: readonly Vector3[], radius: number, o: AddOptions & G.TubeOptions = {}): this {
    return this.add(G.tube(points, radius, o), o);
  }

  /** Straight round bar between two points. */
  rod(a: V3, b: V3, radius: number, o: AddOptions & { seg?: number } = {}): this {
    return this.add(G.rod(new Vector3(...a), new Vector3(...b), radius, o.seg ?? 6), o);
  }

  /** Square bar between two points (lattice members, beams): a box stretched along the segment. */
  beam(a: V3, b: V3, w: number, o: AddOptions & { h?: number; r?: number } = {}): this {
    const va = tmpV.set(a[0], a[1], a[2]).clone();
    const vb = tmpV2.set(b[0], b[1], b[2]).clone();
    const len = va.distanceTo(vb);
    const dir = vb.clone().sub(va).divideScalar(len || 1);
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir);
    const pre = new Matrix4().compose(va.add(vb).multiplyScalar(0.5), q, new Vector3(1, 1, 1));
    const g = o.r ? G.rbox(w, len, o.h ?? w, o.r, 1) : G.box(w, len, o.h ?? w);
    return this.add(g, o, pre);
  }

  /* --------------------------------------------------------------------------------------- build */

  /** Merged, vertex-coloured geometry of one slot — the source for `InstancedMesh`es (trees, cars, modules). */
  geometry(slot: Slot = 'toon'): BufferGeometry {
    const buf = this.bufs.get(slot);
    if (!buf) throw new Error(`kit: builder "${this.name}" has nothing in slot "${slot}"`);
    return bufGeometry(buf);
  }

  build(): KitModel {
    const parts: Record<string, Group> = {};
    const anchors: Record<string, Object3D> = {};
    const paths: Record<string, Vector3[]> = {};
    const counter = { triangles: 0 };
    const group = this.buildGroup(parts, anchors, paths, counter);
    const model = new KitModel(group, parts, anchors, this.mats, counter.triangles);
    Object.assign(model.paths, paths);
    return model;
  }

  private buildGroup(
    parts: Record<string, Group>,
    anchors: Record<string, Object3D>,
    paths: Record<string, Vector3[]>,
    counter: { triangles: number },
    ns = '',
  ): Group {
    const group = new Group();
    group.name = this.name;
    for (const [slot, buf] of this.bufs) {
      if (buf.idx.length === 0) continue;
      const g = bufGeometry(buf);
      const mesh = new Mesh(g, this.mats.get(slot));
      mesh.name = `${this.name}:${slot}`;
      mesh.castShadow = CASTS[slot];
      mesh.receiveShadow = slot !== 'glass' && slot !== 'glow' && slot !== 'lamp' && slot !== 'flat';
      if (slot === 'glass') mesh.renderOrder = 2;
      counter.triangles += buf.idx.length / 3;
      group.add(mesh);
    }
    for (const o of this.attached) group.add(o);
    // Anchors and paths added inside a `part()` are registered as `<part>.<name>` (KIT_API: `blade0.tip`) and,
    // for compatibility, also under the bare name (last one wins, as before M3).
    for (const a of this.anchorList) {
      const o = new Object3D();
      o.name = ns ? `${ns}.${a.name}` : a.name;
      a.m.decompose(o.position, o.quaternion, o.scale);
      group.add(o);
      anchors[o.name] = o;
      if (ns) anchors[a.name] = o;
    }
    for (const [name, pts] of Object.entries(this.pathMap)) {
      paths[ns ? `${ns}.${name}` : name] = pts;
      if (ns && !(name in paths)) paths[name] = pts;
    }
    for (const child of this.children) {
      const g = child.builder.buildGroup(parts, anchors, paths, counter, child.name);
      child.pivot.decompose(g.position, g.quaternion, g.scale);
      group.add(g);
      parts[child.name] = g;
    }
    return group;
  }
}

/* ------------------------------------------------------------------------------------- instancing */

export interface Placement {
  at: V3;
  /** Rotation around Y (radians). */
  ry?: number;
  s?: number | V3;
  /** Multiplies the model's colours (keep close to white unless the model is designed to be tinted). */
  tint?: ColorLike;
}

/** Compose a placement into a matrix. */
export function placementMatrix(p: Placement, out = new Matrix4()): Matrix4 {
  tmpQ.setFromEuler(tmpE.set(0, p.ry ?? 0, 0));
  const s = p.s ?? 1;
  if (typeof s === 'number') tmpS.set(s, s, s);
  else tmpS.set(s[0], s[1], s[2]);
  return out.compose(tmpV.set(p.at[0], p.at[1], p.at[2]), tmpQ, tmpS);
}
