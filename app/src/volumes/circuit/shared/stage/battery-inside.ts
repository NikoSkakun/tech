/**
 * The battery opened where it lies (VISUAL.md §5.2, §5.8): `cut` slides the near half of the can off along the
 * axis toward the minus and shows the lengthwise section; `life` turns zinc and manganese oxide into their spent
 * forms; `reaction` runs the events at the separator; `surplus` / `lack` show the pole charges outside.
 *
 * How the cut is drawn: the outside of the battery (`battery.ts`) is built twice from the same recipe — the
 * battery itself, clipped to its FAR half while `cut > 0`, and a «sleeve», clipped to its NEAR half, that is
 * shown only during the cut and slides away, vanishing at the minus end. Under it lies the section
 * (`battery-section.ts`), a shallow relief in the cut plane. At `cut = 0` the clipping plane is moved far away:
 * the closed battery renders exactly as before.
 */
import {
  type Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Plane,
  PlaneGeometry,
  PointLight,
  type Raycaster,
  Vector3,
} from 'three';
import type { Shot } from '@/engine/api';
import { K, col } from '@/style';
import { BATTERY } from './layout';
import { CUT_LIGHT, createGrains } from './battery-grains';
import { cellColor, drawSection } from './battery-layers';
import { BATTERY_LAYERS, SEC, paint, type BatteryLayer, type Cell } from './battery-section';
import { createReaction } from './battery-react';
import { type Clump, createPoles } from './battery-poles';
import { STAGE_FOV, boardToWorld } from './shots';
import { GAUGE_HOME } from './tools/gauge';

/**
 * Angle of the cut plane's normal from the reader (+z) toward up (+y), battery frame (15° above the horizon in the
 * world): seen from the main shot (37°) or the close-up (42°) the cut is open and the far half's top edge shows.
 */
export const CUT_TILT = (30 * Math.PI) / 180;
/** Unit normal of the cut plane in the battery's frame (out of the section, toward the viewer). */
export const CUT_NORMAL = new Vector3(0, Math.sin(CUT_TILT), Math.cos(CUT_TILT));

export interface BatteryInside {
  /** 0 = closed … 1 = the near half gone, the section open. Pure function of the number, both ways. */
  cut: number;
  /** 0 fresh … 1 dead (`LIFE_STATES`): the substances of the section turn into their spent forms. */
  life: number;
  /**
   * 0 … 1: activity of the reaction at the separator (events, ions); 0 = still. With `hold` the battery adds
   * its own drive (refilling the poles, keeping a current); `activity` (read) is what runs.
   */
  reaction: number;
  readonly activity: number;
  /** 0 … 1: electrons gathered on the minus cap (outside). */
  surplus: number;
  /** 0 … 1: lack of electrons on the plus nub (outside). */
  lack: number;
  /** The level the battery holds (the mark on the scale «бракує · порівну · забагато»), default 0.75. */
  mark: number;
  /**
   * The battery keeps its poles itself: `surplus` and `lack` climb to `mark` (≈ 5 s from 0, the «first
   * moment»), the reaction running hard at first and thinning out; after `clump` is pulled away it revives
   * and restores the level (≈ 3 s). Off by default (then the levels are plain numbers).
   */
  hold: boolean;
  /** 0 … 1: a current flows (switch closed): with `hold` the reaction keeps running at this rate (`lamp/energy`). */
  current: number;
  /** The clump of electrons the reader pulls off the minus cap (`battery/balance`). */
  clump: Clump;
  /** How many electrons / spots of lack are drawn now. */
  readonly surplusCount: number;
  readonly lackCount: number;
  /** One layer lifted, the others stepped back (eased); `null` = none. */
  highlight: BatteryLayer | null;
  /**
   * 0 … 1, default 0: the open section's own soft key light (VISUAL §2 «освітлений острів»): the layers and the
   * reaction read by their colours even with the lamp off. Only while the cut is open; with the lamp lit it only
   * lifts the cut's shadows (scaled down by the lamp's glow, never doubling the exposure). A shadowless point
   * light with a tight falloff, always in the scene (intensity 0 when off: no recompiles). Every chapter's stage
   * starts at 0; set it from any step and set it back to 0 where the step does not want it.
   */
  island: number;
  /** The lamp's glow 0 … 1 (the stage writes it every frame; the island steps back as the lamp lights the cut). */
  lamp: number;
  /** Per layer: a callout anchor on its cut face and the mesh(es) to raycast. */
  layers: Readonly<Record<BatteryLayer, { anchor: Object3D; pick: Object3D }>>;
  /** Outside anchors: the minus cap and the plus nub (lens, counters), the centre of the cut face. */
  anchors: { minusCap: Object3D; plusCap: Object3D; section: Object3D };
  /** The layer under the ray (only while the section is open, `cut > 0.5`), else `null`. */
  pick(raycaster: Raycaster): BatteryLayer | null;
  update(dt: number, t: number): void;
}

/** What `battery.ts` hands over: the clipping planes it built its two outsides with, and the moving parts. */
export interface Outside {
  group: Group;
  /** Keeps the far half of the battery itself (moved away at cut = 0). */
  keepFar: Plane;
  /** The sleeve's planes: keep its near half; nothing past the minus end. */
  keepNear: Plane;
  pastMinus: Plane;
  sleeve: Group;
  /** Dissolve the sleeve: 1 solid … 0 gone (dithered, no sorting). */
  setSleeveFade(k: number): void;
  /** The printed «1.5 V» leaves with the sleeve: `k` 1 = as printed … 0 = gone, `shift` along the axis. */
  setPrint(k: number, shift: number): void;
}

const LAYER_IDS = Object.keys(BATTERY_LAYERS) as BatteryLayer[];
const smooth = (a: number, b: number, v: number): number => {
  const k = Math.min(Math.max((v - a) / (b - a), 0), 1);
  return k * k * (3 - 2 * k);
};
/** Where each layer's callout sits on the cut face (section frame; +y shows up in the frame). */
const ANCHOR_AT: Record<BatteryLayer, [number, number]> = {
  can: [0.05, BATTERY.radius - 0.015],
  cathode: [-0.4, 0.212],
  separator: [0.2, 0.17],
  zinc: [-0.15, 0.1],
  pin: [0.1, 0],
  seal: [-0.885, 0.13],
  minusCap: [SEC.capX + 0.018, -0.12],
};
/** Pick regions per layer (section frame): [x0, x1, |y|0, |y|1] boxes, mirrored about the axis. */
const PICK_AT: Record<BatteryLayer, [number, number, number, number][]> = {
  can: [
    [-0.94, 0.95, SEC.canIn, BATTERY.radius],
    [0.93, SEC.nubTop, 0, SEC.nub],
  ],
  cathode: [[SEC.coreFrom, SEC.canEnd, SEC.cathodeIn, SEC.canIn]],
  separator: [[SEC.coreFrom, SEC.coreTo, SEC.sepIn - 0.006, SEC.cathodeIn + 0.004]],
  zinc: [[SEC.coreFrom, SEC.coreTo, 0, SEC.sepIn]],
  pin: [[-0.935, SEC.pinTip, 0, SEC.pin + 0.01]],
  seal: [[-0.935, SEC.coreFrom, 0, SEC.canIn]],
  minusCap: [[SEC.capX - 0.01, -0.935, 0, SEC.capR]],
};
/** Order for picking where boxes overlap: the narrow things first. */
const PICK_ORDER: BatteryLayer[] = ['pin', 'separator', 'minusCap', 'seal', 'zinc', 'cathode', 'can'];

const FAR_AWAY = 1e6;
/** The island light: distance from the battery's axis, reach (zero beyond), peak intensity. */
const ISLAND_LIFT = 0.9;
const ISLAND_REACH = 1.4;
const ISLAND_PEAK = 2.1;
/** How far the sleeve lifts toward the viewer (along `CUT_NORMAL`) and slides along the axis toward the minus. */
const SLEEVE_LIFT = 0.3;
const SLEEVE_SLIDE = 1.6;
const L = BATTERY.length;

export function createBatteryInside(outside: Outside): BatteryInside {
  const section = new Group();
  section.name = 'battery:section';
  section.rotation.x = -CUT_TILT;
  section.visible = false;
  outside.group.add(section);

  const { soft, hard } = drawSection();
  const softGeo = soft.geometry();
  const hardGeo = hard.geometry();
  const softMesh = new Mesh(
    softGeo,
    K.toon({ color: 'white', vertexColors: true, highlight: 0.25, ...CUT_LIGHT }),
  );
  const hardMesh = new Mesh(hardGeo, K.metal({ color: 'white', vertexColors: true, ...CUT_LIGHT }));
  softMesh.name = 'battery:section-soft';
  hardMesh.name = 'battery:section-metal';
  const grains = createGrains();
  section.add(softMesh, hardMesh, grains.zinc, grains.deposit, grains.oxide);
  // no shadows on the cut: the battery's own (unclipped) outside would shade it from inside

  // anchors and invisible pick boxes per layer
  const hidden = new MeshBasicMaterial({ visible: false });
  const layers = {} as Record<BatteryLayer, { anchor: Object3D; pick: Object3D }>;
  const pickMeshes: Mesh[] = [];
  for (const id of LAYER_IDS) {
    const anchor = new Object3D();
    anchor.name = `battery:layer-${id}`;
    anchor.position.set(ANCHOR_AT[id][0], ANCHOR_AT[id][1], 0.01);
    const pick = new Group();
    pick.name = `battery:pick-${id}`;
    for (const [x0, x1, y0, y1] of PICK_AT[id]) {
      for (const sign of y0 === 0 ? [0] : [1, -1]) {
        const h = sign === 0 ? 2 * y1 : y1 - y0;
        const box = new Mesh(new PlaneGeometry(x1 - x0, h), hidden);
        box.position.set((x0 + x1) / 2, sign === 0 ? 0 : (sign * (y0 + y1)) / 2, 0.012);
        box.userData.layer = id;
        pick.add(box);
        pickMeshes.push(box);
      }
    }
    section.add(anchor, pick);
    layers[id] = { anchor, pick };
  }
  const sectionAnchor = new Object3D();
  sectionAnchor.position.set(0, 0, 0.01);
  section.add(sectionAnchor);
  const minusCap = new Object3D();
  minusCap.position.set(SEC.capX - 0.01, 0, 0);
  const plusCap = new Object3D();
  plusCap.position.set(SEC.nubTop + 0.01, 0, 0);
  outside.group.add(minusCap, plusCap);

  const reaction = createReaction(section);
  // the island: above the cut, steeper than its normal (the board in front stays dark), a little toward the plus;
  // short reach, physical decay
  const islandLight = new PointLight(col('mist').lerp(col('white'), 0.55), 0, ISLAND_REACH, 2);
  islandLight.name = 'battery:island';
  islandLight.castShadow = false;
  islandLight.position.set(0.12, 0.75, 0.66).normalize().multiplyScalar(ISLAND_LIFT);
  outside.group.add(islandLight);
  let island = 0;
  let islandShown = 0;
  let lamp = 0;
  const poles = createPoles(outside.group, section);

  let cut = 0;
  let reactionParam = 0;
  let life = 0;
  let highlight: BatteryLayer | null = null;
  const hi = Object.fromEntries(LAYER_IDS.map((id) => [id, 0])) as Record<BatteryLayer, number>;
  let painted = '';
  const repaint = (): void => {
    const focus = Math.max(...LAYER_IDS.map((id) => hi[id]));
    const key = `${life.toFixed(4)}|${LAYER_IDS.map((id) => hi[id].toFixed(3)).join(',')}`;
    if (key === painted) return;
    painted = key;
    const colorOf = (c: Cell, out: Color): Color => cellColor(c, life, hi, focus, out);
    paint(softGeo, soft.cells, colorOf);
    paint(hardGeo, hard.cells, colorOf);
    const dim = (id: BatteryLayer): number => (1 - 0.4 * focus * (1 - hi[id])) * (1 + 0.22 * hi[id]);
    grains.set(life, { zinc: dim('zinc'), cathode: dim('cathode') });
  };

  const sleeveShift = new Vector3();
  const applyCut = (): void => {
    const open = cut > 1e-4;
    section.visible = open;
    // the sleeve: lifts off toward the viewer (clear of the minus clamp in front of it), slides along the axis
    // past the minus end and dissolves on its way — one continuous motion, the same both ways
    const lift = smooth(0, 0.3, cut);
    const e = smooth(0.08, 1, cut);
    const fade = 1 - smooth(0.5, 0.92, cut);
    outside.sleeve.visible = open && fade > 0.002;
    sleeveShift.copy(CUT_NORMAL).multiplyScalar(SLEEVE_LIFT * lift);
    outside.sleeve.position.set(-e * SLEEVE_SLIDE, 0, 0).add(sleeveShift);
    outside.setSleeveFade(fade);
    outside.setPrint(1 - smooth(0.05, 0.4, cut), outside.sleeve.position.x);
    placePlanes();
  };
  const local = new Plane();
  const placePlanes = (): void => {
    const g = outside.group;
    g.updateWorldMatrix(true, false);
    if (cut > 1e-4) {
      outside.keepFar.copy(local.set(CUT_NORMAL.clone().negate(), 0)).applyMatrix4(g.matrixWorld);
      outside.keepNear.copy(local.set(CUT_NORMAL, 0)).applyMatrix4(g.matrixWorld);
      // nothing of the sleeve is cut off at the minus end any more: it dissolves instead
      outside.pastMinus.set(new Vector3(0, 1, 0), FAR_AWAY);
    } else {
      // nothing clipped: the closed battery exactly as it always was
      outside.keepFar.set(new Vector3(0, 1, 0), FAR_AWAY);
    }
  };

  const inside: BatteryInside = {
    get cut() {
      return cut;
    },
    set cut(v: number) {
      cut = Math.min(Math.max(v, 0), 1);
      applyCut();
    },
    get life() {
      return life;
    },
    set life(v: number) {
      life = Math.min(Math.max(v, 0), 1);
      reaction.life = life;
      repaint();
    },
    get reaction() {
      return reactionParam;
    },
    set reaction(v: number) {
      reactionParam = Math.min(Math.max(v, 0), 1);
    },
    get activity() {
      return reaction.activity;
    },
    get surplus() {
      return poles.surplus;
    },
    set surplus(v: number) {
      poles.surplus = Math.min(Math.max(v, 0), 1);
    },
    get lack() {
      return poles.lack;
    },
    set lack(v: number) {
      poles.lack = Math.min(Math.max(v, 0), 1);
    },
    get mark() {
      return poles.mark;
    },
    set mark(v: number) {
      poles.mark = Math.min(Math.max(v, 0), 1);
    },
    get hold() {
      return poles.hold;
    },
    set hold(v: boolean) {
      poles.hold = v;
    },
    get current() {
      return poles.current;
    },
    set current(v: number) {
      poles.current = Math.min(Math.max(v, 0), 1);
    },
    clump: poles.clump,
    get surplusCount() {
      return poles.surplusCount;
    },
    get lackCount() {
      return poles.lackCount;
    },
    get island() {
      return island;
    },
    set island(v: number) {
      island = Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : 0;
    },
    get lamp() {
      return lamp;
    },
    set lamp(v: number) {
      lamp = Math.min(Math.max(v, 0), 1);
    },
    get highlight() {
      return highlight;
    },
    set highlight(v: BatteryLayer | null) {
      highlight = v;
    },
    layers,
    anchors: { minusCap, plusCap, section: sectionAnchor },
    pick(raycaster) {
      if (cut <= 0.5) return null;
      const hits = raycaster.intersectObjects(pickMeshes, false);
      if (!hits.length) return null;
      const near = hits[0]!.distance;
      const ids = new Set(
        hits.filter((h) => h.distance < near + 0.02).map((h) => h.object.userData.layer as BatteryLayer),
      );
      return PICK_ORDER.find((id) => ids.has(id)) ?? null;
    },
    update(dt, t) {
      islandShown += (island - islandShown) * (1 - Math.exp(-dt / 0.35));
      if (Math.abs(island - islandShown) < 1e-4) islandShown = island;
      const open = smooth(0.5, 0.95, cut);
      islandLight.intensity = ISLAND_PEAK * islandShown * islandShown * open * (1 - 0.7 * lamp);
      for (const id of LAYER_IDS) {
        const to = highlight === id ? 1 : 0;
        hi[id] += (to - hi[id]) * (1 - Math.exp(-dt / 0.12));
        if (Math.abs(hi[id] - to) < 1e-3) hi[id] = to;
      }
      repaint();
      if (cut > 1e-4) placePlanes();
      poles.update(dt, t, cut, life);
      reaction.activity = Math.max(reactionParam, poles.drive);
      reaction.update(dt, t, cut);
    },
  };
  applyCut();
  repaint();
  return inside;
}

const at = (x: number, y: number, z: number): Vector3 => boardToWorld(x, y, z);
const v3 = (v: Vector3): [number, number, number] => [v.x, v.y, v.z];
/** Looking into the cut from 42° above the horizon — 27° steeper than the cut's normal, so a sliver of the far
 * half's jacket shows above the cut and the battery reads as a cylinder, not a diagram. */
const INTO_CUT = new Vector3(0, 0.67, 0.74).normalize();

/**
 * Camera shots of the battery (world; `ctx.camera.shots({ ...STAGE_SHOTS, ...BATTERY_SHOTS })`):
 * `battery` the whole cut, clamps at the frame's sides · `batteryMinus` / `batteryPlus` a pole close up (for the
 * charges; the lens can lie over it) · `voltage` the battery with the meter above it, the number readable on a
 * phone. Use `STAGE_POST.lamp` as the post of the close-ups.
 */
export const BATTERY_SHOTS = (() => {
  const c = at(BATTERY.x, BATTERY.y, BATTERY.z);
  const minus = at(BATTERY.x - L / 2, BATTERY.y, BATTERY.z);
  const plusEnd = at(BATTERY.x + L / 2, BATTERY.y, BATTERY.z);
  const meter = at(BATTERY.x, BATTERY.y, BATTERY.z).lerp(GAUGE_HOME.clone().setY(0.4), 0.6);
  const shot = (target: Vector3, distance: number, radius: number, dir = INTO_CUT): Shot => ({
    position: v3(target.clone().addScaledVector(dir, distance)),
    target: v3(target),
    fov: STAGE_FOV,
    fit: { center: v3(target), radius },
  });
  return {
    battery: shot(c, 4.1, 1.25),
    batteryMinus: shot(
      minus.clone().add(new Vector3(0.1, 0, 0)),
      3.2,
      0.75,
      new Vector3(0.3, 0.62, 0.72).normalize(),
    ),
    batteryPlus: shot(
      plusEnd.clone().add(new Vector3(0.05, 0, 0)),
      3.2,
      0.75,
      new Vector3(-0.3, 0.62, 0.72).normalize(),
    ),
    voltage: shot(meter, 6.6, 1.6, new Vector3(0, 0.6, 0.8)),
  } satisfies Record<string, Shot>;
})();
