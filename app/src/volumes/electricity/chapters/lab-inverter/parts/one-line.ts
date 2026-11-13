/**
 * Step 9: the one-line diagram that floats over the picked exhibit — the script's «однолінійна схема з
 * перемикачем „мережа є / немає“». Blocks for the sources and loads the type really has (panels, battery,
 * inverter, house, grid), energy lines whose pulses run the way `typeFlows` says, and the grid relay drawn as
 * a switch blade that opens in a blackout (the anti-islanding rule of step 8). Pure builder; `apply` sets it.
 * Local space: the plate faces +Z, origin in its middle, units of the exhibit row.
 */
import { BoxGeometry, Group, Mesh, Vector3 } from 'three';
import { createWire, type Wire } from '@/fx';
import { Builder } from '@/kit';
import { K, type ColorToken, type KGlowMaterial } from '@/style';
import { OWN } from '../labels-own';
import type { InverterType, TypeFlows } from '../sim-bindings/types-logic';
import { tag } from '../world';

export interface OneLine {
  group: Group;
  /** Show the flows of this frame; `grid` = the «Мережа є / немає» toggle. */
  apply(f: TypeFlows, grid: boolean, t: number): void;
  /** True while the grid relay's blade stands open (for the interaction test). */
  relayOpen(): boolean;
}

export const ONE_LINE = { w: 3.6, h: 1.7 } as const;

const P = {
  pv: new Vector3(-1.3, 0.38, 0),
  bat: new Vector3(-1.3, -0.42, 0),
  inv: new Vector3(-0.1, 0, 0),
  grid: new Vector3(1.3, 0.38, 0),
  house: new Vector3(1.3, -0.42, 0),
  relay: new Vector3(0.62, 0.38, 0),
} as const;

function block(color: ColorToken, w = 0.42, h = 0.3): Mesh {
  return new Mesh(
    new BoxGeometry(w, h, 0.06),
    K.glow({ color, intensity: 1.1, whiten: 0.15, keepHue: true }),
  );
}

export function createOneLine(type: InverterType, accent: ColorToken): OneLine {
  const hasBattery = type === 'offgrid' || type === 'hybrid';
  const hasGrid = type !== 'offgrid';
  const group = new Group();
  group.name = `one-line-${type}`;
  // a dark slate with a glowing rim (a scope screen would draw its centre cross through the inverter block)
  const b = new Builder(`one-line-plate-${type}`);
  b.box(ONE_LINE.w, ONE_LINE.h, 0.04, {
    r: 0.12,
    slot: 'gloss',
    c: 'bg.indigo',
    at: [0, -ONE_LINE.h / 2, -0.02],
  });
  const rim = 0.025;
  for (const k of [-1, 1]) {
    b.box(ONE_LINE.w, rim, rim, {
      r: 0,
      slot: 'glow',
      c: 'violet',
      at: [0, k * ONE_LINE.h * 0.5 - rim / 2, 0.01],
    });
    b.box(rim, ONE_LINE.h, rim, {
      r: 0,
      slot: 'glow',
      c: 'violet',
      at: [k * ONE_LINE.w * 0.5, -ONE_LINE.h / 2, 0.01],
    });
  }
  group.add(b.build().group);

  const node = (at: Vector3, color: ColorToken, text: string, w?: number): Mesh => {
    const m = block(color, w);
    m.position.copy(at).setZ(0.05);
    const t = tag(text, 20, 'white');
    t.position.copy(at).add(new Vector3(0, -0.3, 0.06));
    group.add(m, t);
    return m;
  };
  node(P.pv, 'yellow', OWN.oneLinePv);
  const inv = node(P.inv, accent, type === 'micro' ? OWN.typeMicro : OWN.inverterState, 0.5);
  node(P.house, 'mist', OWN.oneLineHouse);
  if (hasBattery) node(P.bat, 'lime', OWN.colBattery);
  if (hasGrid) node(P.grid, 'sky', OWN.oneLineGrid);

  const z = 0.04;
  const line = (pts: Vector3[]): Wire =>
    createWire(
      pts.map((p) => p.clone().setZ(z)),
      { radius: 0.022, color: 'ink', repeat: 3, speed: 0.8, power: 0, detail: 14, castShadow: false },
    );
  const v = (x: number, y: number): Vector3 => new Vector3(x, y, 0);
  const wires = {
    pv: line([v(P.pv.x + 0.21, P.pv.y), v(-0.55, P.pv.y), v(-0.55, 0.05), v(P.inv.x - 0.25, 0.05)]),
    bat: hasBattery
      ? line([v(P.bat.x + 0.21, P.bat.y), v(-0.55, P.bat.y), v(-0.55, -0.05), v(P.inv.x - 0.25, -0.05)])
      : null,
    // the central plant feeds the street, and the house hangs on the street
    house:
      type === 'central'
        ? line([v(P.grid.x, P.grid.y - 0.15), v(P.house.x, P.house.y + 0.15)])
        : line([v(P.inv.x + 0.25, -0.05), v(0.4, -0.05), v(0.4, P.house.y), v(P.house.x - 0.21, P.house.y)]),
    // inverter → relay (the gap of the blade) → grid
    gridIn: hasGrid
      ? line([v(P.inv.x + 0.25, 0.05), v(0.3, 0.05), v(0.3, P.relay.y), v(P.relay.x - 0.17, P.relay.y)])
      : null,
    gridOut: hasGrid ? line([v(P.relay.x + 0.17, P.relay.y), v(P.grid.x - 0.21, P.grid.y)]) : null,
  };
  for (const w of Object.values(wires)) if (w) group.add(w);

  // the relay: two contacts and a blade hinged on the left one
  const relayMat = K.glow({ color: 'white', intensity: 1.2, whiten: 0, keepHue: true });
  const blade = new Mesh(new BoxGeometry(0.34, 0.035, 0.03).translate(0.17, 0, 0), relayMat);
  blade.position.set(P.relay.x - 0.17, P.relay.y, z + 0.02);
  if (hasGrid) {
    for (const k of [-1, 1]) {
      const c = new Mesh(new BoxGeometry(0.06, 0.06, 0.04), relayMat);
      c.position.set(P.relay.x + k * 0.17, P.relay.y, z + 0.02);
      group.add(c);
    }
    group.add(blade);
  }
  const invMat = inv.material as KGlowMaterial;
  const set = (w: Wire | null, f: number): void => {
    if (!w) return;
    w.material.power = Math.abs(f);
    w.material.speed = Math.sign(f || 1) * Math.abs(w.material.speed);
  };
  return {
    group,
    relayOpen: () => hasGrid && blade.rotation.z > 0.4,
    apply(f, grid, t) {
      set(wires.pv, f.pv);
      set(wires.bat, f.bat);
      set(wires.house, f.house);
      set(wires.gridIn, f.grid);
      set(wires.gridOut, f.grid);
      // blackout: the blade swings open (a grid-tie inverter stops; a hybrid forms its island behind it)
      const open = !grid;
      blade.rotation.z += ((open ? 0.75 : 0) - blade.rotation.z) * 0.2;
      relayMat.setColor(open ? 'red' : 'white');
      invMat.intensity = f.running ? 1.1 + 0.25 * Math.sin(t * 4) : 0.25;
    },
  };
}
