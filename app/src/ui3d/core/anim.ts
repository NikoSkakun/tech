/**
 * Show / hide choreography shared by all widgets (STYLE_GUIDE §5): things appear with a short rise and a
 * slight overshoot, and leave faster than they came. Everything runs on the engine clock through the host.
 */
import { MOTION } from '@/style';
import type { UiNode } from './node';

export interface RevealOptions {
  /** Where it comes from: offset in units (x right, y up) and start scale. Defaults: dy −14, scale 0.96. */
  dx?: number;
  dy?: number;
  scale?: number;
  /** Start tilt around the vertical axis, radians (panels "swing" open). */
  tilt?: number;
  delay?: number;
  duration?: number;
  instant?: boolean;
}

const shownState = new WeakMap<UiNode, boolean>();

/** True if the node is shown or animating in. */
export function isRevealed(node: UiNode): boolean {
  return shownState.get(node) ?? (node.visible && node.opacity > 0);
}

/** Animate a node in. Safe to call repeatedly and mid-flight. */
export function reveal(node: UiNode, opts: RevealOptions = {}): void {
  shownState.set(node, true);
  const host = node.surface?.host;
  const wasHidden = !node.visible || node.opacity <= 0.001;
  node.visible = true;
  if (!host || opts.instant) {
    Object.assign(node, { opacity: 1, x: 0, y: 0, scale: 1, rotY: 0 });
    return;
  }
  const reduced = host.reducedMotion();
  if (wasHidden) {
    node.opacity = 0;
    if (!reduced) {
      node.x = opts.dx ?? 0;
      node.y = opts.dy ?? -14;
      node.scale = opts.scale ?? 0.96;
      node.rotY = opts.tilt ?? 0;
    }
  }
  const duration = reduced ? 0.12 : (opts.duration ?? MOTION.panel.duration);
  host.tweens.to(node, { opacity: 1 }, { duration: duration * 0.7, delay: opts.delay, ease: 'power1.out' });
  host.tweens.to(node, { x: 0, y: 0, scale: 1, rotY: 0 }, { duration, delay: opts.delay, ease: 'back.out' });
}

/** Animate a node out, then take it out of the layout (`visible = false`). */
export function conceal(node: UiNode, opts: RevealOptions & { onDone?: () => void } = {}): void {
  if (shownState.get(node) === false) return;
  shownState.set(node, false);
  const host = node.surface?.host;
  const done = (): void => {
    if (shownState.get(node) !== false) return; // revealed again meanwhile
    node.visible = false;
    opts.onDone?.();
  };
  if (!host || opts.instant || !node.visible) {
    node.opacity = 0;
    done();
    return;
  }
  const reduced = host.reducedMotion();
  const duration = reduced ? 0.1 : (opts.duration ?? MOTION.disappear.duration);
  host.tweens.to(node, { opacity: 0 }, { duration, delay: opts.delay, ease: 'power2.in', onComplete: done });
  if (!reduced)
    host.tweens.to(
      node,
      { x: opts.dx ?? 0, y: opts.dy ?? -10, scale: opts.scale ?? 0.97 },
      { duration, delay: opts.delay, ease: 'power2.in' },
    );
}

/** Staggered reveal of siblings (30–80 ms apart). */
export function revealAll(nodes: readonly UiNode[], opts: RevealOptions = {}, stagger = 0.045): void {
  nodes.forEach((n, i) => reveal(n, { ...opts, delay: (opts.delay ?? 0) + i * stagger }));
}

/** Quick horizontal shake (wrong answer, refused action). */
export function shake(node: UiNode): void {
  const host = node.surface?.host;
  if (!host || host.reducedMotion()) return;
  host.tweens
    .timeline()
    .to(node, { x: -9 }, { duration: 0.05 })
    .to(node, { x: 8 }, { duration: 0.07 })
    .to(node, { x: -5 }, { duration: 0.06 })
    .to(node, { x: 0 }, { duration: 0.12, ease: 'spring' });
}
