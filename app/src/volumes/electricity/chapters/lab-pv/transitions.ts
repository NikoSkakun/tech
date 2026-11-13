/**
 * The script's step-to-step camera transitions that the stage camera can do on its own (DECISIONS: random
 * access — they play only when the learner steps *forward* from the scripted previous step and never on deep
 * links or chapter entry; the step's own state does not depend on them).
 *
 *  - `through`: first fly to an intermediate shot (e.g. dive at the 1 m² frame, rise above the bench, close in on
 *    the inverter), then on to the step's shot;
 *  - `pull`: start close on the new set (a jump while the old set is fading out) and pull back to the step's shot.
 */
import type { Shot, StepInfo } from '@/engine/api';
import type { Lab, StepId } from './chapter';

export interface Transition {
  from: StepId;
  kind: 'through' | 'pull';
  /** Intermediate (through) or start (pull) shot: a shot name or a shot built when the transition runs. */
  via: string | (() => Shot);
  /** Seconds of the first leg (through) and of the final move. */
  first?: number;
  last?: number;
}

/** Runs `t` from a step's `enter(info)` when the step is entered forward from `t.from`; true if it ran. */
export function playTransition(lab: Lab, info: StepInfo, to: StepId, t: Transition): boolean {
  if (info.instant || info.direction !== 1 || info.from !== t.from) return false;
  const camera = lab.ctx.camera;
  const via = typeof t.via === 'string' ? t.via : t.via();
  if (t.kind === 'pull') {
    camera.go(via, { instant: true });
    camera.go(to, { duration: t.last ?? 2.2 });
    return true;
  }
  const first = t.first ?? 0.9;
  camera.go(via, { duration: first, ease: 'power2.in' });
  info.scope.delay(first, () => {
    if (lab.isCurrent(to)) camera.go(to, { duration: t.last ?? 1.8, ease: 'power2.out' });
  });
  return true;
}
