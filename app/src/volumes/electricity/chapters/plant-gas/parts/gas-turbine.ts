/**
 * The hero gas turbine on the shaft line of the main hall: three section models (`gt-model.ts`), a cutaway
 * that removes the casing half facing the viewer («Розрізати» 0…100 %), section focus (one section stays lit,
 * the others are dimmed) and the slowed-down rotor spin. Origin of `group` = coupling on the shaft axis.
 */
import { Color, Group, Vector3, type Material, type Object3D } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createCutaway } from '@/fx';
import type { KitModel } from '@/kit';
import { GT_SECTIONS, buildGtModels, type GtSection } from './gt-model';

export interface HeroGt {
  group: Group;
  models: KitModel[];
  /** Casing cut 0 (closed) … 1 (half removed, longitudinal section). */
  cut: number;
  /** Section in focus (others dimmed), or null. */
  focus: GtSection | null;
  /** Rotor speed, rad/s (on screen: slowed down). */
  speed: number;
  /** World position of a named anchor of any section model (`igv`, `bleed`, `starter`, `fuel`, `burner`, `blade1`, `exhaust`…). */
  at(name: string, out?: Vector3): Vector3;
  /** World point on the axis at station x (metres from the coupling). */
  axis(x: number, out?: Vector3): Vector3;
  /** Pickable root of each section (for clicks). */
  pick: Record<GtSection, Object3D>;
  update(dt: number): void;
}

/** Normal of the cut: toward the viewer of steps 3–5 (south and 30° up), so the section faces the camera. */
const CUT_NORMAL = new Vector3(0, 0.45, 0.89).normalize();
const DIM = new Color(0.42, 0.4, 0.62);
const WHITE = new Color(1, 1, 1);

export function buildHeroGt(ctx: ChapterContext): HeroGt {
  const m = buildGtModels();
  const group = new Group();
  group.name = 'hero-gt';
  const models: KitModel[] = [];
  const pick = {} as Record<GtSection, Object3D>;
  const mats = {} as Record<GtSection, Material[]>;
  for (const s of GT_SECTIONS) {
    const holder = new Group();
    holder.name = `gt-${s}`;
    holder.add(m.inner[s].group, m.casing[s].group);
    group.add(holder);
    models.push(m.inner[s], m.casing[s]);
    pick[s] = holder;
    mats[s] = [...m.inner[s].mats.list(), ...m.casing[s].mats.list()];
  }
  const cutaway = createCutaway({ normal: [CUT_NORMAL.x, CUT_NORMAL.y, CUT_NORMAL.z], capColor: 'slate', hatch: 6 });
  for (const s of GT_SECTIONS) cutaway.apply(m.casing[s].group);
  ctx.onDispose(() => cutaway.dispose());
  const rotors = GT_SECTIONS.map((s) => m.inner[s].part(m.rotor));
  const tmp = new Vector3();
  const tint = new Color();
  let angle = 0;
  const gt: HeroGt = {
    group,
    models,
    cut: 0,
    focus: null,
    speed: 2.2,
    pick,
    at(name, out = new Vector3()) {
      for (const s of GT_SECTIONS) if (m.inner[s].anchors[name]) return m.inner[s].anchorWorld(name, out);
      throw new Error(`hero-gt: no anchor ${name}`);
    },
    axis(x, out = new Vector3()) {
      return group.localToWorld(out.set(x, 0, 0));
    },
    update(dt) {
      angle += gt.speed * dt;
      for (const r of rotors) r.rotation.x = angle;
      // the cut plane passes `k` metres in front of the axis: 2.6 (nothing removed) … 0 (half removed)
      group.getWorldPosition(tmp);
      cutaway.offset = CUT_NORMAL.dot(tmp) + 2.6 * (1 - gt.cut);
      cutaway.enabled = gt.cut > 0.001;
      for (const s of GT_SECTIONS) {
        tint.copy(gt.focus && gt.focus !== s ? DIM : WHITE);
        for (const mat of mats[s]) {
          const c = (mat as Material & { color?: Color }).color;
          if (c) c.lerp(tint, Math.min(1, dt * 6));
        }
      }
    },
  };
  return gt;
}
