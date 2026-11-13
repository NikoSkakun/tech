/**
 * Level tube (M3): a glass tube with a coloured fill 0…1 — state of charge, tank level, thermometer column.
 * The pilot `lab-battery` built it three times (bench SOC, BMS glasses, thermometer). Origin: centre of the
 * base; the tube stands along +Y. Units: whatever you pass (default sizes are for a 0.3 m bench gauge).
 */
import { CylinderGeometry, Mesh, type Color } from 'three';
import { K, col, type ColorLike, type KToonMaterial } from '@/style';
import { Builder, type KitModel } from '../core/builder';

export interface LevelTubeOptions {
  /** Inner height of the fill column. Default 0.3. */
  height?: number;
  /** Outer radius of the glass. Default 0.025. */
  radius?: number;
  /** Fill colour (glows mildly). Default `lime`. */
  color?: ColorLike;
  /** Initial level 0…1. Default 0.5. */
  level?: number;
  /** Metal caps at both ends. Default true. */
  caps?: boolean;
  /** Scale marks on the glass every 1/n. Default 4 (quarters); 0 = none. */
  ticks?: number;
}

export interface LevelTube extends KitModel {
  /** 0…1 (clamped); tweenable. */
  level: number;
  /** The fill material (`color`, `emissiveIntensity` are tweenable). */
  readonly fill: KToonMaterial;
  setColor(c: ColorLike): void;
}

/** Anchors: `top`, `bottom`, `surface` (moves with the level — read it with `anchorWorld`). */
export function levelTube(o: LevelTubeOptions = {}): LevelTube {
  const H = o.height ?? 0.3;
  const R = o.radius ?? 0.025;
  const cap = R * 0.5;
  const b = new Builder('level-tube');
  if (o.caps ?? true) {
    b.cyl(R * 1.25, cap, { seg: 20, slot: 'metal', c: 'steel', bevel: cap * 0.3 });
    b.cyl(R * 1.25, cap, { seg: 20, slot: 'metal', c: 'steel', at: [0, H + cap, 0], bevel: cap * 0.3 });
  }
  const n = o.ticks ?? 4;
  for (let i = 1; i < n; i++) b.box(R * 0.5, H * 0.006, R * 0.12, { r: 0, slot: 'flat', c: 'white', at: [-R * 0.85, cap + (H * i) / n, R * 0.55] });
  b.anchor('bottom', 0, cap, 0);
  b.anchor('top', 0, H + cap, 0);
  b.anchor('surface', 0, cap, 0);
  const model = b.build();
  const glass = new Mesh(new CylinderGeometry(R, R, H, 24, 1, true), K.glass({ color: 'sky', opacity: 0.18, edgeOpacity: 0.65 }));
  glass.position.y = cap + H / 2;
  glass.renderOrder = 2;
  const geometry = new CylinderGeometry(R * 0.72, R * 0.72, 1, 20);
  geometry.translate(0, 0.5, 0);
  const color = col(o.color ?? 'lime');
  const fill = K.toon({ color, emissive: color, emissiveIntensity: 0.55, keepHue: true });
  const column = new Mesh(geometry, fill);
  column.name = 'level-tube:fill';
  column.position.y = cap;
  model.group.add(column, glass);
  const surface = model.anchor('surface');
  let level = 0;
  // accessors must be defined, not Object.assign-ed (assign would copy the getter's value)
  const tube = Object.defineProperties(model, {
    fill: { value: fill, enumerable: true },
    level: {
      enumerable: true,
      get: (): number => level,
      set: (v: number): void => {
        level = Math.min(Math.max(v, 0), 1);
        column.scale.y = Math.max(level, 1e-3) * H;
        column.visible = level > 0;
        surface.position.y = cap + level * H;
      },
    },
    setColor: {
      value: (c: ColorLike): void => {
        const v: Color = col(c);
        fill.color.copy(v);
        fill.emissive.copy(v);
      },
    },
  }) as LevelTube;
  tube.level = o.level ?? 0.5;
  return tube;
}
