// M3 kit additions requested by the pilots.
import { BoxGeometry, Group, Matrix4, Mesh, type InstancedMesh } from 'three';
import { describe, expect, it } from 'vitest';
import {
  Builder,
  addFloater,
  addJackUp,
  addJacket,
  addScour,
  addTopside,
  cylinderCellDetailed,
  levelTube,
  prismaticCellDetailed,
  latticeTower,
  powerLine,
  substation,
  windFleet,
  windTurbine,
} from '@/kit';

describe('builder: anchors and paths inside parts are prefixed (M3)', () => {
  it('registers <part>.<anchor> and keeps the bare name as an alias', () => {
    const b = new Builder('t');
    for (let i = 0; i < 3; i++) b.part(`blade${i}`, { at: [i, 0, 0] }).anchor('tip', 0, 5, 0);
    const m = b.build();
    expect(m.anchorLocal('blade0.tip').x).toBeCloseTo(0, 6);
    expect(m.anchorLocal('blade2.tip').x).toBeCloseTo(2, 6);
    expect(m.anchorLocal('tip').x).toBeCloseTo(2, 6); // alias: last one wins, as before
  });

  it('windTurbine exposes blade0…2.tip at rotor radius', () => {
    const t = windTurbine({ rotorDiameter: 100, hubHeight: 80 });
    const hub = t.anchorLocal('hub');
    const tips = [0, 1, 2].map((i) => t.anchorLocal(`blade${i}.tip`));
    for (const tip of tips) expect(tip.distanceTo(hub)).toBeGreaterThan(45);
    expect(tips[0]!.distanceTo(tips[1]!)).toBeGreaterThan(50);
  });
});

describe('windTurbine interior (M3)', () => {
  it('false drops the drive train but keeps its anchors; an Object3D is mounted in the nacelle', () => {
    const full = windTurbine();
    const empty = windTurbine({ interior: false });
    expect(empty.triangles).toBeLessThan(full.triangles);
    expect(() => empty.anchor('gearbox')).not.toThrow();
    const room = new Group();
    room.add(new Mesh(new BoxGeometry(1, 1, 1)));
    const custom = windTurbine({ interior: room });
    let parent = room.parent;
    while (parent && parent !== custom.part('nacelle')) parent = parent.parent;
    expect(parent).toBe(custom.part('nacelle'));
  });
});

describe('windFleet (M3)', () => {
  it('draws N turbines with the draw calls of one and spins every rotor', () => {
    const fleet = windFleet([
      { at: [0, 0, 0], yaw: 0 },
      { at: [300, 0, 0], yaw: Math.PI / 2, speed: 2 },
      { at: [0, 0, 300], s: 0.8 },
    ]);
    const meshes = fleet.group.children.filter((o): o is InstancedMesh => (o as InstancedMesh).isInstancedMesh);
    expect(meshes.length).toBeLessThan(20);
    expect(meshes.every((m) => m.count === 3)).toBe(true);
    const rotorMesh = meshes.find((m) => m.name.endsWith('@rotor'))!;
    const before = new Matrix4();
    const after = new Matrix4();
    rotorMesh.getMatrixAt(1, before);
    fleet.update(0.5);
    rotorMesh.getMatrixAt(1, after);
    expect(after.equals(before)).toBe(false);
    // hub of the yawed turbine sits at its placement, at hub height
    const hub = fleet.hubOf(1);
    expect(hub.y).toBeCloseTo(fleet.hubHeight, 0);
    expect(Math.abs(hub.x - 300)).toBeLessThan(10);
  });
});

describe('substation detail: light (M3)', () => {
  it('keeps ports and bay anchors at about a third of the cost', () => {
    const bays = [{ type: 'line' as const }, { type: 'transformer' as const }];
    const full = substation({ kV: 110, bays });
    const light = substation({ kV: 110, bays, detail: 'light' });
    console.info(`substation 110 kV, 2 bays: full ${full.triangles} tris, light ${light.triangles} tris`);
    expect(light.triangles).toBeLessThan(full.triangles * 0.4);
    expect(light.ports.length).toBe(1);
    expect(() => light.anchor('bay1.cb.p1.in')).not.toThrow();
    const line = powerLine([latticeTower({ voltage: 110 }), light.ports[0]!]);
    expect(line.group.children.length).toBeGreaterThan(0);
  });
});

describe('offshore models (moved from plant-wind, M3)', () => {
  it('jacket, floater, scour, topsides and jack-up build non-empty geometry', () => {
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const parts: [string, (b: Builder) => void][] = [
      ['jacket', (b) => addJacket(b, 30)],
      ['floater', (b) => addFloater(b)],
      ['scour', (b) => addScour(b, 6, rand)],
      ['ac', (b) => addTopside(b, 'ac')],
      ['hvdc', (b) => addTopside(b, 'hvdc')],
      ['jackup', (b) => addJackUp(b, 30)],
    ];
    for (const [name, add] of parts) {
      const b = new Builder(name);
      add(b);
      expect(b.build().triangles, name).toBeGreaterThan(100);
    }
  });
});

describe('close-up cells and level tube (M3)', () => {
  it('cylindrical cell: real size, header parts, plus/minus anchors', () => {
    const c = cylinderCellDetailed({ format: '21700' });
    for (const p of ['gasket', 'cid', 'ptc', 'vent', 'cap']) expect(() => c.part(p)).not.toThrow();
    expect(c.anchorLocal('plus').y).toBeGreaterThan(0.068);
    expect(c.anchorLocal('plus').y).toBeLessThan(0.075);
    const big = cylinderCellDetailed({ format: '4680', scale: 10 });
    expect(big.anchorLocal('window').z).toBeCloseTo(0.23, 2);
  });
  it('prismatic LFP: studs above the can, cutaway variant', () => {
    const p = prismaticCellDetailed();
    expect(p.anchorLocal('plus').y).toBeGreaterThan(0.2);
    expect(p.anchorLocal('plus').x).toBeLessThan(0);
    expect(prismaticCellDetailed({ cut: true }).triangles).toBeGreaterThan(p.triangles);
  });
  it('level tube clamps and moves its surface anchor', () => {
    const t = levelTube({ height: 1, level: 0.25 });
    expect(t.anchorLocal('surface').y - t.anchorLocal('bottom').y).toBeCloseTo(0.25, 6);
    t.level = 2;
    expect(t.level).toBe(1);
    t.setColor('coral');
  });
});
