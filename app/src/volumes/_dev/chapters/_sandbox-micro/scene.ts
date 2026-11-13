/**
 * Look-dev sandbox "inner space": a stylised atom — nucleus cluster, probability cloud, three electrons with
 * trails, world-anchored labels, a draggable electron and a photon. It doubles as the reference implementation
 * of the chapter contract documented in docs/ENGINE_API.md.
 */
import {
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { defineScene, type DragInfo } from '@/engine/api';
import { K, SEMANTIC } from '@/style';
import { Text3D } from '@/text';
import { labels } from './content';
import { createCloud, createPhoton, createTrail } from './parts/fx';
import { createLabel } from './parts/label';

const NUCLEON_RADIUS = 0.5;
const ORBITS = [
  { radius: 3.0, tilt: new Euler(1.2, 0.25, 0.0), speed: 0.9, phase: 0.6 },
  { radius: 3.75, tilt: new Euler(0.55, 0.95, 0.3), speed: -0.68, phase: 2.3 },
  { radius: 4.5, tilt: new Euler(-0.62, -0.5, 0.85), speed: 0.52, phase: 4.2 },
] as const;
/** Angle on its orbit where electron 0 rests while the `electron` step frames it. */
const HOLD_ANGLE = 0.35;
/** Orbit radius grows by this factor at full excitation. */
const EXCITE_GAIN = 0.42;

export default defineScene((ctx) => {
  const { root, stage, camera, random } = ctx;
  ctx.env.setScale(6);
  ctx.env.setShadow({ extent: 3.2, softness: 4 });

  /* -------------------------------------------------------------------------------------- nucleus */
  const nucleus = new Group();
  nucleus.name = 'nucleus';
  root.add(nucleus);
  // tight sphere packing by relaxation: pull toward the centre, push overlapping nucleons apart
  const count = 14;
  const base: Vector3[] = [];
  for (let i = 0; i < count; i++)
    base.push(new Vector3(...random.onSphere()).multiplyScalar(random.range(0.2, 1.2)));
  const push = new Vector3();
  for (let iter = 0; iter < 160; iter++) {
    for (let i = 0; i < count; i++) {
      base[i]!.multiplyScalar(0.985);
      for (let j = i + 1; j < count; j++) {
        push.subVectors(base[i]!, base[j]!);
        const d = push.length() || 1e-3;
        const overlap = NUCLEON_RADIUS * 1.86 - d;
        if (overlap > 0) {
          push.multiplyScalar((overlap * 0.5) / d);
          base[i]!.add(push);
          base[j]!.sub(push);
        }
      }
    }
  }
  const nucleonGeometry = new SphereGeometry(NUCLEON_RADIUS, 48, 32);
  const protonMaterial = K.toon({
    color: SEMANTIC.proton,
    highlight: 0.6,
    rim: 1.3,
    gloss: 0.7,
  });
  const neutronMaterial = K.toon({
    gradient: { bottom: SEMANTIC.neutronShade, top: SEMANTIC.neutron, range: [-0.45, 0.4] },
    highlight: 0.5,
    rim: 1.1,
    gloss: 0.7,
  });
  const protons = new InstancedMesh(nucleonGeometry, protonMaterial, count / 2);
  const neutrons = new InstancedMesh(nucleonGeometry, neutronMaterial, count / 2);
  for (const m of [protons, neutrons]) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    nucleus.add(m);
  }
  // soft warm glow from inside the cluster reads as "energy lives here" (bloom-driving, behind the nucleons)
  const core = new Mesh(
    new SphereGeometry(0.62, 24, 16),
    K.glow({ color: 'amber', intensity: 1.5, additive: true, opacity: 0.5, falloff: 1.2 }),
  );
  nucleus.add(core);
  // Tertiary detail that doubles as the semantic cue: a flat "+" on every proton. Like a sticker that always
  // faces the viewer, it sits on the camera-facing pole of its sphere (so nearer nucleons hide it correctly).
  const plusMarks = base
    .filter((_, i) => i % 2 === 0)
    .map(() => {
      const mark = new Text3D('+', {
        font: 'display',
        size: 0.5,
        color: 'white',
        opacity: 0.9,
        anchorX: 'center',
        anchorY: 'middle',
        billboard: true,
        depthWrite: false,
        rich: false,
      });
      root.add(mark);
      return mark;
    });

  /* ---------------------------------------------------------------------------- cloud and electrons */
  const cloud = createCloud(random.fork('cloud'), ctx.quality.count(1500, 300), 5.2, 'cyan', 'violet');
  root.add(cloud.points);

  const electronGeometry = new SphereGeometry(0.17, 32, 20);
  const haloGeometry = new SphereGeometry(0.36, 24, 16);
  const electrons = ORBITS.map((orbit, i) => {
    const group = new Group();
    group.rotation.copy(orbit.tilt);
    group.name = `orbit-${i}`;
    const ring = new Mesh(
      new TorusGeometry(orbit.radius, 0.011, 6, 200),
      K.glow({ color: 'violet.light', intensity: 0.55, additive: true, opacity: 0.6, falloff: 0 }),
    );
    const trail = createTrail(orbit.radius, 0.034, SEMANTIC.electron, 0.34);
    const body = new Mesh(
      electronGeometry,
      K.glow({ color: SEMANTIC.electron, intensity: 1.9, falloff: 2.0, edge: 0.52 }),
    );
    const halo = new Mesh(
      haloGeometry,
      K.glow({
        color: SEMANTIC.electron,
        intensity: 0.6,
        additive: true,
        opacity: 0.4,
        falloff: 2.4,
        edge: 0,
      }),
    );
    body.add(halo);
    group.add(ring, trail.mesh, body);
    root.add(group);
    return { orbit, group, ring, trail, body, angle: orbit.phase as number };
  });
  const hero = electrons[0]!;
  const heroMaterial = hero.body.material;

  const photon = createPhoton(SEMANTIC.photon);
  root.add(photon.mesh);

  /* --------------------------------------------------------------------------------------- labels */
  const L = labels;
  const nucleusLabel = createLabel(L.nucleus, { offset: [1.5, 1.7, 0.3], color: 'white' });
  nucleusLabel.position.set(0.5, 0.95, 0.5);
  const cloudLabel = createLabel(L.cloud, { offset: [-0.9, 1.0, 0], color: 'violet.light' });
  cloudLabel.position.set(-2.9, 2.5, 1.0);
  const electronLabel = createLabel(L.electron, { offset: [0.42, 0.34, 0], color: 'cyan' });
  hero.body.add(electronLabel);
  const dragLabel = createLabel(L.drag, { offset: [0, 0.62, 0], color: 'cyan', size: 18, anchor: 'center' });
  root.add(dragLabel); // follows the electron in world space (kept upright, see update)
  // one proton and one neutron on the camera-facing side of the cluster get their own labels
  const facing = (list: Vector3[], side: number): Vector3 =>
    [...list].sort((a, b) => b.z + b.x * side - (a.z + a.x * side))[0]!;
  const protonAnchor = facing(
    base.filter((_, i) => i % 2 === 0),
    0.8,
  );
  const neutronAnchor = facing(
    base.filter((_, i) => i % 2 === 1),
    -0.8,
  );
  const protonLabel = createLabel(L.proton, { offset: [0.75, 0.6, 0.2], color: 'coral' });
  protonLabel.position.copy(protonAnchor).multiplyScalar(1 + NUCLEON_RADIUS / protonAnchor.length());
  const neutronLabel = createLabel(L.neutron, { offset: [-1.0, 0.7, 0.2], color: 'mist' });
  neutronLabel.position.copy(neutronAnchor).multiplyScalar(1 + NUCLEON_RADIUS / neutronAnchor.length());
  // these two sit on the nucleus but must not tumble with it, or their leader lines would swing wildly
  root.add(nucleusLabel, cloudLabel, protonLabel, neutronLabel);
  const photonLabel = createLabel(L.photon, { offset: [0.1, 0.55, 0], color: 'yellow', size: 18 });
  photon.mesh.add(photonLabel);

  /* ------------------------------------------------------------------------------ declarative steps */
  const holdPosition = new Vector3(
    Math.cos(HOLD_ANGLE) * hero.orbit.radius,
    Math.sin(HOLD_ANGLE) * hero.orbit.radius,
    0,
  ).applyEuler(hero.orbit.tilt);
  camera.shots({
    atom: { position: [0.5, 4.4, 16.5], target: [0, 0, 0], fov: 32 },
    nucleus: {
      position: [1.9, 1.5, 5.4],
      target: [0, 0.05, 0],
      fov: 30,
      orbit: { azimuth: 1.2, polar: 0.6 },
    },
    electron: {
      position: holdPosition.clone().add(new Vector3(0.9, 0.7, 3.4)),
      target: holdPosition,
      focus: hero.body,
      fov: 30,
      orbit: { azimuth: 0.5, polar: 0.3, zoom: [0.8, 1.6] },
    },
    excited: { position: [-3.5, 4.0, 15.8], target: [0.2, 0, 0], fov: 32 },
  });

  const labelFade = { appear: 'fade', inDuration: 0.4 } as const;
  const aNucleusLabel = stage.actor(nucleusLabel, labelFade);
  const aCloudLabel = stage.actor(cloudLabel, labelFade);
  const aElectronLabel = stage.actor(electronLabel, labelFade);
  const aDragLabel = stage.actor(dragLabel, labelFade);
  const aProtonLabel = stage.actor(protonLabel, labelFade);
  const aNeutronLabel = stage.actor(neutronLabel, labelFade);
  const orbitActors = electrons.map((e) => stage.actor(e.group));
  const cloudAmount = stage.param('cloud', 1, { onChange: (v) => (cloud.amount = v) });
  const spin = stage.param('spin', 1);
  const hold = stage.param('hold', 0, { duration: 1.4, ease: 'power2.inOut' });
  const excite = stage.param('excite', 0, { duration: 0.9, ease: 'back.out' });
  const coreGlow = stage.param('core', 1.5, { onChange: (v) => (core.material.intensity = v) });
  void cloudAmount;
  void coreGlow;

  stage.define({
    atom: {
      show: [...orbitActors, aNucleusLabel, aCloudLabel],
      camera: 'atom',
    },
    nucleus: {
      show: [aProtonLabel, aNeutronLabel],
      params: { cloud: 0.12, spin: 0.4, core: 2.4 },
      camera: 'nucleus',
      post: { aoIntensity: 0.7 },
    },
    electron: {
      show: [orbitActors[0]!, aElectronLabel],
      params: { cloud: 0.3, spin: 0.25, hold: 1 },
      camera: 'electron',
      post: { bloomIntensity: 1.0 },
    },
    excited: {
      show: [...orbitActors, aDragLabel],
      params: { cloud: 0.55, spin: 0.7, excite: 1 },
      camera: 'excited',
      post: { bloomIntensity: 1.25 },
    },
  });

  /* ------------------------------------------------------------------------------------ interaction */
  // The hero electron can be dragged across its orbit plane: farther from the nucleus = higher energy level.
  const user = { level: 0, dragging: false, angle: 0, glow: 0 };
  const orbitNormal = new Vector3(0, 0, 1).applyEuler(hero.orbit.tilt);
  const planeHit = new Vector3();
  const local = new Vector3();
  const inverseTilt = new Quaternion().setFromEuler(hero.orbit.tilt).invert();
  const origin = new Vector3();
  const onDrag = (e: DragInfo): void => {
    if (!e.planePoint(orbitNormal, origin, planeHit)) return;
    local.copy(planeHit).applyQuaternion(inverseTilt);
    user.angle = Math.atan2(local.y, local.x);
    const r = Math.hypot(local.x, local.y) / hero.orbit.radius;
    user.level = Math.min(Math.max((r - 1) / EXCITE_GAIN, -0.15), 1.25);
  };
  let emitTimer = 2.2;
  const emitPhoton = (): void => {
    photonOrigin.copy(hero.body.getWorldPosition(new Vector3()));
    photonDir.copy(photonOrigin).normalize();
    photonLife = 0.0001;
  };
  ctx.input.register(hero.body, {
    tooltip: labels.electron,
    cursor: 'grab',
    hover: (over) => ctx.tweens.to(user, { glow: over ? 1 : 0 }, { duration: 0.12 }),
    dragStart: (e) => {
      user.dragging = true;
      onDrag(e);
    },
    drag: onDrag,
    dragEnd: () => {
      user.dragging = false;
      // falling back to the level the step asks for emits a photon (if the electron was lifted)
      if (user.level > 0.25) emitPhoton();
      hero.angle = user.angle;
      ctx.tweens.to(user, { level: 0 }, { duration: 0.5, ease: 'power2.in' });
      emitTimer = 3.4;
    },
  });

  /* ------------------------------------------------------------------------------------- per frame */
  const photonOrigin = new Vector3();
  const photonDir = new Vector3(1, 0, 0);
  let photonLife = 1;
  const m4 = new Matrix4();
  const p = new Vector3();
  const q = new Quaternion();
  const s = new Vector3();
  const xAxis = new Vector3();
  const yAxis = new Vector3();
  const zAxis = new Vector3();

  return {
    enterStep() {
      emitTimer = 2.2;
    },
    update(dt, t) {
      // nucleus: slow tumble + each nucleon breathing a little (never static — STYLE_GUIDE §1.3)
      nucleus.rotation.y = t * 0.16;
      nucleus.rotation.x = Math.sin(t * 0.11) * 0.2;
      for (let i = 0; i < count; i++) {
        const b = base[i]!;
        const wobble = 1 + Math.sin(t * 1.7 + i * 2.1) * 0.035;
        p.copy(b).multiplyScalar(wobble);
        s.setScalar(1 + Math.sin(t * 2.3 + i * 1.3) * 0.025);
        m4.compose(p, q.identity(), s);
        (i % 2 === 0 ? protons : neutrons).setMatrixAt(i >> 1, m4);
      }
      protonLabel.position.copy(protonAnchor).multiplyScalar(1 + NUCLEON_RADIUS / protonAnchor.length());
      nucleus.localToWorld(protonLabel.position);
      neutronLabel.position.copy(neutronAnchor).multiplyScalar(1 + NUCLEON_RADIUS / neutronAnchor.length());
      nucleus.localToWorld(neutronLabel.position);
      protons.instanceMatrix.needsUpdate = true;
      nucleus.updateMatrixWorld();
      plusMarks.forEach((mark, k) => {
        const wobble = 1 + Math.sin(t * 1.7 + k * 2 * 2.1) * 0.035;
        p.copy(base[k * 2]!).multiplyScalar(wobble);
        nucleus.localToWorld(p);
        s.copy(camera.camera.position).sub(p).normalize();
        mark.position.copy(p).addScaledVector(s, NUCLEON_RADIUS * 1.03);
      });
      neutrons.instanceMatrix.needsUpdate = true;
      core.scale.setScalar(1 + Math.sin(t * 1.3) * 0.08);

      // electrons on their orbits
      electrons.forEach((e, i) => {
        e.angle += e.orbit.speed * spin.value * dt;
        let angle = e.angle;
        let level = 0;
        if (i === 0) {
          // shortest-path blend toward the hold angle while the `electron` step frames it
          const delta = Math.atan2(Math.sin(HOLD_ANGLE - angle), Math.cos(HOLD_ANGLE - angle));
          angle += delta * hold.value;
          if (user.dragging) angle = user.angle;
          level = Math.max(excite.value + user.level, -0.15);
        }
        const k = 1 + level * EXCITE_GAIN;
        e.group.scale.set(k, k, 1); // the whole orbit (ring + trail) widens with the energy level
        e.body.position.set(Math.cos(angle) * e.orbit.radius, Math.sin(angle) * e.orbit.radius, 0);
        e.body.scale.set(1 / k, 1 / k, 1);
        e.trail.head = angle;
        e.trail.strength = 0.55 + 0.45 * spin.value;
      });
      hero.body.getWorldPosition(dragLabel.position);
      heroMaterial.intensity = 1.9 + user.glow * 1.2 + Math.sin(t * 5) * 0.08;
      hero.body.scale.multiplyScalar(1 + user.glow * 0.22);

      // photon: emitted on de-excitation; in the `excited` step also on a slow loop so the shot stays alive
      if (stage.current === 'excited' && !user.dragging) {
        emitTimer -= dt;
        if (emitTimer <= 0) {
          emitTimer = 3.4;
          emitPhoton();
          user.level = -0.9; // drop to the ground level…
          ctx.tweens.to(user, { level: 0 }, { duration: 0.8, delay: 1.3, ease: 'back.out' }); // …and get re-excited
        }
      }
      if (photonLife < 1) {
        photonLife = Math.min(1, photonLife + dt / 1.9);
        photon.life = photonLife;
        photon.mesh.position.copy(photonOrigin).addScaledVector(photonDir, 0.9 + photonLife * 6.5);
        // ribbon basis: X along travel, Z toward the camera (so the wave is always seen face-on)
        xAxis.copy(photonDir);
        zAxis.copy(camera.camera.position).sub(photon.mesh.position);
        yAxis.crossVectors(zAxis, xAxis).normalize();
        zAxis.crossVectors(xAxis, yAxis).normalize();
        photon.mesh.quaternion.setFromRotationMatrix(m4.makeBasis(xAxis, yAxis, zAxis));
      }
      cloud.pixelScale =
        0.5 * ctx.viewport.height * ctx.viewport.dpr * camera.camera.projectionMatrix.elements[5]!;
    },
  };
});
