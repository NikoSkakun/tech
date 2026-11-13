import { BoxGeometry, Group, Mesh, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { QaProbes } from '../qa-probes';

describe('QA probes (ctx.qa.probe → __app.locate)', () => {
  const camera = new PerspectiveCamera(50, 16 / 9, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  it('projects objects, points and getters to CSS pixels', () => {
    const probes = new QaProbes();
    const box = new Mesh(new BoxGeometry(1, 1, 1));
    probes.probe('box', box);
    probes.probe('point', new Vector3(0, 0, 0));
    probes.probe('live', () => null);
    const a = probes.locate('box', camera, 1280, 720)!;
    expect(a.x).toBeCloseTo(640, 3);
    expect(a.y).toBeCloseTo(360, 3);
    expect(a.visible && a.shown).toBe(true);
    expect(probes.locate('point', camera, 1280, 720)!.x).toBeCloseTo(640, 3);
    expect(probes.locate('live', camera, 1280, 720)).toBeNull();
    expect(probes.locate('nope', camera, 1280, 720)).toBeNull();
    expect(probes.names().sort()).toEqual(['box', 'live', 'point']);
  });

  it('reports hidden ancestors and points behind the camera', () => {
    const probes = new QaProbes();
    const parent = new Group();
    const child = new Mesh(new BoxGeometry(1, 1, 1));
    child.position.set(2, 0, 0);
    parent.add(child);
    parent.visible = false;
    const off = probes.probe('child', child);
    const c = probes.locate('child', camera, 1280, 720)!;
    expect(c.shown).toBe(false);
    expect(c.x).toBeGreaterThan(640);
    probes.probe('behind', new Vector3(0, 0, 20));
    expect(probes.locate('behind', camera, 1280, 720)!.visible).toBe(false);
    off();
    expect(probes.names()).toEqual(['behind']);
  });

  it('exposes observable state through readers', () => {
    const probes = new QaProbes();
    let soc = 40;
    probes.expose('soc', () => ({ soc }));
    soc = 55;
    expect(probes.read('soc')).toEqual({ soc: 55 });
    expect(probes.read('nope')).toBeUndefined();
    probes.clear();
    expect(probes.readerNames()).toEqual([]);
  });
});
