/**
 * Step 6, the other architecture: a low-frequency inverter laid out on the bench in its real order — the 48 V
 * battery terminals, a bridge of four transistors working at 48 V, the heavy 50 Hz steel-and-copper toroid
 * (standing on its scale) that steps the 50 Hz up to 230 V, and the socket. Beside it, on the second scale, the
 * small ferrite transformer of the high-frequency design that does the same job at tens of kHz. Pure builder.
 * Local space: origin on the bench top in the middle of the row, +X downstream, +Z toward the viewer.
 */
import { CatmullRomCurve3, Group, Vector3 } from 'three';
import { createWaveOnCurve, createWire, type WaveOnCurve, type Wire } from '@/fx';
import { Builder, addSchukoSocket } from '@/kit';
import { SEMANTIC } from '@/style';
import { addHeatSink, addTransistor } from './components';
import { createFerriteScale, createToroidScale, type Scale } from './weigh-compare';

export interface LfChain {
  group: Group;
  hf: Scale;
  lf: Scale;
  /** 48 V into the bridge (DC) and the bridge's 50 Hz into the toroid (low voltage, big current). */
  wires: { dc: Wire; low: Wire };
  /** The 230 V sine travelling from the toroid to the socket. */
  wave: WaveOnCurve;
  /** Anchor points (local) for callouts. */
  points: { bridge: Vector3; socket: Vector3 };
}

const X = { hf: -2.25, bridge: -0.85, lf: 0.55, socket: 1.95 } as const;

function bridgeBlock(): Group {
  const b = new Builder('lf-bridge');
  b.box(1.0, 0.08, 0.8, { r: 0.03, slot: 'gloss', c: 'green', at: [0, 0, 0] });
  addHeatSink(b, [0, 0.08, -0.05], 0.86, 0.34, 0.22, 8);
  for (let i = 0; i < 4; i++) addTransistor(b, [-0.3 + i * 0.2, 0.08, 0.02], 0.36);
  // the 48 V terminals at the input edge: + coral, − blue
  b.cyl(0.07, 0.12, { seg: 16, slot: 'gloss', c: SEMANTIC.dcPlus, at: [-0.4, 0.08, 0.28] });
  b.cyl(0.07, 0.12, { seg: 16, slot: 'gloss', c: SEMANTIC.dcMinus, at: [-0.22, 0.08, 0.28] });
  return b.build().group;
}

function socketPost(): Group {
  const b = new Builder('lf-socket');
  b.box(0.7, 0.9, 0.16, { r: 0.05, slot: 'matte', c: ['slate', 'mist'], at: [0, 0, 0] });
  b.frame({ at: [0, 0.5, 0.09], s: 4.2 }, () => addSchukoSocket(b));
  return b.build().group;
}

export function createLfChain(): LfChain {
  const hf = createFerriteScale('');
  const lf = createToroidScale('');
  hf.group.position.x = X.hf;
  lf.group.position.x = X.lf;
  const bridge = bridgeBlock();
  bridge.position.x = X.bridge;
  const socket = socketPost();
  socket.position.set(X.socket, 0, -0.1);

  const wire = (pts: Vector3[], radius: number): Wire =>
    createWire(pts, { radius, color: 'ink', repeat: 1.6, speed: 1.1, power: 0.8, detail: 8 });
  const dc = wire(
    [
      new Vector3(X.bridge - 1.05, 0.05, 0.55),
      new Vector3(X.bridge - 0.75, 0.06, 0.4),
      new Vector3(X.bridge - 0.4, 0.2, 0.28),
    ],
    0.045,
  );
  // big current at 48 V: a thick lead from the bridge up to the toroid's winding
  const low = wire(
    [
      new Vector3(X.bridge + 0.45, 0.25, 0.05),
      new Vector3(X.lf - 0.75, 0.55, 0.2),
      new Vector3(X.lf - 0.42, 0.72, 0.15),
    ],
    0.06,
  );
  const outCurve = new CatmullRomCurve3(
    [
      new Vector3(X.lf + 0.42, 0.72, 0.15),
      new Vector3(X.lf + 0.85, 0.7, 0.2),
      new Vector3(X.socket - 0.1, 0.55, 0.05),
    ],
    false,
    'centripetal',
  );
  const out = createWire(outCurve.getPoints(12), {
    radius: 0.035,
    color: 'ink',
    repeat: 1.6,
    speed: 1.1,
    power: 0.5,
    detail: 8,
  });
  const wave = createWaveOnCurve(outCurve, {
    color: SEMANTIC.current,
    amplitude: 0.12,
    wavelength: 0.5,
    speed: 0.5,
    transverse: new Vector3(0, 1, 0),
    width: 0.04,
    taper: 0.2,
  });
  const group = new Group();
  group.name = 'set:dc-link-lf';
  group.add(hf.group, lf.group, bridge, socket, dc, low, out, wave);
  return {
    group,
    hf,
    lf,
    wires: { dc, low },
    wave,
    points: { bridge: new Vector3(X.bridge, 0.55, 0), socket: new Vector3(X.socket, 0.95, -0.1) },
  };
}
