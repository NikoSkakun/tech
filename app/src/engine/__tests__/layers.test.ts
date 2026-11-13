import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { OVERLAY_LAYER, toOverlay, worldBounds } from '../layers';

describe('layers', () => {
  it('toOverlay moves a whole subtree to the overlay layer', () => {
    const g = new Group();
    const child = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    g.add(child);
    toOverlay(g);
    expect(g.layers.mask).toBe(1 << OVERLAY_LAYER);
    expect(child.layers.mask).toBe(1 << OVERLAY_LAYER);
  });

  it('worldBounds ignores overlay objects, invisible helpers and non-drawing pick proxies', () => {
    const root = new Group();
    const body = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
    body.position.set(10, 0, 0);
    const label = toOverlay(new Mesh(new BoxGeometry(500, 50, 1), new MeshBasicMaterial())); // px-sized label geometry
    const hidden = new Mesh(new BoxGeometry(100, 100, 100), new MeshBasicMaterial());
    hidden.visible = false;
    const proxy = new Mesh(new BoxGeometry(80, 80, 80), new MeshBasicMaterial({ colorWrite: false }));
    root.add(body, label, hidden, proxy);
    const box = worldBounds(root);
    expect(box.min.toArray()).toEqual([9, -1, -1]);
    expect(box.max.toArray()).toEqual([11, 1, 1]);
    expect(worldBounds(new Group()).isEmpty()).toBe(true);
  });
});
