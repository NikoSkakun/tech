/**
 * Instanced billboard quads: the shared base geometry of sprites, impostor orbs and ribbons.
 */
import {
  BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Sphere,
  Vector3,
  type TypedArray,
} from 'three';

/** A unit quad (`position.xy` in −0.5…0.5, `uv` 0…1) ready for instanced attributes. */
export function instancedQuad(instances: number): InstancedBufferGeometry {
  const g = new InstancedBufferGeometry();
  g.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3),
  );
  g.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.instanceCount = instances;
  // positions are computed in the vertex shader: give three a bounding sphere so it never computes a wrong one
  g.boundingSphere = new Sphere(new Vector3(), Infinity);
  return g;
}

/**
 * A strip along X: `segments + 1` cross-sections of two vertices. `position.x` = 0…1 along the strip,
 * `position.y` = ∓0.5 across. Base geometry of ribbons whose shape is computed in the vertex shader.
 */
export function instancedStrip(segments: number, instances: number): InstancedBufferGeometry {
  const g = new InstancedBufferGeometry();
  const n = segments + 1;
  const position = new Float32Array(n * 2 * 3);
  const index: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = i / segments;
    position.set([x, -0.5, 0, x, 0.5, 0], i * 6);
    if (i < segments) {
      const a = i * 2;
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  g.setAttribute('position', new BufferAttribute(position, 3));
  g.setIndex(index);
  g.instanceCount = instances;
  g.boundingSphere = new Sphere(new Vector3(), Infinity);
  return g;
}

/** Add an instanced attribute backed by a new typed array; returns the attribute. */
export function instanced<T extends TypedArray>(
  g: InstancedBufferGeometry,
  name: string,
  array: T,
  itemSize: number,
): InstancedBufferAttribute {
  const a = new InstancedBufferAttribute(array, itemSize);
  g.setAttribute(name, a);
  return a;
}
