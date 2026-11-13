/**
 * The living layer of the opened inverter: energy wires along the current paths, the cyan outlines of the
 * switches, the voltage glow of the DC-link capacitors, signal "nerves" from the control board, status LEDs,
 * the lifting cover on its holographic cables and the «Рентген» view. No step logic: steps set the handles.
 */
import { BoxGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { createHeatShimmer, createWire, createXRay, type HeatShimmer, type Wire, type XRay } from '@/fx';
import { G, type KitModel } from '@/kit';
import { K, SEMANTIC, voltageRamp, type ColorLike, type KGlowMaterial } from '@/style';
import {
  COVER_BACK,
  COVER_TILT,
  COVER_Y,
  PATHS,
  STAGE,
  SWITCH_X,
  SWITCH_Z,
  TRAY,
  type PathName,
} from './inverter-layout';
import { createInverterOpen } from './inverter-open';

export interface InverterLive {
  /** Add this to the set (model + live layer). */
  group: Group;
  model: KitModel;
  /** Energy wires: set `.material.power` (0…1) and `.material.speed` (sign = direction). */
  wires: Record<PathName, Wire>;
  /** Cyan outlines of S1…S4 (intensity 0 = off … 1.8 = conducting). */
  switches: KGlowMaterial[];
  /** Outline of the boost switch and of the battery-side bridge. */
  boost: KGlowMaterial;
  dcdc: KGlowMaterial;
  leds: Record<'grid' | 'pv' | 'bat', KGlowMaterial>;
  xray: XRay;
  shimmer: HeatShimmer;
  /** 0 = closed … 1 = cover lifted; `away` 0…1 parks the lifted cover far behind (close-ups of the internals). */
  setOpen(v: number, away?: number): void;
  /** DC-link voltage 0…450 V → colour of the capacitor bands (voltage ramp) and their brightness. */
  setLinkVoltage(v: number): void;
  /** World position of a named anchor of the model. */
  at(name: string, out?: Vector3): Vector3;
}

const glow = (color: ColorLike, intensity = 0): KGlowMaterial =>
  K.glow({ color, intensity, whiten: 0, keepHue: true, falloff: 0 });

/** A thin frame around a transistor body (four bars), merged into one geometry. */
function frameGeometry(w: number, h: number): BoxGeometry[] {
  const t = 0.03;
  const bars: [number, number, number, number][] = [
    [w, t, 0, h / 2],
    [w, t, 0, -h / 2],
    [t, h, -w / 2, 0],
    [t, h, w / 2, 0],
  ];
  return bars.map(([bw, bh, x, y]) => new BoxGeometry(bw, bh, t).translate(x, y, 0) as BoxGeometry);
}

export function createInverterLive(): InverterLive {
  const model = createInverterOpen();
  const xray = createXRay(model.group, { color: 'violet', opacity: 0.04, edgeOpacity: 0.4 });
  const group = new Group();
  group.name = 'li6';
  group.add(model.group);

  // energy wires in the "river"; the DC side keeps the body dark, pulses are the energy colour
  const wire = (name: PathName, radius: number): Wire =>
    createWire([...PATHS[name]], { radius, color: 'ink', repeat: 1.6, speed: 1.6, power: 0, detail: 10 });
  const wires = {
    pvA: wire('pvA', 0.05),
    pvB: wire('pvB', 0.05),
    link: wire('link', 0.065),
    out: wire('out', 0.06),
    backup: wire('backup', 0.05),
    bat: wire('bat', 0.07),
  };
  group.add(...Object.values(wires));

  // outlines of the four bridge switches, the boost switch and the battery bridge
  const frame = G.mergeGeometries(frameGeometry(0.42, 0.44));
  const switches = SWITCH_X.map((x) => {
    const m = glow(SEMANTIC.electron);
    const f = new Mesh(frame, m);
    f.position.set(x, 0.42, SWITCH_Z + 0.14);
    group.add(f);
    return m;
  });
  const boost = glow('cyan');
  const bf = new Mesh(G.mergeGeometries(frameGeometry(0.62, 0.36)), boost);
  bf.position.set(STAGE.boost.at.x - 0.2, 0.34, STAGE.boost.at.z + 0.17);
  const dcdc = glow('cyan');
  const df = new Mesh(G.mergeGeometries(frameGeometry(0.72, 0.62)), dcdc);
  df.rotation.x = -Math.PI / 2;
  df.position.set(STAGE.dcdc.at.x, 0.16, STAGE.dcdc.at.z);
  group.add(bf, df);

  // voltage bands of the six DC-link cans: one material, colour = voltage ramp (blue → pink → coral)
  const link = glow('pink', 1.2);
  const band = new TorusGeometry(0.205, 0.022, 8, 40).rotateX(Math.PI / 2);
  const bands: TorusGeometry[] = [];
  for (const dx of [-0.24, 0.24])
    for (const dz of [-0.46, 0, 0.46])
      bands.push(band.clone().translate(STAGE.link.at.x + dx, 0.56, STAGE.link.at.z + dz) as TorusGeometry);
  group.add(new Mesh(G.mergeGeometries(bands), link));

  // "nerves": gate signals from the control header down to the four drivers (cyan pulses on thin wires)
  const c = STAGE.control.at;
  const nerves = SWITCH_X.map((x, i) =>
    createWire(
      [
        new Vector3(c.x - 0.45 + i * 0.17, c.y + 0.1, c.z - 0.55),
        new Vector3(c.x - 0.4 + i * 0.15, c.y - 0.05, c.z - 1.0),
        new Vector3(x, 0.2, STAGE.drivers.at.z + 0.12),
      ],
      {
        radius: 0.014,
        color: 'slate',
        pulseColor: 'cyan',
        repeat: 5,
        speed: 1.4,
        power: 0.9,
        phase: i * 0.25,
        detail: 14,
      },
    ),
  );
  group.add(...nerves);

  // status LEDs on the cover and the four holographic cables it hangs on
  const coverPart = model.part('cover');
  const led = new SphereGeometry(0.06, 12, 8);
  const leds = { grid: glow('sky', 1.7), pv: glow('yellow', 1.7), bat: glow('lime', 1.7) };
  Object.values(leds).forEach((m, i) => {
    const s = new Mesh(led, m);
    s.position.copy(model.anchor('led').position).add(new Vector3(i * 0.26, 0, 0));
    coverPart.add(s);
  });
  // unit cable along +Y from its foot; `setOpen` stretches each one from a tray corner to a cover corner
  const cable = new CylinderGeometry(0.012, 0.012, 1, 6).translate(0, 0.5, 0);
  const cableMat = K.glow({
    color: 'cyan',
    intensity: 1.1,
    whiten: 0,
    keepHue: true,
    falloff: 0,
    additive: true,
  });
  const cables = (['cornerLB', 'cornerRB', 'cornerLF', 'cornerRF'] as const).map((n) => {
    const m = new Mesh(cable, cableMat);
    const top = model.anchor(n).position.clone();
    m.position.set(top.x, TRAY.wall, top.z);
    group.add(m);
    return { mesh: m, top };
  });

  // heat rising from the bridge heat sink (strength ∝ losses, set by the steps)
  const shimmer = createHeatShimmer({ width: 1.7, height: 1.1, lines: 6, intensity: 0 });
  shimmer.position.set(STAGE.bridge.at.x, 1.05, SWITCH_Z - 0.4);
  group.add(shimmer);

  const tmp = new Vector3();
  const up = new Vector3();
  const Y = new Vector3(0, 1, 0);
  const self: InverterLive = {
    group,
    model,
    wires,
    switches,
    boost,
    dcdc,
    leds,
    xray,
    shimmer,
    setOpen(v, away = 0) {
      // lifted, the cover also slides back and tips its face toward the viewer, clear of the internals
      const e = v * v * (3 - 2 * v);
      coverPart.position.set(
        0,
        COVER_Y.closed + (COVER_Y.open - COVER_Y.closed) * e + 2.2 * away,
        COVER_BACK * e - 5.5 * away,
      );
      coverPart.rotation.x = COVER_TILT * e;
      coverPart.updateMatrix();
      for (const c of cables) {
        const tip = up.copy(c.top).applyMatrix4(coverPart.matrix).sub(c.mesh.position);
        const len = tip.length();
        c.mesh.scale.y = Math.max(len, 0.001);
        c.mesh.quaternion.setFromUnitVectors(Y, tip.divideScalar(len || 1));
      }
      // parked far away, cover and cables would only cross a close-up as stray lines: fade them out and hide
      cableMat.intensity = 1.1 * Math.min(1, v * 4) * (1 - away);
      const gone = away > 0.97;
      coverPart.visible = !gone;
      for (const c of cables) c.mesh.visible = !gone;
    },
    setLinkVoltage(v) {
      link.setColor(voltageRamp(Math.min(1, Math.max(0, v / 450))));
      link.intensity = 0.5 + Math.min(1.2, v / 330);
    },
    at: (name, out = tmp) => model.anchorWorld(name, out),
  };
  self.setOpen(1);
  self.setLinkVoltage(400);
  return self;
}
