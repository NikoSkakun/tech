/**
 * Look-dev sandbox "tabletop world": a floating island with a wind turbine, a power line carrying energy
 * pulses to a few houses, water, trees, clouds and small moving things; day → golden hour → dusk → night.
 */
import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Mesh,
  PointLight,
  TorusGeometry,
  Vector3,
} from 'three';
import { defineScene } from '@/engine/api';
import { K, col } from '@/style';
import { labels } from './content';
import {
  HILL,
  ISLAND_LAYERS,
  ISLAND_RADIUS,
  POND,
  createIslandGeometry,
  heightAt,
  rimRadius,
} from './parts/island';
import { createLabel } from './parts/label';
import {
  createBird,
  createCableGeometry,
  createCart,
  createClouds,
  createCrystals,
  createGreenhouse,
  createHouse,
  createLamp,
  createPylon,
  createRocks,
  createTank,
  createTransformer,
  createTrees,
  createTurbine,
  type TreeSpot,
} from './parts/props';

const ROAD_RADIUS = 6.35;

/** Distance from point (px, pz) to the segment a–b in the XZ plane. */
function distanceToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.min(Math.max(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0), 1);
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}

export default defineScene(async (ctx) => {
  const { root, stage, camera, random } = ctx;
  ctx.env.setScale(11);
  // shadows only need to cover the island top and its props (clouds far outside do not matter)
  ctx.env.setShadow({ extent: 10.5, center: [0, 0.5, 0], softness: 2.5 });
  ctx.post.base({ aoRadius: 0.5 });
  const ground = (x: number, z: number): Vector3 => new Vector3(x, heightAt(x, z), z);

  /* ------------------------------------------------------------------------------- island and water */
  const island = new Mesh(
    createIslandGeometry(),
    K.toon({ layers: { stops: ISLAND_LAYERS, wobble: 0.24, wobbleScale: 2.4 }, highlight: 0.15, rim: 0.9 }),
  );
  island.castShadow = true;
  island.receiveShadow = true;
  island.name = 'island';
  root.add(island);
  ctx.progress(0.2);
  await ctx.breathe();

  const pond = new Mesh(
    new CircleGeometry(POND.radius * 1.13, 72),
    K.water({ shallow: 'sky', deep: 'blue', scale: 1.1, glints: 0.7 }),
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(POND.x, POND.level, POND.z);
  pond.receiveShadow = true;
  root.add(pond);

  // a sandy ring road for the little cart: a ribbon draped on the terrain
  {
    const n = 160;
    const pos = new Float32Array((n + 1) * 2 * 3);
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      for (let s = 0; s < 2; s++) {
        const r = ROAD_RADIUS + (s === 0 ? -0.27 : 0.27);
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        pos.set([x, heightAt(x, z) + 0.025, z], (i * 2 + s) * 3);
      }
    }
    const index: number[] = [];
    for (let i = 0; i < n; i++) index.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    const road = new Mesh(
      g,
      K.toon({ color: col('yellow.light').lerp(col('orange'), 0.18), highlight: 0, rim: 0 }),
    );
    road.material.polygonOffset = true;
    road.material.polygonOffsetFactor = -2;
    road.material.polygonOffsetUnits = -2;
    road.receiveShadow = true;
    root.add(road);
  }

  /* -------------------------------------------------------------------------------------- buildings */
  const windowMaterial = K.toon({
    color: 'blue.dark',
    emissive: 'yellow',
    emissiveIntensity: 0,
    highlight: 0.8,
  });
  const houses = [
    {
      x: -3.9,
      z: -2.6,
      ry: 0.55,
      o: { width: 1.25, depth: 1.0, height: 0.85, wall: 'white', roof: 'coral', door: 'teal' },
    },
    {
      x: -1.6,
      z: -4.6,
      ry: -0.15,
      o: { width: 0.95, depth: 0.9, height: 0.72, wall: 'yellow.light', roof: 'violet', door: 'coral' },
    },
    {
      x: 1.3,
      z: 4.3,
      ry: 2.5,
      o: { width: 1.05, depth: 0.95, height: 0.78, wall: 'sky.light', roof: 'red', door: 'yellow' },
    },
  ] as const;
  const houseGroups = houses.map((h) => {
    const g = createHouse(h.o, windowMaterial);
    g.position.copy(ground(h.x, h.z));
    g.position.y -= 0.04;
    g.rotation.y = h.ry;
    root.add(g);
    return g;
  });
  const tank = createTank();
  tank.position.copy(ground(4.3, 2.7));
  root.add(tank);
  const greenhouse = createGreenhouse();
  greenhouse.position.copy(ground(3.0, 4.6));
  greenhouse.position.y -= 0.03;
  root.add(greenhouse);
  ctx.progress(0.4);
  await ctx.breathe();

  /* ----------------------------------------------------------------------- turbine and power line */
  const turbine = createTurbine();
  turbine.group.position.copy(ground(HILL.x, HILL.z));
  turbine.group.position.y -= 0.03;
  turbine.group.rotation.y = 0.75; // facing the wind, three-quarter view from the default camera
  root.add(turbine.group);
  const affordance = new Mesh(
    new TorusGeometry(1.78, 0.012, 8, 96),
    K.glow({ color: 'cyan', intensity: 1.0, additive: true, opacity: 0, falloff: 0, fog: false }),
  );
  affordance.position.copy(turbine.rotor.position);
  turbine.group.add(affordance);

  const transformer = createTransformer();
  transformer.group.position.copy(ground(2.15, -1.45));
  transformer.group.rotation.y = 0.4;
  root.add(transformer.group);
  const pylonSpots = [ground(0.45, -1.75), ground(-1.75, -2.2)];
  const pylons = pylonSpots.map((p) => {
    const g = createPylon();
    g.position.copy(p);
    g.rotation.y = 1.45;
    root.add(g);
    return g;
  });
  void pylons;
  const houseTop = houseGroups[0]!.position.clone().add(new Vector3(0.55, 0.92, 0.2));
  const cablePoints = [
    transformer.group.position.clone().add(new Vector3(0, 0.7, 0)),
    pylonSpots[0]!.clone().add(new Vector3(0, 1.9, 0)),
    pylonSpots[1]!.clone().add(new Vector3(0, 1.9, 0)),
    houseTop,
  ];
  const cableMaterial = K.energy({
    color: 'ink',
    pulseColor: 'yellow',
    repeat: 0.85, // pulses per world unit (the cable geometry's U runs in world units)
    speed: 0.4,
    length: 0.5,
    intensity: 4.2,
  });
  const cable = new Mesh(createCableGeometry(cablePoints, 1.0, 0.04), cableMaterial);
  cable.castShadow = true;
  root.add(cable);
  // short underground-style feeder from the tower base to the transformer
  const feeder = new Mesh(
    createCableGeometry(
      [
        turbine.group.position.clone().add(new Vector3(-0.2, 0.1, 0.25)),
        transformer.group.position.clone().add(new Vector3(0.3, 0.2, -0.1)),
      ],
      0,
      0.05,
    ),
    cableMaterial,
  );
  root.add(feeder);
  ctx.progress(0.6);
  await ctx.breathe();

  /* ------------------------------------------------------------------------------ nature and movers */
  const blocked: [number, number, number][] = [
    [POND.x, POND.z, POND.radius * 1.32],
    [HILL.x, HILL.z, 1.1],
    [4.3, 2.7, 1.1],
    [3.0, 4.6, 0.95],
    [2.15, -1.45, 0.8],
    ...houses.map((h) => [h.x, h.z, 1.25] as [number, number, number]),
    ...pylonSpots.map((p) => [p.x, p.z, 0.55] as [number, number, number]),
  ];
  const spots: TreeSpot[] = [];
  const kinds = ['round', 'round', 'round', 'conifer', 'bush'] as const;
  for (let tries = 0; tries < 900 && spots.length < 46; tries++) {
    const a = random.range(0, Math.PI * 2);
    const r = Math.sqrt(random.next()) * ISLAND_RADIUS * 0.84;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (r > rimRadius(a) * 0.8 || Math.abs(r - ROAD_RADIUS) < 0.55) continue;
    if (blocked.some(([bx, bz, br]) => Math.hypot(x - bx, z - bz) < br)) continue;
    if (spots.some((s) => Math.hypot(x - s.x, z - s.z) < 0.62)) continue;
    // keep the line of sight from the default camera to the power line reasonably open
    if (x > -3.2 && x < 2.8 && z > -3.0 && z < 0.5) continue;
    // …and the sight line of the dusk shot to the houses
    if (distanceToSegment(x, z, -8.4, 3.6, -3.0, -3.3) < 1.5) continue;
    spots.push({ x, y: heightAt(x, z), z, scale: random.range(0.75, 1.3), kind: random.pick(kinds) });
  }
  const trees = createTrees(spots, random.fork('trees'));
  root.add(trees.group);
  root.add(
    createRocks([
      [-0.6, heightAt(-0.6, 2.9) + 0.08, 2.9, 0.22],
      [-4.9, heightAt(-4.9, 0.6) + 0.06, 0.6, 0.17],
      [-0.2, heightAt(-0.2, 0.3) + 0.05, 0.3, 0.14],
      [5.6, heightAt(5.6, -0.4) + 0.08, -0.4, 0.26],
      [2.2, heightAt(2.2, 1.2) + 0.05, 1.2, 0.13],
    ]),
  );
  root.add(
    createCrystals(
      [
        [3.6, -2.6, 2.2, 0.5],
        [-2.8, -3.4, 3.0, 0.62],
        [-3.4, -2.4, -2.6, 0.42],
        [1.2, -4.6, -2.0, 0.55],
        [0.4, -5.6, 1.2, 0.4],
        [4.4, -1.9, -1.6, 0.36],
      ],
      'cyan',
    ),
  );
  const clouds = createClouds(random.fork('clouds'), ctx.quality.count(6, 3));
  root.add(clouds.mesh);
  const birds = [0, 1, 2].map((i) => {
    const b = createBird();
    root.add(b.group);
    return { ...b, radius: 5.2 + i * 1.1, height: 5.9 + i * 0.5, phase: i * 2.1, speed: 0.34 - i * 0.05 };
  });
  const cart = createCart();
  root.add(cart.group);

  const bulb = K.glow({ color: 'yellow', intensity: 0.35, core: 'white' });
  const lampSpots: [number, number, number][] = [
    [-3.1, -1.5, 2.4],
    [-2.5, -3.9, 0.6],
    [0.6, 3.5, -0.9],
  ];
  const lampLights = lampSpots.map(([x, z, ry]) => {
    const lamp = createLamp(bulb);
    lamp.position.copy(ground(x, z));
    lamp.rotation.y = ry;
    root.add(lamp);
    // warm pool of light on the ground at night (K.toon responds to point lights with the same cel model)
    const light = new PointLight(col('yellow').lerp(col('orange'), 0.3), 0, 4.2, 1.6);
    light.position.set(0.22, 0.85, 0);
    lamp.add(light);
    return light;
  });
  ctx.progress(0.85);
  await ctx.breathe();

  /* ---------------------------------------------------------------------------------------- labels */
  const L = labels;
  const turbineLabel = createLabel(L.turbine, { offset: [-1.2, 0.7, 0.6], color: 'white' });
  turbineLabel.position.set(0, turbine.hubHeight + 0.3, 0.1);
  turbine.group.add(turbineLabel);
  const lineLabel = createLabel(L.line, { offset: [0.3, 1.0, 0.4], color: 'white' });
  lineLabel.position
    .copy(cablePoints[1]!)
    .lerp(cablePoints[2]!, 0.5)
    .add(new Vector3(0, -0.12, 0));
  const houseLabel = createLabel(L.house, { offset: [0.5, 1.0, 0.4], color: 'white' });
  houseLabel.position.copy(houseGroups[0]!.position).add(new Vector3(0, 1.35, 0));
  const tankLabel = createLabel(L.tank, { offset: [0.9, 0.8, 0.4], color: 'white' });
  tankLabel.position.copy(tank.position).add(new Vector3(0, 2.35, 0));
  root.add(lineLabel, houseLabel, tankLabel);

  /* ------------------------------------------------------------------------------ declarative steps */
  const hub = turbine.group.position.clone().add(new Vector3(0, turbine.hubHeight, 0));
  camera.shots({
    island: {
      position: [11, 6.8, 25.5],
      target: [0, -1.5, 0],
      fov: 30,
      orbit: { azimuth: 1.4, polar: 0.4, zoom: [0.6, 1.4] },
    },
    wind: {
      position: hub.clone().add(new Vector3(3.6, 1.2, 8.2)),
      target: hub.clone().add(new Vector3(-0.3, -0.9, 0)),
      fov: 30,
    },
    line: { position: [-0.2, 3.9, 7.6], target: [-0.9, 1.35, -2.0], fov: 30 },
    dusk: { position: [-8.4, 3.9, 3.6], target: [-3.0, 0.8, -3.3], fov: 30 },
    night: {
      position: [-12, 6.2, 23.5],
      target: [0, -1.3, 0],
      fov: 30,
      orbit: { azimuth: 1.4, polar: 0.4, zoom: [0.6, 1.4] },
    },
  });
  const fade = { appear: 'fade', inDuration: 0.4 } as const;
  const aTurbine = stage.actor(turbineLabel, fade);
  const aLine = stage.actor(lineLabel, fade);
  const aHouse = stage.actor(houseLabel, fade);
  const aTank = stage.actor(tankLabel, fade);
  const wind = stage.param('wind', 1, { duration: 1.2 });
  const lights = stage.param('lights', 0, {
    duration: 1.6,
    onChange: (v) => {
      windowMaterial.emissiveIntensity = v * 2.6;
      bulb.intensity = 0.35 + v * 3.2;
      cart.headlight.intensity = 0.8 + v * 2.4;
      for (const l of lampLights) l.intensity = v * 2.6;
    },
  });
  const hint = stage.param('hint', 0, { onChange: (v) => (affordance.material.uniforms.opacity!.value = v) });
  void lights;
  void hint;

  stage.define({
    island: { show: [aTank], camera: 'island' },
    wind: { show: [aTurbine], camera: 'wind', params: { wind: 1.35, hint: 0.3 } },
    line: { show: [aLine, aHouse], camera: 'line', env: 'golden', params: { wind: 1.2 } },
    dusk: {
      show: [aHouse],
      camera: 'dusk',
      env: 'dusk',
      params: { lights: 1, wind: 0.9 },
      post: { bloomIntensity: 1.1 },
    },
    night: {
      camera: 'night',
      env: 'night',
      params: { lights: 1, wind: 1.6 },
      post: { bloomIntensity: 1.15, vignette: 0.48 },
    },
  });

  /* ------------------------------------------------------------------------------------ interaction */
  // Swipe across the rotor to change the wind: speed, pulse rate and brightness follow (power ∝ v³).
  const user = { wind: 0, hover: 0 };
  ctx.input.register(turbine.hit, {
    tooltip: L.turbine,
    cursor: 'ew-resize',
    hover: (over) => ctx.tweens.to(user, { hover: over ? 1 : 0 }, { duration: 0.12 }),
    drag: (e) => {
      user.wind = Math.min(Math.max(user.wind + e.dx * 0.012, -0.8), 1.4);
    },
    dragEnd: () => ctx.tweens.to(user, { wind: 0 }, { duration: 2.5, delay: 1.5, ease: 'power2.inOut' }),
  });

  const v = new Vector3();
  let rotorAngle = 0;
  let wheelAngle = 0;

  return {
    update(dt, t) {
      const speed = Math.max(wind.value + user.wind, 0.1);
      // rotor speed ∝ wind; electrical power ∝ wind³ (clamped at rated power) → pulse brightness and rate
      rotorAngle += speed * 1.9 * dt;
      turbine.rotor.rotation.z = -rotorAngle;
      const power = Math.min(Math.pow(speed / 1.35, 3), 1.6);
      cableMaterial.power = 0.25 + power * 0.85;
      cableMaterial.speed = 0.22 + 0.2 * speed;
      turbine.beacon.intensity = 1.2 + 2.2 * Math.max(0, Math.sin(t * 3.2));
      transformer.light.intensity = 1.6 + 0.8 * Math.sin(t * 6.0 * speed);
      affordance.material.intensity = 0.9 + user.hover * 1.6 + Math.sin(t * 3) * 0.25;
      affordance.rotation.z = t * 0.3;
      affordance.scale.setScalar(1 + user.hover * 0.04);

      trees.update(t);
      clouds.update(t);
      for (const b of birds) {
        const a = b.phase + t * b.speed;
        b.group.position.set(
          Math.cos(a) * b.radius,
          b.height + Math.sin(t * 0.7 + b.phase) * 0.3,
          Math.sin(a) * b.radius,
        );
        b.group.rotation.y = -a;
        const flap = Math.sin(t * 9 + b.phase) * 0.6;
        b.left.rotation.z = flap;
        b.right.rotation.z = -flap;
      }
      // the cart circles the ring road, hugging the terrain
      const ca = t * 0.11;
      const cx = Math.cos(ca) * ROAD_RADIUS;
      const cz = Math.sin(ca) * ROAD_RADIUS;
      cart.group.position.set(cx, heightAt(cx, cz) + 0.03, cz);
      v.set(Math.cos(ca + 0.02) * ROAD_RADIUS, 0, Math.sin(ca + 0.02) * ROAD_RADIUS);
      v.y = heightAt(v.x, v.z) + 0.03;
      cart.group.lookAt(v);
      cart.group.rotateY(-Math.PI / 2); // model faces +X
      wheelAngle += dt * 0.11 * ROAD_RADIUS * 13;
      for (const w of cart.wheels) w.rotation.z = -wheelAngle;
    },
  };
});
