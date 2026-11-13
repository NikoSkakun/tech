/**
 * PlotMesh — the data layer of a chart: antialiased polylines (ribbons) and filled areas of all series in one
 * dynamic mesh (one draw call per chart), rebuilt on the CPU whenever data changes — cheap enough for
 * 30–60 Hz live plots of a few thousand points.
 */
import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, ShaderMaterial, Vector4 } from 'three';
import type { Rgba } from '../core/painter';

const VERTEX = /* glsl */ `
attribute vec4 aColor;
attribute float aEdge;
varying vec4 vColor;
varying float vEdge;
varying vec2 vLocal;
void main() {
  vColor = aColor;
  vEdge = aEdge;
  vLocal = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform float uOpacity;
uniform vec4 uClip; // centre xy, half size zw in the mesh's local units; zw < 0: no clip (scroll views)
varying vec4 vColor;
varying float vEdge;
varying vec2 vLocal;
void main() {
  if ( uClip.z >= 0.0 && ( abs( vLocal.x - uClip.x ) > uClip.z || abs( vLocal.y - uClip.y ) > uClip.w ) ) discard;
  // ribbons carry aEdge = ±1 at their rims: one-pixel analytic antialiasing; fills carry 0
  float a = clamp( ( 1.0 - abs( vEdge ) ) / max( fwidth( vEdge ), 1e-4 ), 0.0, 1.0 );
  float alpha = vColor.a * a * uOpacity;
  if ( alpha < 0.003 ) discard;
  gl_FragColor = vec4( vColor.rgb, alpha );
}
`;

export class PlotMesh extends Mesh<BufferGeometry, ShaderMaterial> {
  private pos = new Float32Array(3 * 1024);
  private col = new Float32Array(4 * 1024);
  private edge = new Float32Array(1024);
  private idx = new Uint32Array(3 * 1024);
  private nv = 0;
  private ni = 0;

  constructor() {
    super(
      new BufferGeometry(),
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: { uOpacity: { value: 1 }, uClip: { value: new Vector4(0, 0, -1, -1) } },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    this.frustumCulled = false;
    this.name = 'ui-plot';
  }

  set opacity(v: number) {
    this.material.uniforms.uOpacity!.value = v;
  }

  /** Start a new picture. */
  begin(): void {
    this.nv = 0;
    this.ni = 0;
  }

  private reserve(vertices: number, indices: number): void {
    if (this.nv + vertices > this.edge.length) {
      const n = Math.max(this.edge.length * 2, this.nv + vertices);
      const grow = (a: Float32Array, per: number): Float32Array<ArrayBuffer> => {
        const b = new Float32Array(n * per);
        b.set(a);
        return b;
      };
      this.pos = grow(this.pos, 3);
      this.col = grow(this.col, 4);
      this.edge = grow(this.edge, 1);
    }
    if (this.ni + indices > this.idx.length) {
      const b = new Uint32Array(Math.max(this.idx.length * 2, this.ni + indices));
      b.set(this.idx);
      this.idx = b;
    }
  }

  private vertex(x: number, y: number, c: Rgba, alpha: number, e: number): number {
    const i = this.nv++;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = 0;
    this.col[i * 4] = c[0];
    this.col[i * 4 + 1] = c[1];
    this.col[i * 4 + 2] = c[2];
    this.col[i * 4 + 3] = c[3] * alpha;
    this.edge[i] = e;
    return i;
  }

  /** Polyline through `n` points (`xy` = x0, y0, x1, y1, … in local units) with round-ish mitred joins. */
  line(xy: ArrayLike<number>, n: number, width: number, color: Rgba): void {
    if (n < 2) return;
    this.reserve(n * 2, (n - 1) * 6);
    const half = width / 2 + 0.75;
    let prev = -1;
    for (let i = 0; i < n; i++) {
      const x = xy[i * 2]!;
      const y = xy[i * 2 + 1]!;
      const ax = x - xy[Math.max(i - 1, 0) * 2]!;
      const ay = y - xy[Math.max(i - 1, 0) * 2 + 1]!;
      const bx = xy[Math.min(i + 1, n - 1) * 2]! - x;
      const by = xy[Math.min(i + 1, n - 1) * 2 + 1]! - y;
      const la = Math.hypot(ax, ay) || 1;
      const lb = Math.hypot(bx, by) || 1;
      // averaged normal of the two adjacent segments, lengthened at corners (mitre, limited to 2×)
      let nx = -(ay / la + by / lb);
      let ny = ax / la + bx / lb;
      const ln = Math.hypot(nx, ny);
      if (ln < 1e-6) {
        nx = -by / lb;
        ny = bx / lb;
      } else {
        const mitre = Math.min(2 / ln, 2) / ln;
        nx *= mitre;
        ny *= mitre;
      }
      const a = this.vertex(x + nx * half, y + ny * half, color, 1, 1);
      this.vertex(x - nx * half, y - ny * half, color, 1, -1);
      if (prev >= 0) {
        this.idx.set([prev, prev + 1, a, a, prev + 1, a + 1], this.ni);
        this.ni += 6;
      }
      prev = a;
    }
  }

  /** Filled band between two polylines sharing x (`top` and `bottom` as x, y pairs), with a vertical alpha ramp. */
  area(
    top: ArrayLike<number>,
    bottom: ArrayLike<number>,
    n: number,
    color: Rgba,
    alphaTop = 0.55,
    alphaBottom = 0.12,
  ): void {
    if (n < 2) return;
    this.reserve(n * 2, (n - 1) * 6);
    let prev = -1;
    for (let i = 0; i < n; i++) {
      const a = this.vertex(top[i * 2]!, top[i * 2 + 1]!, color, alphaTop, 0);
      this.vertex(bottom[i * 2]!, bottom[i * 2 + 1]!, color, alphaBottom, 0);
      if (prev >= 0) {
        this.idx.set([prev, prev + 1, a, a, prev + 1, a + 1], this.ni);
        this.ni += 6;
      }
      prev = a;
    }
  }

  /** Upload the picture built since `begin()`. */
  end(): void {
    const g = this.geometry;
    const cap = (g.getAttribute('position') as BufferAttribute | undefined)?.count ?? 0;
    const icap = g.index?.count ?? 0;
    if (cap < this.nv || icap < this.ni || cap === 0) {
      // buffers grew: let three re-create the GL objects
      g.dispose();
      g.setAttribute('position', new BufferAttribute(this.pos, 3));
      g.setAttribute('aColor', new BufferAttribute(this.col, 4));
      g.setAttribute('aEdge', new BufferAttribute(this.edge, 1));
      g.setIndex(new BufferAttribute(this.idx, 1));
    }
    for (const name of ['position', 'aColor', 'aEdge'])
      (g.getAttribute(name) as BufferAttribute).needsUpdate = true;
    g.index!.needsUpdate = true;
    g.setDrawRange(0, this.ni);
  }

  override dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
