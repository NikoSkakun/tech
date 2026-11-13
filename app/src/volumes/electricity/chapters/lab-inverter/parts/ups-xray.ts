/**
 * Step 10, «Рентген»: the inside of each UPS class as a block schematic on a plate (shown in place of the
 * station's scope). Offline: mains → relay → output, battery → inverter waits on the relay's other contact.
 * Line-interactive: the same with the voltage regulator (an autotransformer) in the mains path. Double
 * conversion: mains → rectifier → DC bus (with the battery) → inverter → output, always. The lit path follows
 * the unit's present source. Pure builder; `apply(unit)` sets it.
 */
import { BoxGeometry, Group, Mesh, Vector3 } from 'three';
import { createWire, type Wire } from '@/fx';
import { Builder } from '@/kit';
import type { UpsKind } from '@electricity/sim/lab-inverter';
import { K, type ColorToken } from '@/style';
import { OWN } from '../labels-own';
import type { UpsUnit } from '../sim-bindings/ups-session';
import { tag } from '../world';

export const XRAY = { w: 3.3, h: 1.5 } as const;

type Node = 'mains' | 'avr' | 'rect' | 'relay' | 'out' | 'bat' | 'inv';
const LABEL: Record<Node, string> = {
  mains: OWN.oneLineGrid,
  avr: OWN.xrayAvr,
  rect: OWN.rectifier,
  relay: OWN.xrayRelay,
  out: OWN.xrayOut,
  bat: OWN.colBattery,
  inv: OWN.inverterState,
};
const COLOR: Record<Node, ColorToken> = {
  mains: 'sky',
  avr: 'amber',
  rect: 'violet',
  relay: 'white',
  out: 'yellow',
  bat: 'lime',
  inv: 'cyan',
};
/** Top row = the mains path, bottom row = the battery path (plate units). */
const TOP = 0.22;
const BOT = -0.42;
const LAYOUT: Record<UpsKind, Partial<Record<Node, [number, number]>>> = {
  offline: { mains: [-1.2, TOP], relay: [0.15, TOP], out: [1.2, TOP], bat: [-1.2, BOT], inv: [0.15, BOT] },
  lineInteractive: {
    mains: [-1.25, TOP],
    avr: [-0.4, TOP],
    relay: [0.45, TOP],
    out: [1.25, TOP],
    bat: [-1.25, BOT],
    inv: [0.45, BOT],
  },
  online: { mains: [-1.25, TOP], rect: [-0.4, TOP], inv: [0.45, TOP], out: [1.25, TOP], bat: [0.02, BOT] },
};
/** Links (from → to) and which source lights them: `m` = mains path, `b` = battery path, `a` = always. */
const LINKS: Record<UpsKind, [Node, Node, 'm' | 'b' | 'a'][]> = {
  offline: [
    ['mains', 'relay', 'm'],
    ['relay', 'out', 'a'],
    ['bat', 'inv', 'b'],
    ['inv', 'relay', 'b'],
  ],
  lineInteractive: [
    ['mains', 'avr', 'm'],
    ['avr', 'relay', 'm'],
    ['relay', 'out', 'a'],
    ['bat', 'inv', 'b'],
    ['inv', 'relay', 'b'],
  ],
  online: [
    ['mains', 'rect', 'm'],
    ['rect', 'inv', 'm'],
    ['bat', 'inv', 'b'],
    ['inv', 'out', 'a'],
  ],
};

export interface UpsXray {
  group: Group;
  apply(u: UpsUnit): void;
}

export function createUpsXray(kind: UpsKind): UpsXray {
  const group = new Group();
  group.name = `ups-xray-${kind}`;
  const b = new Builder(`ups-xray-plate-${kind}`);
  b.box(XRAY.w, XRAY.h, 0.04, { r: 0.1, slot: 'gloss', c: 'bg.indigo', at: [0, -XRAY.h / 2, -0.02] });
  for (const k of [-1, 1]) {
    b.box(XRAY.w, 0.022, 0.022, { r: 0, slot: 'glow', c: 'violet', at: [0, (k * XRAY.h) / 2 - 0.011, 0.01] });
    b.box(0.022, XRAY.h, 0.022, {
      r: 0,
      slot: 'glow',
      c: 'violet',
      at: [(k * XRAY.w) / 2, -XRAY.h / 2, 0.01],
    });
  }
  group.add(b.build().group);
  const at = (n: Node): Vector3 => {
    const p = LAYOUT[kind][n]!;
    return new Vector3(p[0], p[1], 0.04);
  };
  // neighbours on the top row put their names on alternate sides, so long names never collide
  const top = (Object.keys(LAYOUT[kind]) as Node[])
    .filter((n) => LAYOUT[kind][n]![1] === TOP)
    .sort((a, c) => LAYOUT[kind][a]![0] - LAYOUT[kind][c]![0]);
  for (const n of Object.keys(LAYOUT[kind]) as Node[]) {
    const m = new Mesh(
      new BoxGeometry(n === 'relay' ? 0.22 : 0.36, 0.24, 0.05),
      K.glow({ color: COLOR[n], intensity: 1.1, whiten: 0.15, keepHue: true }),
    );
    m.position.copy(at(n));
    const t = tag(LABEL[n], 16, 'white');
    const above = top.indexOf(n) % 2 === 0;
    t.position.copy(at(n)).add(new Vector3(0, above ? 0.24 : -0.24, 0.02));
    group.add(m, t);
  }
  const links = LINKS[kind].map(([a, c, when]) => {
    const p = at(a);
    const q = at(c);
    // straight across a row; an L-shaped hop between the rows
    const pts =
      Math.abs(p.y - q.y) < 0.01
        ? [p.clone().setX(p.x + 0.2), q.clone().setX(q.x - 0.2)]
        : [
            p.clone().setX(p.x + 0.2),
            new Vector3(q.x, p.y, 0.04),
            q.clone().setY(q.y + (q.y > p.y ? -0.14 : 0.14)),
          ];
    const w: Wire = createWire(pts, {
      radius: 0.02,
      color: 'ink',
      repeat: 3,
      speed: 0.8,
      power: 0,
      detail: 14,
      castShadow: false,
    });
    group.add(w);
    return { w, when };
  });
  return {
    group,
    apply(u) {
      const battery = u.source === 'battery';
      for (const l of links)
        l.w.material.power = l.when === 'a' ? 0.9 : (l.when === 'b') === battery ? 0.9 : 0.04;
    },
  };
}
