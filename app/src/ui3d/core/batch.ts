/**
 * GPU batches of the widget kit. A whole UI surface — every panel, button, track, ring, icon and every glyph —
 * is drawn with two draw calls per layer:
 *
 *   ShapeBatch  instanced quads; the fragment shader evaluates an analytic SDF per instance (rounded
 *               rectangle, hologlass panel, arc/ring, icon from the SDF atlas) with fill gradient, inner
 *               border, outer glow, dashes — crisp at any size, tilt or zoom;
 *   GlyphBatch  SDF text quads of all text blocks (same atlas and edge maths as `Text3D`).
 *
 * Transforms and opacity do not live in the vertex buffers: every primitive carries the index of its UI node
 * and the vertex shader fetches the node's matrix from a small float texture (`XformTexture`). Animating a
 * panel (slide, pop, fade) therefore only rewrites a few texels, never geometry.
 */
import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  DoubleSide,
  FloatType,
  InstancedBufferGeometry,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  Mesh,
  NearestFilter,
  RGBAFormat,
  ShaderMaterial,
  Vector2,
  Vector4,
} from 'three';
import { kGlobals } from '@/style';
import { fontAtlas, fontData } from '@/text';
import { ICON_GRID, iconAtlas, iconRows } from './icons';

/** Shape kinds understood by the shape shader. */
export const KIND = { rect: 0, panel: 1, arc: 2, icon: 3 } as const;

/** Floats per shape instance. */
export const SHAPE_STRIDE = 32;
/** Floats per glyph vertex: position 3, uv 2, colour 4, meta 3 (atlas layer, node, clip). */
export const GLYPH_STRIDE = 12;

const NODES_PER_ROW = 64;
const TEXELS_PER_NODE = 4;

/** Per-node transform store: 3 rows of an affine matrix + (opacity, half width, half height, clip feather). */
export class XformTexture {
  readonly texture: DataTexture;
  data: Float32Array;
  private rows: number;

  constructor(rows = 8) {
    this.rows = rows;
    this.data = new Float32Array(NODES_PER_ROW * TEXELS_PER_NODE * rows * 4);
    this.texture = this.make();
  }

  get capacity(): number {
    return this.rows * NODES_PER_ROW;
  }

  /** Grow to hold `count` nodes. Returns true when the texture object's image was replaced. */
  ensure(count: number): boolean {
    if (count <= this.capacity) return false;
    while (this.rows * NODES_PER_ROW < count) this.rows *= 2;
    this.data = new Float32Array(NODES_PER_ROW * TEXELS_PER_NODE * this.rows * 4);
    this.texture.dispose();
    this.texture.image = { data: this.data, width: NODES_PER_ROW * TEXELS_PER_NODE, height: this.rows };
    this.texture.needsUpdate = true;
    return true;
  }

  dispose(): void {
    this.texture.dispose();
  }

  private make(): DataTexture {
    const t = new DataTexture(this.data, NODES_PER_ROW * TEXELS_PER_NODE, this.rows, RGBAFormat, FloatType);
    t.minFilter = NearestFilter;
    t.magFilter = NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  }
}

const XFORM_GLSL = /* glsl */ `
uniform highp sampler2D uXform;
vec4 uiNode( int idx, int k ) {
  return texelFetch( uXform, ivec2( ( idx % ${NODES_PER_ROW} ) * ${TEXELS_PER_NODE} + k, idx / ${NODES_PER_ROW} ), 0 );
}
// node-local point → surface space; also resolves the clip rectangle (in the clip node's local space)
vec3 uiPlace( vec3 local, float node, float clip, out float opacity, out vec4 clipRect, out vec2 clipInfo ) {
  int idx = int( node + 0.5 );
  vec4 r0 = uiNode( idx, 0 );
  vec4 r1 = uiNode( idx, 1 );
  vec4 r2 = uiNode( idx, 2 );
  opacity = uiNode( idx, 3 ).x;
  vec4 lp = vec4( local, 1.0 );
  vec3 sp = vec3( dot( r0, lp ), dot( r1, lp ), dot( r2, lp ) );
  clipRect = vec4( 0.0 );
  clipInfo = vec2( 0.0 );
  if ( clip > -0.5 ) {
    int c = int( clip + 0.5 );
    vec4 c0 = uiNode( c, 0 );
    vec4 c1 = uiNode( c, 1 );
    vec4 c2 = uiNode( c, 2 );
    vec4 cd = uiNode( c, 3 );
    vec3 rel = sp - vec3( c0.w, c1.w, c2.w );
    vec3 ax = vec3( c0.x, c1.x, c2.x );
    vec3 ay = vec3( c0.y, c1.y, c2.y );
    clipRect = vec4( dot( rel, ax ) / max( dot( ax, ax ), 1e-8 ), dot( rel, ay ) / max( dot( ay, ay ), 1e-8 ), cd.y, cd.z );
    clipInfo = vec2( 1.0, cd.w );
  }
  return sp;
}
`;

const CLIP_FRAG_GLSL = /* glsl */ `
varying vec4 vClipRect;
varying vec2 vClipInfo;
float uiClip() {
  if ( vClipInfo.x < 0.5 ) return 1.0;
  vec2 q = vClipRect.zw - abs( vClipRect.xy );
  float m = min( q.x, q.y );
  float a = clamp( m / max( fwidth( m ), 1e-4 ) + 0.5, 0.0, 1.0 );
  // optional soft fade at the top / bottom edge (scroll views)
  if ( vClipInfo.y > 0.0 ) a *= smoothstep( 0.0, vClipInfo.y, q.y );
  return a;
}
`;

const SHAPE_VERTEX = /* glsl */ `
attribute vec4 aRect;    // centre x, centre y, width, height (node-local units)
attribute vec4 aMisc;    // z, corner radius, node index, kind
attribute vec4 aFill;
attribute vec4 aFill2;
attribute vec4 aBorder;
attribute vec4 aParams;  // border width, glow size, glow alpha, emissive
attribute vec4 aExtra;   // p0, p1, p2 (kind specific), rotation
attribute vec4 aAux;     // clip node (−1 none), dash period, gradient amount, spare
${XFORM_GLSL}
varying vec2 vP;
varying vec2 vHalf;
varying vec4 vMisc;
varying vec4 vFill;
varying vec4 vFill2;
varying vec4 vBorder;
varying vec4 vParams;
varying vec4 vExtra;
varying vec4 vAux;
varying vec4 vClipRect;
varying vec2 vClipInfo;
void main() {
  float margin = aParams.y + 1.5;
  vec2 size = aRect.zw + 2.0 * margin;
  vec2 q = position.xy * size;
  vP = q;
  vHalf = 0.5 * aRect.zw;
  float cr = cos( aExtra.w );
  float sr = sin( aExtra.w );
  vec2 local = aRect.xy + vec2( q.x * cr - q.y * sr, q.x * sr + q.y * cr );
  float opacity;
  vec3 sp = uiPlace( vec3( local, aMisc.x ), aMisc.z, aAux.x, opacity, vClipRect, vClipInfo );
  vMisc = vec4( aMisc.y, aMisc.w, opacity, 0.0 );
  vFill = aFill;
  vFill2 = aFill2;
  vBorder = aBorder;
  vParams = aParams;
  vExtra = aExtra;
  vAux = aAux;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( sp, 1.0 );
  if ( opacity < 0.004 ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); // hidden node: cull
}
`;

const SHAPE_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D uIcons;
uniform vec4 uIconGrid;   // cols, rows, design units, distance range (design units)
uniform float uKTime;
varying vec2 vP;
varying vec2 vHalf;
varying vec4 vMisc;       // radius, kind, opacity
varying vec4 vFill;
varying vec4 vFill2;
varying vec4 vBorder;
varying vec4 vParams;
varying vec4 vExtra;
varying vec4 vAux;
${CLIP_FRAG_GLSL}
float sdRoundBox( vec2 p, vec2 b, float r ) {
  vec2 q = abs( p ) - b + r;
  return length( max( q, 0.0 ) ) + min( max( q.x, q.y ), 0.0 ) - r;
}
// arc of radius ra and half-thickness rb, centred on angle mid (clockwise from 12 o'clock), half-aperture ha
float sdArc( vec2 p, float mid, float ha, float ra, float rb ) {
  float cm = cos( mid );
  float sm = sin( mid );
  p = vec2( p.x * cm - p.y * sm, p.x * sm + p.y * cm );
  if ( ha >= 3.14159 ) return abs( length( p ) - ra ) - rb;
  vec2 sc = vec2( sin( ha ), cos( ha ) );
  p.x = abs( p.x );
  return ( sc.y * p.x > sc.x * p.y ? length( p - sc * ra ) : abs( length( p ) - ra ) ) - rb;
}
float hash( vec2 p ) {
  return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 );
}
void main() {
  float kind = vMisc.y;
  float opacity = vMisc.z * uiClip();
  if ( opacity < 0.004 ) discard;
  float bw = vParams.x;
  float glowSize = vParams.y;
  vec4 fill = vFill;
  float d;
  if ( kind < 1.5 ) {
    float r = min( vMisc.x, min( vHalf.x, vHalf.y ) );
    d = sdRoundBox( vP, vHalf, r );
    // vertical gradient: fill (top) → fill2 (bottom)
    float v = clamp( 0.5 - vP.y / max( 2.0 * vHalf.y, 1e-3 ), 0.0, 1.0 );
    fill = mix( vFill, vFill2, v * vAux.z );
  } else if ( kind < 2.5 ) {
    float ra = min( vHalf.x, vHalf.y ) - 0.5 * vExtra.z;
    d = sdArc( vP, vExtra.x + 0.5 * vExtra.y, 0.5 * abs( vExtra.y ), ra, 0.5 * vExtra.z );
  } else {
    // icon: sample the SDF atlas cell
    // (id + 0.5): mod() of an exact multiple may land on either side of the wrap
    float id = floor( vExtra.x + 0.5 );
    float iconRow = floor( ( id + 0.5 ) / uIconGrid.x );
    vec2 cell = vec2( id - iconRow * uIconGrid.x, iconRow );
    vec2 uv = clamp( vP / ( 2.0 * vHalf ) + 0.5, 0.0, 1.0 );
    uv.y = 1.0 - uv.y;
    float s = texture2D( uIcons, ( cell + uv ) / uIconGrid.xy ).r;
    d = ( 0.5 - s ) * 2.0 * uIconGrid.w * ( 2.0 * vHalf.x / uIconGrid.z );
    if ( abs( vP.x ) > vHalf.x || abs( vP.y ) > vHalf.y ) d = max( d, 1.0 );
  }
  float aa = max( fwidth( d ), 1e-4 );
  float inside = clamp( 0.5 - d / aa, 0.0, 1.0 );
  vec3 color = fill.rgb;
  float alpha = fill.a;
  float borderMix = 0.0;
  if ( bw > 0.0 ) {
    borderMix = clamp( 0.5 + ( d + bw ) / aa, 0.0, 1.0 ) * vBorder.a;
  }
  if ( kind > 0.5 && kind < 1.5 ) {
    // hologlass: faint drifting scan band, animated grain, sheen along the top edge; the border is brightest
    // at the top-left and fades toward the bottom-right (STYLE_GUIDE §6)
    float v = clamp( vP.y / max( 2.0 * vHalf.y, 1e-3 ) + 0.5, 0.0, 1.0 );
    float band = fract( v * 2.0 - uKTime * 0.05 );
    float scan = smoothstep( 0.0, 0.5, band ) * smoothstep( 1.0, 0.5, band );
    float grain = hash( floor( gl_FragCoord.xy * 0.75 ) + floor( uKTime * 24.0 ) * 7.13 ) - 0.5;
    color += vBorder.rgb * ( 0.02 * scan + 0.008 * grain );
    color += vBorder.rgb * 0.05 * smoothstep( 0.82, 1.0, v );
    float sweep = clamp( 0.5 + 0.5 * dot( normalize( vP / vHalf + 1e-5 ), normalize( vec2( -0.6, 0.8 ) ) ), 0.0, 1.0 );
    borderMix *= mix( 0.22, 1.0, sweep * sweep );
  }
  color = mix( color, vBorder.rgb, borderMix );
  alpha = mix( alpha, 1.0, borderMix );
  color *= vParams.w;
  if ( vAux.y > 0.0 ) {
    // dashes along local x
    float t = fract( ( vP.x + vHalf.x ) / vAux.y );
    alpha *= smoothstep( 0.0, 0.06, t ) * ( 1.0 - smoothstep( 0.5, 0.56, t ) );
  }
  alpha *= inside;
  if ( glowSize > 0.0 ) {
    float g = exp( -max( d, 0.0 ) / ( glowSize * 0.34 ) ) * vParams.z * ( 1.0 - inside );
    color = mix( vBorder.rgb * vParams.w, color, inside );
    alpha = max( alpha, g );
  }
  alpha *= opacity;
  if ( alpha < 0.003 ) discard;
  gl_FragColor = vec4( color, alpha );
}
`;

const GLYPH_VERTEX = /* glsl */ `
attribute vec4 aColor;
attribute vec3 aMeta;    // atlas layer, node index, clip node
${XFORM_GLSL}
varying vec2 vUv;
varying float vLayer;
varying vec4 vColor;
varying vec4 vClipRect;
varying vec2 vClipInfo;
void main() {
  float opacity;
  vec3 sp = uiPlace( position, aMeta.y, aMeta.z, opacity, vClipRect, vClipInfo );
  vUv = uv;
  vLayer = aMeta.x;
  vColor = vec4( aColor.rgb, aColor.a * opacity );
  gl_Position = projectionMatrix * modelViewMatrix * vec4( sp, 1.0 );
  if ( vColor.a < 0.004 ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
}
`;

const GLYPH_FRAGMENT = /* glsl */ `
precision highp float;
uniform highp sampler2DArray uAtlas;
uniform vec2 uUnitRange;
varying vec2 vUv;
varying float vLayer;
varying vec4 vColor;
${CLIP_FRAG_GLSL}
void main() {
  float sd = texture( uAtlas, vec3( vUv, vLayer ) ).r;
  // screen pixels spanned by the distance range → one-pixel analytic antialiasing at any scale
  vec2 texelsPerPixel = fwidth( vUv ) / uUnitRange;
  float pxRange = max( 1.0 / max( max( texelsPerPixel.x, texelsPerPixel.y ), 1e-6 ), 1.0 );
  // small text gets a touch of extra weight so thin strokes survive at 0.7 px per unit
  float weight = clamp( ( 2.2 - pxRange ) * 0.02, 0.0, 0.03 );
  float alpha = clamp( ( sd - 0.5 + weight ) * pxRange + 0.5, 0.0, 1.0 ) * vColor.a * uiClip();
  if ( alpha < 0.004 ) discard;
  gl_FragColor = vec4( vColor.rgb, alpha );
}
`;

function baseMaterial(vertexShader: string, fragmentShader: string, xform: XformTexture): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { uXform: { value: xform.texture }, uKTime: kGlobals.uKTime },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  });
}

const QUAD_POS = new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0]);
const QUAD_IDX = [0, 1, 2, 2, 1, 3];

/** Instanced SDF shapes of one surface layer. */
export class ShapeBatch {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  data: Float32Array;
  count = 0;
  private buffer!: InstancedInterleavedBuffer;
  private capacity: number;

  constructor(xform: XformTexture, capacity = 128) {
    this.capacity = capacity;
    this.data = new Float32Array(capacity * SHAPE_STRIDE);
    const material = baseMaterial(SHAPE_VERTEX, SHAPE_FRAGMENT, xform);
    material.uniforms.uIcons = { value: iconAtlas() };
    material.uniforms.uIconGrid = {
      value: new Vector4(ICON_GRID.cols, iconRows(), ICON_GRID.design, ICON_GRID.range),
    };
    this.mesh = new Mesh(this.makeGeometry(), material);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'ui-shapes';
  }

  /** Make room for `count` instances (contents are preserved). */
  ensure(count: number): void {
    if (count <= this.capacity) return;
    while (this.capacity < count) this.capacity *= 2;
    const next = new Float32Array(this.capacity * SHAPE_STRIDE);
    next.set(this.data);
    this.data = next;
    this.mesh.geometry.dispose();
    this.mesh.geometry = this.makeGeometry();
  }

  /** Upload after writing: the whole used range, or just `[start, start + n)` instances. */
  commit(start = 0, n = this.count): void {
    this.mesh.geometry.instanceCount = this.count;
    this.mesh.visible = this.count > 0;
    if (n <= 0) return;
    this.buffer.addUpdateRange(start * SHAPE_STRIDE, n * SHAPE_STRIDE);
    this.buffer.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }

  private makeGeometry(): InstancedBufferGeometry {
    const g = new InstancedBufferGeometry();
    g.setAttribute('position', new BufferAttribute(QUAD_POS, 3));
    g.setIndex(QUAD_IDX);
    this.buffer = new InstancedInterleavedBuffer(this.data, SHAPE_STRIDE, 1);
    const names = ['aRect', 'aMisc', 'aFill', 'aFill2', 'aBorder', 'aParams', 'aExtra', 'aAux'];
    names.forEach((name, i) => g.setAttribute(name, new InterleavedBufferAttribute(this.buffer, 4, i * 4)));
    g.instanceCount = this.count;
    return g;
  }
}

/** SDF text quads of one surface layer. */
export class GlyphBatch {
  readonly mesh: Mesh<BufferGeometry, ShaderMaterial>;
  /** Interleaved CPU copy: `GLYPH_STRIDE` floats per vertex, 4 vertices per glyph. */
  position: Float32Array;
  uv: Float32Array;
  color: Float32Array;
  meta: Float32Array;
  count = 0;
  private capacity: number;

  constructor(xform: XformTexture, capacity = 256) {
    this.capacity = capacity;
    this.position = new Float32Array(capacity * 12);
    this.uv = new Float32Array(capacity * 8);
    this.color = new Float32Array(capacity * 16);
    this.meta = new Float32Array(capacity * 12);
    const material = baseMaterial(GLYPH_VERTEX, GLYPH_FRAGMENT, xform);
    const data = fontData();
    material.uniforms.uAtlas = { value: fontAtlas() };
    material.uniforms.uUnitRange = { value: new Vector2(data.range / data.width, data.range / data.height) };
    this.mesh = new Mesh(this.makeGeometry(), material);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'ui-glyphs';
  }

  ensure(count: number): void {
    if (count <= this.capacity) return;
    while (this.capacity < count) this.capacity *= 2;
    const grow = (old: Float32Array, per: number): Float32Array => {
      const next = new Float32Array(this.capacity * per);
      next.set(old);
      return next;
    };
    this.position = grow(this.position, 12);
    this.uv = grow(this.uv, 8);
    this.color = grow(this.color, 16);
    this.meta = grow(this.meta, 12);
    this.mesh.geometry.dispose();
    this.mesh.geometry = this.makeGeometry();
  }

  commit(start = 0, n = this.count): void {
    const g = this.mesh.geometry;
    g.setDrawRange(0, this.count * 6);
    this.mesh.visible = this.count > 0;
    if (n <= 0) return;
    const mark = (name: string, per: number): void => {
      const a = g.getAttribute(name) as BufferAttribute;
      a.addUpdateRange(start * per, n * per);
      a.needsUpdate = true;
    };
    mark('position', 12);
    mark('uv', 8);
    mark('aColor', 16);
    mark('aMeta', 12);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }

  private makeGeometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(this.position, 3));
    g.setAttribute('uv', new BufferAttribute(this.uv, 2));
    g.setAttribute('aColor', new BufferAttribute(this.color, 4));
    g.setAttribute('aMeta', new BufferAttribute(this.meta, 3));
    const cap = this.capacity;
    const index = cap * 4 > 65535 ? new Uint32Array(cap * 6) : new Uint16Array(cap * 6);
    for (let i = 0; i < cap; i++)
      index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
    g.setIndex(new BufferAttribute(index, 1));
    g.setDrawRange(0, this.count * 6);
    return g;
  }
}
