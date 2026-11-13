/**
 * Probability cloud — thousands of soft additive dots, each one a possible position of a particle (the
 * "fuzzy" electron of an orbital, the electron sea of a metal, carriers in a band). Two uses: a static
 * distribution (`setPoints`) and a live one fed from a simulation's ring buffer of positions + ages (`sync`:
 * every dot is one "measurement" that flashes and fades). One draw call (`Points`).
 *
 * Generalised in M3 from the pilot chapter `atom` (`parts/cloud.ts`, which keeps its own copy). Additive
 * light: put it on the overlay layer (`toOverlay`) so depth of field does not smear it.
 */
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial, Vector2, type Color } from 'three';
import { col, kGlobals, type ColorLike } from '@/style';

export interface CloudOptions {
  /** Maximum number of dots. */
  capacity: number;
  color?: ColorLike;
  /** Colour of fresh dots (they cool down to `color`). */
  flash?: ColorLike;
  /** Dot diameter in local units. */
  size?: number;
  /** Lifetime of a dot when bound to live data, s. */
  lifetime?: number;
  intensity?: number;
}

const VERTEX = /* glsl */ `
  attribute float aAge;
  uniform float uKTime, uPixel, uSize, uLife, uFade, uSpread, uSwirl;
  varying float vAlpha;
  varying float vFresh;
  float hash( float n ) { return fract( sin( n * 12.9898 ) * 43758.5453 ); }
  void main() {
    float id = float( gl_VertexID );
    float seed = hash( id );
    vec3 p = position * uSpread;
    // slow differential swirl around Y keeps a static cloud alive
    float a = uKTime * uSwirl * ( 0.5 + seed );
    float c = cos( a ), s = sin( a );
    p = vec3( p.x * c - p.z * s, p.y, p.x * s + p.z * c );
    vec4 mv = modelViewMatrix * vec4( p, 1.0 );
    gl_Position = projectionMatrix * mv;
    float life = clamp( 1.0 - aAge / uLife, 0.0, 1.0 );
    vFresh = 1.0 - smoothstep( 0.0, 0.35, aAge );
    float twinkle = 0.7 + 0.3 * sin( uKTime * ( 1.3 + seed * 2.0 ) + seed * 40.0 );
    // dithered dissolve for stage fades: dots vanish one by one
    float keep = step( hash( id + 3.7 ), uFade * 1.001 );
    vAlpha = life * twinkle * keep;
    float size = uSize * ( 0.75 + 0.5 * seed ) * ( 1.0 + 0.9 * vFresh );
    gl_PointSize = vAlpha > 0.0 ? max( size * uPixel / max( -mv.z, 1e-3 ), 1.5 ) : 0.0;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor, uFlash;
  uniform float uIntensity;
  varying float vAlpha;
  varying float vFresh;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r2 = dot( d, d ) * 4.0;
    if ( r2 > 1.0 ) discard;
    float soft = exp( -r2 * 3.2 ) - 0.04;
    vec3 color = mix( uColor, uFlash, vFresh * 0.8 );
    gl_FragColor = vec4( color * soft * vAlpha * uIntensity * ( 1.0 + vFresh ), 0.0 );
  }
`;

const _size = new Vector2();

export class ProbabilityCloud extends Points<BufferGeometry, ShaderMaterial> {
  readonly capacity: number;
  private readonly positionAttr: BufferAttribute;
  private readonly ageAttr: BufferAttribute;

  constructor(opts: CloudOptions) {
    const geometry = new BufferGeometry();
    const position = new BufferAttribute(new Float32Array(opts.capacity * 3), 3);
    const age = new BufferAttribute(new Float32Array(opts.capacity), 1);
    geometry.setAttribute('position', position);
    geometry.setAttribute('aAge', age);
    geometry.setDrawRange(0, 0);
    const material = new ShaderMaterial({
      name: 'fx.cloud',
      uniforms: {
        uKTime: kGlobals.uKTime,
        uPixel: { value: 600 },
        uSize: { value: opts.size ?? 0.12 },
        uLife: { value: opts.lifetime ?? 6 },
        uFade: { value: 1 },
        uSpread: { value: 1 },
        uSwirl: { value: 0 },
        uIntensity: { value: opts.intensity ?? 0.9 },
        uColor: { value: col(opts.color ?? 'cyan') },
        uFlash: { value: col(opts.flash ?? 'white') },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      premultipliedAlpha: true, // alpha 0 + ONE/ONE: purely additive light
    });
    super(geometry, material);
    this.name = 'cloud';
    this.capacity = opts.capacity;
    this.frustumCulled = false;
    this.positionAttr = position;
    this.ageAttr = age;
    this.raycast = () => undefined;
    // dot size in pixels: 0.5 · target height · P11 (works for any render scale / off-axis projection)
    this.onBeforeRender = (renderer, _scene, camera) => {
      const target = renderer.getRenderTarget();
      const height = target ? target.height : renderer.getDrawingBufferSize(_size).y;
      material.uniforms.uPixel!.value = 0.5 * height * camera.projectionMatrix.elements[5]!;
    };
  }

  /** Static distribution: `count` points (xyz), all fully alive. */
  setPoints(positions: Float32Array, count = positions.length / 3): void {
    const n = Math.min(count, this.capacity);
    (this.positionAttr.array as Float32Array).set(positions.subarray(0, n * 3));
    (this.ageAttr.array as Float32Array).fill(1, 0, n); // past the birth flash, never expiring (uLife below)
    this.positionAttr.needsUpdate = true;
    this.ageAttr.needsUpdate = true;
    this.geometry.setDrawRange(0, n);
    this.material.uniforms.uLife!.value = 1e9;
  }

  /** Live data: copy a simulation's positions (xyz) and ages (s) — call every frame the cloud is visible. */
  sync(positions: Float32Array, ages: Float32Array): void {
    const n = Math.min(ages.length, this.capacity);
    (this.positionAttr.array as Float32Array).set(positions.subarray(0, n * 3));
    const out = this.ageAttr.array as Float32Array;
    for (let i = 0; i < n; i++) out[i] = Number.isFinite(ages[i]!) ? ages[i]! : 1e9;
    this.positionAttr.needsUpdate = true;
    this.ageAttr.needsUpdate = true;
    this.geometry.setDrawRange(0, n);
  }

  private uniform(name: string): { value: number } {
    return this.material.uniforms[name] as { value: number };
  }
  /** Dithered dissolve 0…1 (stage `appear: 'fade'`). */
  get fade(): number {
    return this.uniform('uFade').value;
  }
  set fade(v: number) {
    this.uniform('uFade').value = v;
  }
  /** Brightness (tweenable). */
  get intensity(): number {
    return this.uniform('uIntensity').value;
  }
  set intensity(v: number) {
    this.uniform('uIntensity').value = v;
  }
  /** Radial scale of the distribution (tweenable): the cloud swells / parts without touching the dot size. */
  get spread(): number {
    return this.uniform('uSpread').value;
  }
  set spread(v: number) {
    this.uniform('uSpread').value = v;
  }
  /** Swirl speed around Y, rad/s (0 for orbitals whose shape matters). */
  get swirl(): number {
    return this.uniform('uSwirl').value;
  }
  set swirl(v: number) {
    this.uniform('uSwirl').value = v;
  }
  /** Dot diameter in local units (tweenable). */
  get dotSize(): number {
    return this.uniform('uSize').value;
  }
  set dotSize(v: number) {
    this.uniform('uSize').value = v;
  }
  /** Base and fresh-dot colours (live `Color`s). */
  get color(): Color {
    return this.material.uniforms.uColor!.value as Color;
  }
  get flash(): Color {
    return this.material.uniforms.uFlash!.value as Color;
  }

  /**
   * Fill a static distribution by sampling: `sample(i, out)` writes one point; e.g. rejection-sample |ψ|².
   * Uses `count` ≤ capacity points.
   */
  fill(count: number, sample: (i: number, out: [number, number, number]) => void): void {
    const n = Math.min(count, this.capacity);
    const pts = new Float32Array(n * 3);
    const p: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      sample(i, p);
      pts.set(p, i * 3);
    }
    this.setPoints(pts, n);
  }

  override dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

/** Factory (same as `new ProbabilityCloud(opts)`). */
export function createProbabilityCloud(opts: CloudOptions): ProbabilityCloud {
  return new ProbabilityCloud(opts);
}
