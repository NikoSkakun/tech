/**
 * Session for step 10: three UPS classes ride through a loss (or a sag) of the mains. No three.js.
 *
 * Model (chapter document, step 10 + `calculators.ts`): transfer time t_tr — offline (slider, 8 ms by default),
 * line-interactive 4 ms, online 0; the PC's power supply holds its output for t_hold = ½·C·(U₁² − U₂²)/P
 * (`holdUpTimeS`); the PC survives when t_tr ≤ t_hold (`pcSurvives`). A sag to 190 V (`upsSagResponse`):
 * offline goes to battery (with its transfer gap), line-interactive boosts +15 % with its AVR, online ignores.
 * After the transfer the offline unit delivers a «модифікований синус» (120° pulses, 230 V RMS), the other two
 * a sine. Time runs slowed ×`UPS_SLOW` so that milliseconds can be watched.
 */
import {
  GRID_F_HZ,
  UPS_TRANSFER_S,
  holdUpTimeS,
  pcSurvives,
  upsSagResponse,
  waveSample,
  type UpsKind,
} from '@electricity/sim/lab-inverter';

export const UPS_KINDS: readonly UpsKind[] = ['offline', 'lineInteractive', 'online'];
export const UPS_SLOW = 100;
const PEAK = 230 * Math.SQRT2;
/** Stepped wave with 120° pulses and 230 V RMS: U = 230 / √(2/3). */
const QUASI_UDC = 230 / Math.sqrt(2 / 3);

export interface UpsUnit {
  kind: UpsKind;
  /** Output voltage now, relative to the mains peak (−1…1). */
  u: number;
  source: 'grid' | 'battery' | 'avr';
  /** Charge of the PC supply's hold-up capacitor, 1 = full … 0 = the PC resets. */
  reserve: number;
  pcAlive: boolean;
  transferS: number;
}

export interface UpsSession {
  readonly units: readonly UpsUnit[];
  readonly mains: boolean;
  readonly sag: boolean;
  /** Mains voltage now, relative to the nominal peak. */
  readonly uMains: number;
  readonly holdUpS: number;
  /** Model time since the last mains event, s. */
  readonly sinceS: number;
  set(o: { offlineTransferS: number; loadW: number }): void;
  setMains(on: boolean): void;
  setSag(on: boolean): void;
  survives(kind: UpsKind): boolean;
  tick(dt: number): void;
  reset(): void;
}

export function createUpsSession(): UpsSession {
  let mains = true;
  let sag = false;
  let t = 0; // model time, s
  let since = 1; // model time since the last event
  let offlineTransfer: number = UPS_TRANSFER_S.offline;
  let loadW = 300;
  const transferOf = (k: UpsKind): number => (k === 'offline' ? offlineTransfer : UPS_TRANSFER_S[k]);
  const units: UpsUnit[] = UPS_KINDS.map((kind) => ({
    kind,
    u: 0,
    source: 'grid',
    reserve: 1,
    pcAlive: true,
    transferS: transferOf(kind),
  }));
  const sine = (): number => Math.sin(2 * Math.PI * GRID_F_HZ * t);
  const self: UpsSession = {
    units,
    get mains() {
      return mains;
    },
    get sag() {
      return sag;
    },
    get uMains() {
      return mains ? (sag ? 190 / 230 : 1) * sine() : 0;
    },
    get holdUpS() {
      return holdUpTimeS(loadW);
    },
    get sinceS() {
      return since;
    },
    set(o) {
      offlineTransfer = o.offlineTransferS;
      loadW = o.loadW;
      for (const u of units) u.transferS = transferOf(u.kind);
    },
    setMains(on) {
      if (on === mains) return;
      mains = on;
      since = 0;
      if (on) for (const u of units) u.pcAlive = true; // the PCs boot again with the mains back
    },
    setSag(on) {
      if (on === sag) return;
      sag = on;
      since = 0;
    },
    survives: (kind) => pcSurvives(transferOf(kind), loadW),
    tick(dt) {
      const h = dt / UPS_SLOW;
      t += h;
      since += h;
      const hold = holdUpTimeS(loadW);
      for (const u of units) {
        const onBattery = !mains || (sag && upsSagResponse(u.kind).source === 'battery');
        const tr = u.transferS;
        const gap = onBattery && since < tr; // relay in flight: the output is dead
        if (!onBattery) {
          const r = sag ? upsSagResponse(u.kind) : { source: 'grid' as const, uOutV: 230 };
          u.source = r.source;
          u.u = (r.uOutV / 230) * sine();
        } else if (gap) {
          u.source = 'battery';
          u.u = 0;
        } else {
          u.source = 'battery';
          u.u =
            u.kind === 'offline'
              ? waveSample({ kind: 'quasi', udcV: QUASI_UDC, alphaDeg: 30 }, t % (1 / GRID_F_HZ)) / PEAK
              : sine();
        }
        // the hold-up capacitor drains while the output is dead and refills at once when it returns
        u.reserve = gap ? Math.max(0, 1 - since / hold) : u.pcAlive ? 1 : u.reserve;
        if (gap && since >= hold) u.pcAlive = false;
        // a PC that lost power boots again once the output is back (≈ 3 s on screen)
        if (!u.pcAlive && !gap) {
          u.reserve = Math.min(1, u.reserve + h / 0.03);
          if (u.reserve >= 1) u.pcAlive = true;
        }
      }
    },
    reset() {
      mains = true;
      sag = false;
      since = 1;
      for (const u of units) {
        u.pcAlive = true;
        u.reserve = 1;
      }
    },
  };
  return self;
}
