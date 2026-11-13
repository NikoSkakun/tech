/**
 * Motion tokens — STYLE_GUIDE §5. Use these presets for durations/easings instead of ad-hoc numbers so the
 * whole course moves with one rhythm.
 */
import type { EaseName } from '@/engine/tween';

export interface MotionPreset {
  /** Seconds. */
  readonly duration: number;
  readonly ease: EaseName;
}

export const MOTION = {
  /** Camera shot change: 1.2–2.4 s, eased in and out, overshoot-free settle. */
  camera: { duration: 1.8, ease: 'cinematic' },
  cameraShort: { duration: 1.2, ease: 'cinematic' },
  cameraLong: { duration: 2.4, ease: 'cinematic' },
  /** Objects appear with scale-up + overshoot (0.35–0.6 s). */
  appear: { duration: 0.5, ease: 'back.out' },
  /** …and leave faster (0.2–0.3 s). */
  disappear: { duration: 0.25, ease: 'power2.in' },
  /** Generic state change (poses, parameters, colours). */
  state: { duration: 0.7, ease: 'power2.inOut' },
  /** Environment / lighting mood change (day → dusk …). */
  mood: { duration: 2.0, ease: 'sine.inOut' },
  /** UI: hover lift/glow. */
  hover: { duration: 0.12, ease: 'power1.out' },
  /** UI: press squash. */
  press: { duration: 0.08, ease: 'power1.out' },
  /** UI: release spring. */
  release: { duration: 0.4, ease: 'spring' },
  /** UI: panels open. */
  panel: { duration: 0.35, ease: 'power2.out' },
  /** Chapter transition (engine scale-zoom). */
  transition: { duration: 1.35, ease: 'power2.inOut' },
} as const satisfies Record<string, MotionPreset>;

export type MotionName = keyof typeof MOTION;

/** Delay between consecutive objects appearing together (30–80 ms). */
export const STAGGER = 0.055;

/** Duration multipliers applied when the `reducedMotion` setting is on. */
export const REDUCED_MOTION = {
  camera: 0.35,
  transition: 0.4,
  /** No idle camera drift, no pointer parallax, no shake. */
  drift: 0,
} as const;
