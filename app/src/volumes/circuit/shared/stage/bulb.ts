/**
 * The lamp (VISUAL.md §5.3): a miniature screw-base bulb. Glass globe; inside a glass stem bead with two support
 * wires and, between their tips, the filament coil. Base: brass thread with four ridges, a black insulating
 * ring and a bottom contact drop. The current's real path: bottom contact → first support → filament → second
 * support → soldered to the thread.
 *
 * Origin = the bottom contact; axis = local +y. Only the filament glows; the glass takes a soft glint from it.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  FrontSide,
  type Group,
  type Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  TubeGeometry,
  type Vector2,
  Vector3,
} from 'three';
import { Builder, G } from '@/kit';
import { K, col, type KGlassMaterial, type KGlowMaterial } from '@/style';
import { supportPath } from './bulb-close';
import { createFilamentShadow } from './bulb-shadow';
import type { BulbPrint } from './bulb-print';
import { LAMP } from './layout';
import { createLampCloseUp, type LampCloseUp } from './lamp-view';
import { sheath } from './materials';

/** Local heights: top of the thread, centre of the globe, the filament. */
export interface BulbDims {
  thread: number;
  threadRadius: number;
  /** Radius of the glass globe (the one free size: the base stays the same). */
  globe: number;
  globeY: number;
  filamentY: number;
  span: number;
}

/** Dimensions of the bulb for a globe radius (default `LAMP.glass`). */
export function bulbDims(globe: number = LAMP.glass): BulbDims {
  return {
    thread: 0.34,
    threadRadius: 0.175,
    globe,
    globeY: 0.41 + globe,
    filamentY: 0.43 + globe,
    span: 0.17,
  };
}
export const BULB: BulbDims = bulbDims();
/** The brass thread's pitch (local): one ridge per this much height — the lamp sinks this far per turn in a socket. */
export const THREAD_PITCH = 0.05;

export interface BulbModel {
  group: Group;
  /** Centre of the filament — the lamp's light is parented here. */
  filament: Object3D;
  /** Set the filament's look: colour of the incandescence scale and emissive multiplier (0 = cold). */
  setGlow(color: Color, emission: number, glow: number, room?: number): void;
  /** The coil mesh (close-ups, hotspots). */
  coil: Mesh;
  glass: Mesh;
  /** The close-up level: fine coil, leads to the contact and the thread, the cut, the path, anchors. */
  close: LampCloseUp;
  /** «0,3 A» on the base (`bulb-print.ts`; laid by the stage's mount — text needs the fonts — null before). */
  print: BulbPrint | null;
}

function coilGeometry(turns: number, radius: number, wire: number): TubeGeometry {
  const pts: Vector3[] = [];
  const n = turns * 14;
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const a = s * turns * Math.PI * 2;
    // a gentle arch: the coil sags upward between the supports, like a real one
    pts.push(
      new Vector3(
        (s * 2 - 1) * BULB.span,
        Math.cos(a) * radius + 0.035 * (1 - (2 * s - 1) ** 2),
        Math.sin(a) * radius,
      ),
    );
  }
  const g = new TubeGeometry(new CatmullRomCurve3(pts), n * 2, wire, 7, false);
  // the ends near the supports are one step cooler than the middle — true, and it gives depth
  const pos = g.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const edge = Math.min((1 - Math.abs(pos.getX(i)) / BULB.span) / 0.28, 1);
    const k = 0.42 + 0.58 * Math.max(edge, 0) ** 0.7;
    colors.set([k, k * k, k * k * k], i * 3); // cooler = dimmer and redder
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  return g;
}

const GLARE_VERTEX = /* glsl */ `
uniform float uSize;
varying vec2 vP;
varying float vFar;
void main() {
  vP = position.xy * 2.0;
  vec4 mv = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
  // from far the glare tells "the lamp is on" at thumbnail size; close up it steps back so that the coil shows
  vFar = smoothstep( 2.2, 8.0, -mv.z );
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
}`;
const GLARE_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uPower;
varying vec2 vP;
varying float vFar;
void main() {
  float r = length( vP );
  float a = pow( max( 1.0 - r, 0.0 ), 2.6 ) * uPower * ( 0.25 + 0.75 * vFar );
  gl_FragColor = vec4( uColor * a, 1.0 );
}`;

/**
 * The glass's place in the depth buffer. Glass is transparent and writes no depth, so the depth of field (and
 * AO) of the post pipeline used to see straight through it: the globe took the blur of whatever lay behind it —
 * a soft, smeared rim spilling out over the far, dark room, a sharp one over the table in focus, and a visible
 * change where the two meet. This invisible copy of the glass's front faces writes only depth, after every
 * other transparent thing of the frame (so nothing behind it is hidden), and the globe is focused like the
 * solid lamp it belongs to.
 */
function depthShell(glass: Mesh, centreY: number): Mesh {
  const shell = new Mesh(
    glass.geometry,
    new MeshBasicMaterial({ colorWrite: false, depthWrite: true, transparent: true, side: FrontSide }),
  );
  shell.name = 'bulb:glass-depth';
  shell.renderOrder = 5000;
  shell.raycast = () => {};
  // a hair larger than the glass (about the globe's centre): the anti-aliased pixels of the silhouette, whose
  // resolved depth would still be the background's, are covered too — no faint spray just outside the rim
  const k = 1.012;
  shell.scale.setScalar(k);
  shell.position.y = centreY * (1 - k);
  return shell;
}

export function createBulb(B: BulbDims = BULB): BulbModel {
  const b = new Builder('bulb', {
    glass: { color: 'sky', opacity: 0.05, edgeOpacity: 0.55, specular: 0.14 },
  });
  const tr = B.threadRadius;
  // base: bottom contact drop, black insulating ring, brass thread with four ridges, collar
  b.lathe(
    G.fillet(
      [
        [0, 0],
        [0.07, 0],
        [0.085, 0.035],
        [0.05, 0.06],
        [0, 0.06],
      ],
      0.015,
      3,
    ),
    { seg: 20, slot: 'metal', c: 'mist' },
  );
  b.lathe(
    [
      [0.05, 0.05],
      [0.13, 0.055],
      [tr - 0.02, 0.1],
      [tr - 0.02, 0.12],
      [0, 0.12],
    ],
    { seg: 32, c: 'ink' },
  );
  const thread: G.Pt[] = [[tr - 0.02, 0.11]];
  for (let i = 0; i < 4; i++) {
    const y = 0.125 + i * THREAD_PITCH;
    thread.push([tr - 0.018, y], [tr, y + 0.014], [tr, y + 0.03], [tr - 0.018, y + 0.044]);
  }
  // collar: its top edge is rolled in over the glass neck and the brass goes on down inside (no flat cap: seen
  // through the neck a brass disc read as a plate pasted over the thread)
  thread.push(
    [tr + 0.012, B.thread - 0.02],
    [tr + 0.012, B.thread - 0.004],
    [tr + 0.002, B.thread + 0.006],
    [tr - 0.01, B.thread - 0.004],
  );
  b.lathe(thread, { seg: 40, slot: 'metal', c: ['amber.dark', 'amber'], crease: 50 });
  // the basing cement inside the collar, under the glass: the dark well the neck stands in
  b.lathe(
    [
      [tr - 0.01, B.thread - 0.004],
      [tr - 0.016, B.thread - 0.05],
      [0.06, B.thread - 0.075],
      [0, B.thread - 0.08],
    ],
    { seg: 32, c: 'ink' },
  );
  // the two support wires rising from the glass stem bead (the bead itself is lit glass, added below)
  for (const s of [-1, 1] as const) b.tube(supportPath(B, s), 0.011, { seg: 8, slot: 'metal', c: 'steel' });
  // globe: neck out of the base, sphere above
  const R = B.globe;
  // the neck starts inside the collar, under its rolled edge, and flares out above it
  const globe: G.Pt[] = [
    [tr - 0.022, B.thread - 0.045],
    [tr - 0.012, B.thread + 0.004],
    [tr + 0.004, B.thread + 0.05],
    [tr + 0.03, B.thread + 0.1],
  ];
  for (let a = -52; a <= 90; a += 6) {
    const rad = (a * Math.PI) / 180;
    globe.push([Math.max(Math.cos(rad) * R, 0), B.globeY + Math.sin(rad) * R]);
  }
  // close the crown (the 6° steps stop at 86°: a small hole at the top read as a dark spot on the glass)
  globe.push([0, B.globeY + R]);
  b.lathe(globe, { seg: 64, slot: 'glass', c: 'white' });
  const model = b.build();
  const glass = model.group.getObjectByName('bulb:glass') as Mesh;
  const glassMaterial = model.mats.get('glass') as KGlassMaterial;
  (glassMaterial.uniforms.uGlass!.value as Vector3).y = 3.4; // thinner, crisper fresnel rim
  glass.add(depthShell(glass, B.globeY));
  // the supports share the merged metal mesh with the base: only the part above the glass stem's root fades
  const supportShadow = createFilamentShadow(0.5);
  const metalMaterial = model.mats.get('metal');
  model.group.traverse((o) => {
    if ((o as Mesh).isMesh && (o as Mesh).material === metalMaterial) o.customDistanceMaterial = supportShadow.material;
  });
  const edgeCold = col('sky').lerp(col('white'), 0.45);
  const edgeWarm = col('yellow.light').lerp(col('white'), 0.35);

  const filamentMaterial = K.glow({
    color: 'steel.dark',
    intensity: 1,
    whiten: 0.2,
    falloff: 0.5,
    edge: 0.8,
    vertexColors: true,
  });
  const coil = new Mesh(coilGeometry(14, 0.034, 0.0085), filamentMaterial);
  coil.name = 'bulb:filament';
  const filament = new Object3D();
  filament.name = 'filament';
  filament.position.set(0, B.filamentY + 0.02, 0);
  coil.position.set(0, B.filamentY, 0);
  // soft glint of the filament inside the glass: a faint additive shell, never brighter than the coil
  const halo = new Mesh(
    G.sphere(R * 0.93, 32),
    K.glow({ color: 'yellow.light', intensity: 0, additive: true, falloff: 2.6, edge: 0, whiten: 0 }),
  );
  halo.position.y = B.globeY;
  halo.name = 'bulb:halo';
  halo.renderOrder = 1;
  // glass stem (pinched glass): a flare fused to the neck down in the collar, narrowing to the bead that holds
  // the supports; open at the bottom (no flat disc). Translucent, so that it never outshines the coil above it
  const bead = new Mesh(
    G.lathe(
      G.fillet(
        [
          [tr - 0.024, B.thread - 0.045],
          [0.12, B.thread + 0.03],
          [0.088, 0.47],
          [0.085, 0.52],
          [0.05, 0.68],
          [0, 0.7],
        ],
        [0, 0.05, 0.03, 0.05, 0.03, 0],
        4,
      ),
      { seg: 24 },
    ),
    sheath({ color: col('mist').lerp(col('sky'), 0.3), opacity: 0.3, edgeOpacity: 0.8, gloss: 0.5 }),
  );
  bead.name = 'bulb:bead';
  bead.renderOrder = 1;
  model.group.add(bead);
  // glare: a soft camera-facing bloom of the filament's own light (additive; it never lights the glass)
  const glareMaterial = new ShaderMaterial({
    uniforms: { uColor: { value: new Color() }, uPower: { value: 0 }, uSize: { value: 1.9 } },
    vertexShader: GLARE_VERTEX,
    fragmentShader: GLARE_FRAGMENT,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const glareWarm = col('yellow');
  const glare = new Mesh(new PlaneGeometry(1, 1), glareMaterial);
  glare.position.copy(filament.position);
  glare.frustumCulled = false;
  glare.renderOrder = 7;
  glare.name = 'bulb:glare';
  model.group.add(coil, filament, halo, glare);
  const haloMaterial = halo.material as KGlowMaterial;
  const close = createLampCloseUp(B, {
    group: model.group,
    coarse: coil,
    cutMaterials: [
      model.mats.get('metal'),
      model.mats.get('toon'),
      glassMaterial,
      bead.material as Material,
      (glass.getObjectByName('bulb:glass-depth') as Mesh).material as Material,
    ],
    shells: [model.mats.get('metal'), model.mats.get('toon')],
  });
  const fineMaterial = close.fineMaterial;
  const fineTint = new Color();
  const fineWarm = col('yellow.light');
  return {
    close,
    print: null,
    group: model.group,
    filament,
    coil,
    glass,
    setGlow(color, emission, glow, room = 1) {
      filamentMaterial.setColor(color);
      filamentMaterial.intensity = Math.max(emission, 0.55);
      // cold coil: the vertex colours' cooling must not darken an unlit wire
      filamentMaterial.whiten = 0.15 + 0.5 * glow;
      // close up the coil keeps its colour and its turns: less whitening, a tighter bloom
      // at the coil's own distance (`close.near` → 1) the hot coil must keep its turns: less light into the bloom,
      // less whitening, and a darker limb on each turn (the gaps between turns stay a shade darker than the wire)
      const near = close.near;
      // close up the white-hot coil keeps a touch of yellow (VISUAL §5.3: «біла з yellow-ореолом»)
      fineMaterial.setColor(fineTint.copy(color).lerp(fineWarm, 0.28 * near * glow));
      fineMaterial.intensity = Math.max(emission * 0.45 * (1 - 0.22 * near), 0.55);
      fineMaterial.whiten = (0.1 + 0.3 * glow) * (1 - 0.35 * near);
      (fineMaterial.uniforms.uFalloff!.value as Vector2).set(0.5 + 1.3 * near * glow, 0.8 - 0.38 * near * glow);
      supportShadow.setGlow(glow);
      haloMaterial.color.copy(color);
      haloMaterial.intensity = 0.05 * glow ** 2;
      (glareMaterial.uniforms.uColor!.value as Color).copy(color).lerp(glareWarm, 0.45);
      // close up the glare steps back: the coil itself is the light (the close-up level fades it)
      glareMaterial.uniforms.uPower!.value = 0.62 * glow ** 1.9 * (1 - 0.85 * close.near);
      glare.visible = glow > 0.05;
      // K.glass is unlit: in a dark room its rim must not shine by itself
      (glassMaterial.uniforms.uEdgeColor!.value as Color)
        .copy(edgeCold)
        .lerp(edgeWarm, glow)
        .multiplyScalar(Math.min(1, 0.1 + 0.9 * Math.max(room * 0.55, glow)));
    },
  };
}
