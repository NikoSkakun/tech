/**
 * The copper jumper («перемичка») of step 5: a thick bare wire bent into a flat arch with a clip on each end.
 * It eases toward `target` (centre between two terminals) and stretches to `span` (distance between them), so
 * the same piece bridges the lamp (1.16) or the battery holder (2.24). `heat` makes it glow.
 */
import { CatmullRomCurve3, Mesh, SphereGeometry, TubeGeometry, Vector3, Group } from 'three';
import { damp } from '@/engine/api';
import { applyHeat } from '@/fx';
import { K, col } from '@/style';

export interface Jumper {
  group: Group;
  target: Vector3;
  span: number;
  /** While true the jumper follows `target` instantly (pointer drag). */
  held: boolean;
  heat: number;
  update(dt: number, t: number): void;
}

const BASE_SPAN = 1.16;

function archCurve(): CatmullRomCurve3 {
  const h = BASE_SPAN / 2;
  return new CatmullRomCurve3(
    [
      new Vector3(-h, 0.14, 0),
      new Vector3(-h * 0.92, 0.2, 0.42),
      new Vector3(0, 0.24, 0.62),
      new Vector3(h * 0.92, 0.2, 0.42),
      new Vector3(h, 0.14, 0),
    ],
    false,
    'centripetal',
  );
}

export interface JumperGhost {
  group: Group;
  /** 0 = hidden … 1 = full glow. */
  strength: number;
  span: number;
  update(t: number): void;
}

/**
 * A glowing outline of the jumper where it can be dropped: the idle invitation on the lamp («перетягніть
 * сюди» without words), and the snap targets while the jumper is carried.
 */
export function createJumperGhost(): JumperGhost {
  const g = new Group();
  g.name = 'jumper-ghost';
  const mat = K.glow({ color: 'cyan', intensity: 0, falloff: 0, whiten: 0, keepHue: true });
  const h = BASE_SPAN / 2;
  const clip = new SphereGeometry(0.13, 14, 10);
  const c1 = new Mesh(clip, mat);
  c1.position.set(-h, 0.16, 0);
  const c2 = new Mesh(clip, mat);
  c2.position.set(h, 0.16, 0);
  g.add(new Mesh(new TubeGeometry(archCurve(), 40, 0.04, 8), mat), c1, c2);
  const self: JumperGhost = {
    group: g,
    strength: 0,
    span: BASE_SPAN,
    update(t) {
      g.visible = self.strength > 0.01;
      g.scale.x = self.span / BASE_SPAN;
      mat.intensity = self.strength * (0.55 + 0.35 * Math.sin(t * 3.2));
    },
  };
  return self;
}

export function createJumper(): Jumper {
  const g = new Group();
  g.name = 'jumper';
  const mat = K.metal({ color: col('orange').lerp(col('amber'), 0.3), specular: 0.9, shininess: 70 });
  const h = BASE_SPAN / 2;
  const bar = new Mesh(new TubeGeometry(archCurve(), 40, 0.065, 12), mat);
  bar.castShadow = true;
  const clip = new SphereGeometry(0.12, 16, 12);
  const c1 = new Mesh(clip, mat);
  c1.position.set(-h, 0.16, 0);
  const c2 = new Mesh(clip, mat);
  c2.position.set(h, 0.16, 0);
  g.add(bar, c1, c2);
  let span = BASE_SPAN;
  const self: Jumper = {
    group: g,
    target: new Vector3(),
    span: BASE_SPAN,
    held: false,
    heat: 0,
    update(dt, t) {
      const k = self.held ? 40 : 9;
      g.position.x = damp(g.position.x, self.target.x, k, dt);
      g.position.z = damp(g.position.z, self.target.z, k, dt);
      // lifted while carried, with a little idle bob so that it reads as "pick me up" when parked
      const lift = self.held ? 0.35 : self.target.y + 0.02 * Math.sin(t * 2.4);
      g.position.y = damp(g.position.y, lift, k, dt);
      span = damp(span, self.span, 10, dt);
      g.scale.x = span / BASE_SPAN;
      applyHeat(mat, self.heat, 2.6);
    },
  };
  return self;
}
