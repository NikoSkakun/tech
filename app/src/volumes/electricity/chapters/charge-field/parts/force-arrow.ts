/**
 * Force arrow of the document: «товста, `white` з обідком кольору заряду». A lit white body (so it reads as a
 * solid object, not as a glowing bar) inside an inverted hull in the colour of the ball the force acts on —
 * the rim tells which ball owns the arrow even where the two arrows of a pair run past each other.
 */
import { BackSide, ConeGeometry, CylinderGeometry, Group, Mesh, Vector3 } from 'three';
import { hex, K, type ColorLike } from '@/style';

const Y = new Vector3(0, 1, 0);
const _v = new Vector3();

export interface ForceArrow {
  group: Group;
  /** Place the arrow: tail at `origin`, spanning `vector` (parent units). Hidden below a hair's length. */
  set(origin: Vector3, vector: Vector3): void;
  /** Colour of the rim (the charge colour of the ball). */
  setRim(color: ColorLike): void;
}

export function createForceArrow(
  o: { radius?: number; head?: number; headRadius?: number; rim?: number } = {},
): ForceArrow {
  const r = o.radius ?? 0.075;
  const headLength = o.head ?? 0.4;
  const headRadius = o.headRadius ?? 0.21;
  const w = o.rim ?? 0.04;
  const group = new Group();
  group.name = 'force-arrow';
  const body = K.toon({ color: 'white', emissive: 'white', emissiveIntensity: 0.35, highlight: 0.3 });
  const rim = K.glow({ color: 'coral', whiten: 0, keepHue: true, intensity: 1.35, falloff: 0 });
  rim.side = BackSide;
  const unit = (radius: number): CylinderGeometry =>
    new CylinderGeometry(radius, radius, 1, 20, 1).translate(0, 0.5, 0);
  const cone = (radius: number, length: number): ConeGeometry =>
    new ConeGeometry(radius, length, 28).translate(0, length / 2, 0);
  const shaft = new Mesh(unit(r), body);
  const head = new Mesh(cone(headRadius, headLength), body);
  // inverted hull: the same silhouette pushed out by `w` (the cone grows so that its slanted side moves by w too)
  const slant = Math.hypot(headRadius, headLength) / headRadius;
  const hullLength = headLength + w * slant + w;
  const shaftHull = new Mesh(unit(r + w), rim);
  const headHull = new Mesh(cone((headRadius * hullLength) / headLength, hullLength), rim);
  group.add(shaftHull, headHull, shaft, head);
  let rimHex = '';

  return {
    group,
    set(origin, vector) {
      const length = _v.copy(vector).length();
      group.visible = length > 0.04;
      if (!group.visible) return;
      group.position.copy(origin);
      group.quaternion.setFromUnitVectors(Y, _v.divideScalar(length));
      // a short vector shrinks the whole head instead of letting it poke out behind the tail
      const k = Math.min(1, (length * 0.62) / headLength);
      const neck = length - headLength * k;
      shaft.scale.set(k, Math.max(neck, 1e-4), k);
      shaftHull.scale.set(k, Math.max(neck + w * k, 1e-4), k);
      shaftHull.position.y = -w * k;
      head.position.y = neck;
      head.scale.setScalar(k);
      headHull.position.y = neck - w * k;
      headHull.scale.setScalar(k);
    },
    setRim(color) {
      const next = hex(color);
      if (next !== rimHex) rim.setColor(color);
      rimHex = next;
    },
  };
}
