import { describe, expect, it } from 'vitest';
import type { Position } from '@/engine/api';
import { Landing } from '../landing';

/** A minimal engine: the runtime's visit gate and a store with progress, position and `markVisited`. */
function fakeEngine(visited: Record<string, string[]> = {}) {
  const state = {
    volumeId: null as string | null,
    chapterId: null as string | null,
    stepId: null as string | null,
    progress: { visited },
  };
  const runtime = { visitGate: null as ((pos: Position) => boolean) | null };
  const store = {
    get: () => state,
    markVisited(pos: Position) {
      const key = `${pos.volumeId}/${pos.chapterId}`;
      const list = state.progress.visited[key] ?? [];
      if (!list.includes(pos.stepId)) state.progress.visited = { ...state.progress.visited, [key]: [...list, pos.stepId] };
    },
  };
  /** What the runtime does when it enters a step: set the position, ask the gate, mark. */
  const enter = (pos: Position) => {
    Object.assign(state, pos);
    if (runtime.visitGate?.(pos) !== false) store.markVisited(pos);
  };
  return { state, runtime, store, enter, engine: { runtime, store } as never };
}

const DIVE: Position = { volumeId: 'electricity', chapterId: 'atom', stepId: 'dive-in' };
const NUCLEUS: Position = { volumeId: 'electricity', chapterId: 'atom', stepId: 'nucleus' };

describe('Landing — the step behind the landing screen', () => {
  it('a first visit: the boot step is neither visited nor current until the learner reaches it', () => {
    const f = fakeEngine();
    const landing = new Landing(f.engine);
    landing.arm();
    f.enter(DIVE);
    expect(f.state.progress.visited).toEqual({});
    expect(landing.step).toEqual(DIVE);
    landing.revealed(); // the home / map screen closed onto the scene
    expect(f.state.progress.visited).toEqual({ 'electricity/atom': ['dive-in'] });
    expect(landing.step).toBeNull();
    expect(f.runtime.visitGate).toBeNull();
  });

  it('starting the same step from the map counts as reaching it', () => {
    const f = fakeEngine();
    const landing = new Landing(f.engine);
    landing.arm();
    f.enter(DIVE);
    landing.leaving('electricity/atom', 'dive-in');
    expect(landing.step).toEqual(DIVE);
    landing.revealed();
    expect(f.state.progress.visited['electricity/atom']).toEqual(['dive-in']);
  });

  it('going elsewhere first leaves the hidden step unvisited and marks only the target', () => {
    const f = fakeEngine();
    const landing = new Landing(f.engine);
    landing.arm();
    f.enter(DIVE);
    landing.leaving('atom', 'nucleus');
    expect(landing.step).toBeNull();
    landing.revealed();
    f.enter(NUCLEUS);
    expect(f.state.progress.visited).toEqual({ 'electricity/atom': ['nucleus'] });
  });

  it('a step change by any other route drops the hidden step', () => {
    const f = fakeEngine();
    const landing = new Landing(f.engine);
    landing.arm();
    f.enter(DIVE);
    landing.moved(NUCLEUS);
    expect(landing.step).toBeNull();
    expect(f.runtime.visitGate).toBeNull();
  });

  it('a returning learner whose landing step was visited before is not affected', () => {
    const f = fakeEngine({ 'electricity/atom': ['dive-in', 'anatomy'] });
    const landing = new Landing(f.engine);
    landing.arm();
    f.enter(DIVE);
    expect(landing.step).toBeNull();
    expect(f.runtime.visitGate).toBeNull();
    expect(f.state.progress.visited['electricity/atom']).toEqual(['dive-in', 'anatomy']);
  });
});
