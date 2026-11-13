/**
 * `windField` — the wind made visible (document, «Наскрізна візуальна ідея»): translucent `white` → `mist`
 * streaks streaming with the wind; their length and travel speed follow the wind speed, and behind every rotor
 * they shorten and darken to `slate` — the wake. One instanced draw call, animated in the vertex shader from an
 * offset integrated on the CPU (so speed changes never make the streaks jump).
 *
 * The darkening uses the same Jensen expansion as `wakeDeficit` of `@electricity/sim/plant-wind` (r_w = D/2 + k·x,
 * Gaussian cross profile); it is a drawing, the numbers shown elsewhere come from the simulation itself.
 */
import { Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, NormalBlending, ShaderMaterial, Vector2, Vector3, Vector4, type BufferGeometry } from 'three';
import type { ChapterContext } from '@/engine/api';
import { col } from '@/style';
import { WIND, flowDir } from '../layout';
import { WIND_FRAGMENT, WIND_VERTEX } from './wind-shader';

export const MAX_WAKES = 20;
const SEGMENTS = 10;

export interface WindField {
  mesh: Mesh<BufferGeometry, ShaderMaterial>;
  /** Wind speed, m/s: drives streak travel and length. */
  speed: number;
  /** Compass direction the wind comes from, degrees. */
  fromDeg: number;
  /** 0…1 overall visibility (tweenable). */
  opacity: number;
  /** Box the streaks fill: centre x/z, lowest height; extent along the wind, height range, across. */
  readonly centre: Vector3;
  readonly size: Vector3;
  /** Rotor discs that leave wakes: hub position and rotor radius (metres). Call `commitWakes` after edits. */
  setWake(i: number, hub: Vector3, radius: number, strength?: number): void;
  setWakeCount(n: number): void;
  update(dt: number): void;
}

export function buildWindField(ctx: ChapterContext, count = 300): WindField {
  const n = ctx.quality.count(count, 120);
  const rng = ctx.random.fork('wind');
  const geometry = new InstancedBufferGeometry();
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    pos.push(i / SEGMENTS, -1, 0, i / SEGMENTS, 1, 0);
    if (i < SEGMENTS) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  geometry.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geometry.setIndex(idx);
  const seeds = new Float32Array(n * 4);
  for (let i = 0; i < n * 4; i++) seeds[i] = rng.next();
  geometry.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 4));
  geometry.instanceCount = n;
  const wakes = Array.from({ length: MAX_WAKES }, () => new Vector4(0, -9999, 0, 1));
  const material = new ShaderMaterial({
    name: 'plant-wind.windField',
    uniforms: {
      uOffset: { value: 0 },
      uDir: { value: new Vector2(1, 0) },
      uCentre: { value: new Vector3(0, 20, 0) },
      uSize: { value: new Vector3(520, 70, 300) },
      uShape: { value: new Vector4(18, 0.34, 1, WIND.streakSpeed) }, // length, half-width, opacity, m per (m/s)
      uColor: { value: col('white') },
      uTail: { value: col('mist') },
      uWakeColor: { value: col('slate') },
      uWakes: { value: wakes },
      uWakeStrength: { value: new Float32Array(MAX_WAKES).fill(1) },
      uWakeCount: { value: 0 },
    },
    vertexShader: WIND_VERTEX,
    fragmentShader: WIND_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'wind-field';
  mesh.frustumCulled = false;
  mesh.raycast = () => undefined;
  mesh.renderOrder = 4;
  const u = material.uniforms;
  const field: WindField = {
    mesh,
    speed: WIND.speed,
    fromDeg: WIND.fromDeg,
    opacity: 1,
    centre: u.uCentre!.value as Vector3,
    size: u.uSize!.value as Vector3,
    setWake(i, hub, radius, strength = 1) {
      wakes[i]!.set(hub.x, hub.y, hub.z, radius);
      (u.uWakeStrength!.value as Float32Array)[i] = strength;
    },
    setWakeCount(k) {
      u.uWakeCount!.value = Math.min(k, MAX_WAKES);
    },
    update(dt) {
      const f = flowDir(field.fromDeg);
      (u.uDir!.value as Vector2).set(f.x, f.z);
      u.uOffset!.value = ((u.uOffset!.value as number) + field.speed * WIND.streakSpeed * dt) % 1e5;
      const shape = u.uShape!.value as Vector4;
      // a streak is as long as the air travels in ≈ 1.1 s at toy speed: a calm is dots, a storm long strokes
      shape.x = 3 + field.speed * WIND.streakSpeed * 1.1;
      shape.z = field.opacity * Math.min(1, 0.25 + field.speed / 6);
    },
  };
  return field;
}
