/** Minimal typed event emitter. `Events` maps event name → payload type. */
export type Unsubscribe = () => void;

export class Emitter<Events extends object> {
  private listeners = new Map<keyof Events, Set<(payload: never) => void>>();

  on<K extends keyof Events>(type: K, fn: (payload: Events[K]) => void): Unsubscribe {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(fn as (payload: never) => void);
    return () => this.off(type, fn);
  }

  once<K extends keyof Events>(type: K, fn: (payload: Events[K]) => void): Unsubscribe {
    const off = this.on(type, (p) => {
      off();
      fn(p);
    });
    return off;
  }

  off<K extends keyof Events>(type: K, fn: (payload: Events[K]) => void): void {
    this.listeners.get(type)?.delete(fn as (payload: never) => void);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.listeners.get(type);
    if (!set || set.size === 0) return;
    // Copy: listeners may unsubscribe (or subscribe) while being notified.
    for (const fn of [...set]) (fn as (payload: Events[K]) => void)(payload);
  }

  clear(): void {
    this.listeners.clear();
  }
}
