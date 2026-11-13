/**
 * Look-dev sandbox "studio": an induction demo rig (coil on an iron core, bar magnet on a rail, galvanometer)
 * on a turntable — the product-shot reference for machine and lab chapters: floor disc with a grounding
 * shadow, gradient backdrop, rim light, mild depth of field.
 */
import {
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { damp, defineScene } from '@/engine/api';
import { K, SEMANTIC, col } from '@/style';
import { Text3D } from '@/text';
import { labels } from './content';
import { createLabel } from './parts/label';

const AXIS_Y = 1.18; // height of the coil / magnet axis above the turntable
const CORE_END = -0.05; // x of the core's right end (the magnet approaches it)
const MAGNET_REST = 1.55;

function mesh(geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0, shadow = true): Mesh {
  const m = new Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

export default defineScene((ctx) => {
  const { root, stage, camera } = ctx;
  ctx.env.setScale(3.4);
  ctx.env.setGrounding(3.05);
  ctx.env.tune({ rimIntensity: 0.55 }, { duration: 0 });

  /* ------------------------------------------------------------------------------------ turntable */
  const table = new Group();
  table.name = 'turntable';
  root.add(table);
  const plateProfile = [
    new Vector2(0, 0),
    new Vector2(2.95, 0),
    new Vector2(3.02, 0.03),
    new Vector2(3.04, 0.1),
    new Vector2(3.0, 0.19),
    new Vector2(2.9, 0.22),
    new Vector2(0, 0.22),
  ];
  const plate = mesh(
    new LatheGeometry(plateProfile, 96),
    K.toon({ gradient: { bottom: 'bg.indigo', top: 'slate', range: [0, 0.22] }, rim: 1.4 }),
  );
  const top = mesh(
    new CylinderGeometry(2.78, 2.78, 0.02, 96),
    K.toon({ color: col('bg.plum').lerp(col('slate'), 0.35), highlight: 0.1 }),
    0,
    0.225,
    0,
    false,
  );
  const accentRing = new Mesh(
    new TorusGeometry(2.86, 0.018, 8, 160),
    K.glow({ color: ctx.manifest.theme.accent, intensity: 1.7, falloff: 0 }),
  );
  accentRing.rotation.x = Math.PI / 2;
  accentRing.position.y = 0.225;
  table.add(plate, top, accentRing);

  /* ------------------------------------------------------------------------------- coil and core */
  const copper = K.metal({
    color: col('orange').lerp(col('wireBrown'), 0.45),
    specular: 0.85,
    shininess: 60,
  });
  const steel = K.metal({ color: 'steel', specular: 0.7 });
  const light = K.toon({ color: 'mist', gloss: 0.4 });
  const dark = K.toon({ color: 'slate', rim: 0.8 });
  const coil = new Group();
  coil.name = 'coil';
  coil.position.set(-0.95, AXIS_Y, 0);
  table.add(coil);
  const turns = 24;
  const pitch = 0.062;
  const windings = new InstancedMesh(new TorusGeometry(0.47, 0.03, 14, 72), copper, turns * 2);
  const m4 = new Matrix4();
  const turnRotation = new Matrix4().makeRotationY(Math.PI / 2);
  for (let i = 0; i < turns; i++) {
    // two layers of wire: an inner one and, offset by half a pitch, a slightly larger outer one
    windings.setMatrixAt(
      i * 2,
      m4.makeTranslation((i - (turns - 1) / 2) * pitch, 0, 0).multiply(turnRotation),
    );
    m4.makeTranslation((i - (turns - 1) / 2 + 0.5) * pitch, 0, 0)
      .multiply(turnRotation)
      .scale(new Vector3(1.11, 1.11, 1));
    windings.setMatrixAt(i * 2 + 1, m4);
  }
  windings.castShadow = true;
  windings.receiveShadow = true;
  const windingGroup = new Group();
  windingGroup.add(windings);
  const flangeProfile = [
    new Vector2(0.24, 0),
    new Vector2(0.66, 0),
    new Vector2(0.7, 0.02),
    new Vector2(0.7, 0.06),
    new Vector2(0.66, 0.08),
    new Vector2(0.24, 0.08),
  ];
  const flangeGeometry = new LatheGeometry(flangeProfile, 64);
  flangeGeometry.rotateZ(-Math.PI / 2); // lathe axis → X
  const halfLength = (turns * pitch) / 2 + 0.03;
  const flangeL = mesh(flangeGeometry, light, -halfLength - 0.08, 0, 0);
  const flangeR = mesh(flangeGeometry, light, halfLength, 0, 0);
  const coreGeometry = new CylinderGeometry(0.22, 0.22, 2.0, 40);
  coreGeometry.rotateZ(Math.PI / 2);
  const core = mesh(coreGeometry, steel, CORE_END + 0.95 - 1.0, 0, 0);
  const coreCap = mesh(new SphereGeometry(0.22, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), steel);
  coreCap.rotation.z = -Math.PI / 2;
  coreCap.scale.y = 0.25;
  coreCap.position.x = 1.0;
  core.add(coreCap);
  coil.add(windingGroup, flangeL, flangeR, core);
  // cradle: two saddles under the flanges on a common foot
  const saddle = new RoundedBoxGeometry(0.14, AXIS_Y - 0.5, 0.92, 4, 0.05);
  table.add(
    mesh(saddle, dark, coil.position.x - halfLength - 0.04, 0.22 + (AXIS_Y - 0.5) / 2, 0),
    mesh(saddle, dark, coil.position.x + halfLength + 0.04, 0.22 + (AXIS_Y - 0.5) / 2, 0),
    mesh(new RoundedBoxGeometry(turns * pitch + 0.5, 0.1, 1.1, 4, 0.04), dark, coil.position.x, 0.27, 0),
  );

  /* --------------------------------------------------------------------------------- magnet rail */
  const railGeometry = new CylinderGeometry(0.03, 0.03, 2.5, 16);
  railGeometry.rotateZ(Math.PI / 2);
  for (const z of [-0.17, 0.17]) table.add(mesh(railGeometry, steel, 1.45, 0.66, z));
  const post = new RoundedBoxGeometry(0.12, 0.52, 0.56, 3, 0.04);
  table.add(mesh(post, dark, 0.2, 0.47, 0), mesh(post, dark, 2.7, 0.47, 0));
  const magnetLift = new Group(); // raised in the exploded view
  table.add(magnetLift);
  const magnet = new Group();
  magnet.name = 'magnet';
  magnet.position.set(MAGNET_REST, 0, 0);
  magnetLift.add(magnet);
  const northMaterial = K.toon({ color: 'red', emissive: 'red', emissiveIntensity: 0, gloss: 0.5 });
  const southMaterial = K.toon({ color: 'blue', emissive: 'blue', emissiveIntensity: 0, gloss: 0.5 });
  const half = new RoundedBoxGeometry(0.56, 0.36, 0.36, 4, 0.06);
  magnet.add(mesh(half, northMaterial, -0.27, AXIS_Y, 0), mesh(half, southMaterial, 0.27, AXIS_Y, 0));
  magnet.add(mesh(new RoundedBoxGeometry(0.5, 0.3, 0.52, 3, 0.05), K.toon({ color: 'teal' }), 0, 0.78, 0));
  magnet.add(mesh(new RoundedBoxGeometry(0.16, AXIS_Y - 1.1 + 0.2, 0.16, 2, 0.03), dark, 0, 0.95, 0));
  for (const [letter, x] of [
    ['N', -0.27],
    ['S', 0.27],
  ] as const) {
    for (const side of [1, -1]) {
      const t = new Text3D(letter, {
        font: 'display',
        size: 0.26,
        color: 'white',
        anchorX: 'center',
        anchorY: 'middle',
        depthWrite: false,
        rich: false,
      });
      t.position.set(x, AXIS_Y, 0.184 * side);
      t.rotation.y = side === 1 ? 0 : Math.PI;
      magnet.add(t);
    }
  }
  // magnetic field lines (B = magenta): loops leaving one pole and returning to the other, on four sides
  const field = new Group();
  field.position.y = AXIS_Y;
  const fieldMaterial = K.glow({
    color: SEMANTIC.fieldB,
    intensity: 1.5,
    additive: true,
    opacity: 0.7,
    falloff: 0,
  });
  const loop = new TorusGeometry(1, 0.012, 6, 96);
  for (let k = 0; k < 4; k++) {
    for (const [a, b] of [
      [0.62, 0.3],
      [0.88, 0.52],
      [1.16, 0.78],
    ] as const) {
      const l = new Mesh(loop, fieldMaterial);
      l.scale.set(a, b, 1);
      // ellipse through both pole faces (x = ±0.5): centre height c with a·√(1 − c²/b²) = 0.5
      l.position.y = b * Math.sqrt(1 - (0.5 / a) ** 2);
      const side = new Group();
      side.rotation.x = (k * Math.PI) / 2;
      side.add(l);
      field.add(side);
    }
  }
  magnet.add(field);

  /* -------------------------------------------------------------------------------- galvanometer */
  const meter = new Group();
  meter.name = 'meter';
  meter.position.set(0.9, 0.22, 1.75);
  meter.rotation.y = -0.25;
  table.add(meter);
  meter.add(mesh(new RoundedBoxGeometry(1.0, 0.16, 0.5, 4, 0.05), dark, 0, 0.08, 0));
  const dialGeometry = new CylinderGeometry(0.44, 0.44, 0.16, 64);
  dialGeometry.rotateX(Math.PI / 2);
  meter.add(mesh(dialGeometry, light, 0, 0.6, 0));
  const faceGeometry = new CylinderGeometry(0.38, 0.38, 0.01, 64);
  faceGeometry.rotateX(Math.PI / 2);
  meter.add(mesh(faceGeometry, K.toon({ color: 'white', highlight: 0 }), 0, 0.6, 0.082, false));
  const tick = new RoundedBoxGeometry(0.016, 0.07, 0.006, 1, 0.003);
  const tickMaterial = K.toon({ color: 'ink' });
  for (let i = -4; i <= 4; i++) {
    const a = (i / 4) * 0.95;
    const t = mesh(tick, tickMaterial, Math.sin(a) * 0.3, 0.6 - 0.12 + Math.cos(a) * 0.3, 0.09, false);
    t.rotation.z = -a;
    if (i === 0) t.scale.set(1.6, 1.4, 1);
    meter.add(t);
  }
  const needle = new Group();
  needle.position.set(0, 0.48, 0.1);
  const needleBody = mesh(
    new RoundedBoxGeometry(0.022, 0.3, 0.008, 1, 0.004),
    K.toon({ color: 'coral' }),
    0,
    0.15,
    0,
    false,
  );
  needle.add(needleBody, mesh(new SphereGeometry(0.035, 16, 12), steel, 0, 0, 0, false));
  meter.add(needle);
  const glass = new Mesh(faceGeometry, K.glass({ color: 'sky', opacity: 0.1, edgeOpacity: 0.45 }));
  glass.position.set(0, 0.6, 0.12);
  meter.add(glass);
  const lamp = K.glow({ color: 'yellow', intensity: 0.4 });
  meter.add(mesh(new SphereGeometry(0.05, 16, 12), lamp, 0.36, 0.2, 0.2, false));
  // leads from the coil terminals to the meter: K.energy, pulses run in the direction of the induced current
  const wireMaterial = K.energy({
    color: 'ink',
    pulseColor: SEMANTIC.current,
    repeat: 2.2,
    speed: 0,
    length: 0.5,
    intensity: 3.5,
    power: 0.2,
  });
  const lead = (from: Vector3, to: Vector3, bend: number): Mesh => {
    const midA = from
      .clone()
      .setY(0.27)
      .add(new Vector3(0, 0, 0.45));
    const midB = to
      .clone()
      .setY(0.27)
      .add(new Vector3(bend, 0, -0.35));
    const curve = new CatmullRomCurve3([from, midA, midB, to], false, 'centripetal');
    const g = new TubeGeometry(curve, 48, 0.028, 10, false);
    const uv = g.getAttribute('uv');
    const length = curve.getLength();
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * length);
    return mesh(g, wireMaterial);
  };
  const meterAt = (x: number): Vector3 => meter.localToWorld(new Vector3(x, 0.2, -0.2));
  table.updateMatrixWorld(true);
  table.add(
    lead(new Vector3(coil.position.x - halfLength, 0.62, 0.42), meterAt(-0.36), -0.3),
    lead(new Vector3(coil.position.x + halfLength, 0.62, 0.42), meterAt(0.36), 0.3),
  );
  ctx.env.fitShadow(table, 1.25, 3);

  /* ---------------------------------------------------------------------------------------- labels */
  const L = labels;
  const coilLabel = createLabel(L.coil, { offset: [0.3, 0.1, 0.7] });
  coilLabel.position.set(0.25, 0.28, 0.42);
  coil.add(coilLabel);
  const coreLabel = createLabel(L.core, { offset: [0.15, -0.5, 0.45] });
  coreLabel.position.set(-0.92, -0.05, 0.2);
  core.add(coreLabel);
  const magnetLabel = createLabel(L.magnet, { offset: [0.45, 0.7, 0.2] });
  magnetLabel.position.set(0.2, AXIS_Y + 0.2, 0);
  magnet.add(magnetLabel);
  const meterLabel = createLabel(L.meter, { offset: [0.55, 0.1, 0.5] });
  meterLabel.position.set(0.42, 0.62, 0.1);
  meter.add(meterLabel);
  const fieldLabel = createLabel(L.field, { offset: [0.55, 0.3, 0], color: SEMANTIC.fieldB });
  fieldLabel.position.set(0.55, AXIS_Y + 0.82, 0);
  magnet.add(fieldLabel);

  /* ------------------------------------------------------------------------------ declarative steps */
  camera.shots({
    hero: { position: [5.6, 3.5, 7.8], target: [0, 0.85, 0], fov: 28, orbit: { azimuth: 1.6, polar: 0.4 } },
    coil: { position: [-3.3, 2.3, 2.7], target: [-0.95, 1.0, 0], fov: 28, focus: coil },
    induction: { position: [2.2, 2.9, 6.6], target: [0.35, 1.05, 0.3], fov: 28 },
    exploded: { position: [0.6, 4.6, 9.4], target: [0, 1.45, 0], fov: 28 },
  });
  const fade = { appear: 'fade', inDuration: 0.4 } as const;
  const aField = stage.actor(field, { appear: 'fade', inDuration: 0.8 });
  const aCoil = stage.actor(coilLabel, fade);
  const aCore = stage.actor(coreLabel, fade);
  const aMagnet = stage.actor(magnetLabel, fade);
  const aMeter = stage.actor(meterLabel, fade);
  const aFieldLabel = stage.actor(fieldLabel, fade);
  const spin = stage.param('spin', 0, { duration: 1.5 });
  const auto = stage.param('auto', 0, { duration: 1.0 });
  stage.pose('core', core);
  stage.pose('windings', windingGroup);
  stage.pose('flangeL', flangeL);
  stage.pose('flangeR', flangeR);
  stage.pose('magnetLift', magnetLift);
  stage.define({
    hero: { camera: 'hero', params: { spin: 1 } },
    coil: { show: [aCoil, aCore], camera: 'coil' },
    induction: { show: [aField, aMagnet, aMeter, aFieldLabel], camera: 'induction', params: { auto: 1 } },
    exploded: {
      show: [aCoil, aCore, aMagnet, aMeter],
      camera: 'exploded',
      poses: {
        core: { position: [core.position.x - 0.55, -0.62, 0.95] },
        windings: { position: [0, 0.95, 0] },
        flangeL: { position: [flangeL.position.x - 0.4, 0, 0] },
        flangeR: { position: [flangeR.position.x + 0.4, 0, 0] },
        magnetLift: { position: [0.25, 0.75, 0] },
      },
    },
  });

  /* ------------------------------------------------------------------------------------ interaction */
  // Drag the magnet along its rail; the needle reacts to the rate of change of the flux, not to the position.
  const user = { x: MAGNET_REST, active: 0, hover: 0 };
  const up = new Vector3(0, 1, 0);
  const through = new Vector3();
  const hit = new Vector3();
  ctx.input.register(magnet, {
    tooltip: L.magnet,
    cursor: 'ew-resize',
    hover: (over) => ctx.tweens.to(user, { hover: over ? 1 : 0 }, { duration: 0.12 }),
    dragStart: () => ctx.tweens.to(user, { active: 1 }, { duration: 0.15 }),
    drag: (e) => {
      magnet.getWorldPosition(through).setY(through.y + AXIS_Y);
      if (!e.planePoint(up, through, hit)) return;
      user.x = Math.min(Math.max(table.worldToLocal(hit).x, 0.58), 2.32);
    },
    dragEnd: () => ctx.tweens.to(user, { active: 0 }, { duration: 1.2, delay: 0.8, ease: 'power2.inOut' }),
  });

  let tableAngle = 0;
  let flux = 0;
  let emf = 0;
  let needleAngle = 0;
  let first = true;

  return {
    update(dt, t) {
      // turntable: slow product-shot rotation in the hero step, otherwise it eases back to its home angle
      if (spin.value > 0.01) tableAngle += spin.value * 0.16 * dt;
      else tableAngle = damp(tableAngle, Math.round(tableAngle / (Math.PI * 2)) * Math.PI * 2, 3.5, dt);
      table.rotation.y = tableAngle;
      accentRing.material.intensity = 1.5 + Math.sin(t * 1.4) * 0.25;

      // magnet position: rest → automatic in/out stroke (induction step) → the user's hand
      const stroke = 1.45 - 0.86 * Math.cos(t * 1.7);
      let x = MAGNET_REST + (stroke - MAGNET_REST) * auto.value;
      x += (user.x - x) * user.active;
      magnet.position.x = x;
      // flux through the coil falls off with the distance between the near pole and the core end
      const distance = x - 0.55 - CORE_END;
      const phi = 1 / (1 + (distance / 0.55) ** 2);
      // Faraday: EMF = −N·dΦ/dt (arbitrary units; smoothed like a real moving-coil meter)
      const raw = first || dt <= 0 ? 0 : -(phi - flux) / dt;
      first = false;
      flux = phi;
      emf = damp(emf, raw, 12, dt);
      needleAngle = damp(needleAngle, Math.max(-0.95, Math.min(0.95, emf * 0.75)), 9, dt);
      needle.rotation.z = -needleAngle;
      const level = Math.min(Math.abs(emf) * 0.8, 1.4);
      wireMaterial.power = 0.12 + level;
      wireMaterial.speed = emf * 1.6;
      lamp.intensity = 0.4 + level * 2.6;
      const glow = user.hover * 0.35;
      northMaterial.emissiveIntensity = glow;
      southMaterial.emissiveIntensity = glow;
    },
  };
});
