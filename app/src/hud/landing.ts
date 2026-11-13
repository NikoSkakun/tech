/**
 * The step behind the landing screen.
 *
 * A first visit without a deep link loads the volume's first step behind the home screen (the scene has to
 * be ready when the learner leaves it). For the engine that step is entered; for the learner nothing has
 * begun. So, until the learner actually reaches it, it must not count as visited (progress marks, the home
 * screen's «Продовжити») nor as "the step you are on" (the map's «Повернутися до кроку»).
 *
 * It becomes an ordinary visit when the learner leaves the full-screen views for it; going somewhere else
 * first simply drops it (it stays unvisited, like any step not opened). A returning learner whose landing
 * step was visited before is not affected.
 */
import { samePosition, type Engine, type Position } from '@/engine/api';
import { isVisited } from '@/content';

export class Landing {
  private unseen: Position | null = null;
  private armed = false;

  constructor(private readonly engine: Pick<Engine, 'runtime' | 'store'>) {}

  /** The step loaded behind the landing screen and not seen yet (null once seen, dropped, or never armed). */
  get step(): Position | null {
    return this.unseen;
  }

  /** Install the gate before the first chapter starts loading: only the very first step entered is held back. */
  arm(): void {
    this.armed = true;
    this.engine.runtime.visitGate = (pos) => {
      if (this.unseen) return !samePosition(pos, this.unseen);
      if (!this.armed) return true;
      this.armed = false;
      const key = `${pos.volumeId}/${pos.chapterId}`;
      if (isVisited(this.engine.store.get().progress.visited, key, pos.stepId)) return this.release();
      this.unseen = pos;
      return false;
    };
  }

  /** The learner is back on the scene (no overlay open): the step on screen is now really visited. */
  revealed(): void {
    const u = this.unseen;
    if (!u) return;
    const s = this.engine.store.get();
    this.release();
    if (s.volumeId === u.volumeId && s.chapterId === u.chapterId && s.stepId === u.stepId)
      this.engine.store.markVisited(u);
  }

  /** About to travel to `chapter` (short id or `volume/chapter`) / `stepId`: anywhere else drops the hidden step. */
  leaving(chapter: string, stepId?: string): void {
    const u = this.unseen;
    if (!u) return;
    const same = stepId === u.stepId && (chapter === u.chapterId || chapter === `${u.volumeId}/${u.chapterId}`);
    if (!same) this.release();
  }

  /** The engine entered a step (any route: keys, links, history): a different one drops the hidden step. */
  moved(pos: Position): void {
    if (this.unseen && !samePosition(pos, this.unseen)) this.release();
  }

  private release(): true {
    this.unseen = null;
    this.armed = false;
    this.engine.runtime.visitGate = null;
    return true;
  }
}
