/**
 * `current` «Модель симуляції» §9 (step `measure`): battery ℰ, r → switch → lamp 5 Ω → jumper → battery.
 * 8 probe terminals: B+, B− (battery), Sa, Sb (switch), La, Lb (lamp), Ja, Jb (jumper the meter can replace).
 * Ideal wires join B+≡Sa, Sb≡La, Lb≡Ja, Jb≡B−. Meter models: V⎓ R_V = 10 MΩ (included in the MNA); V~ shows
 * 0,00 V on DC; Ω: de-energised circuit only (switch open), sources removed, 1 mA test current, "OL" if open;
 * error on a closed circuit or across the battery; mA⎓: R_A = 0,5 Ω, fuse 0,4 A (instantly blows); 10 A⎓:
 * R_A = 0,01 Ω, no fuse. Probes across the jumper replace it (series measurement).
 */
import { resistanceBetween, solveDc, voltageBetween, type CircuitElement } from '../core/S1-sim/mna';

export type BatteryId = 'new' | 'half' | 'flat';
export const BATTERIES: Readonly<Record<BatteryId, { emfV: number; internalOhm: number }>> = {
  new: { emfV: 1.58, internalOhm: 0.2 },
  half: { emfV: 1.35, internalOhm: 0.6 },
  flat: { emfV: 1.15, internalOhm: 2.0 },
};
export const MULTIMETER = { voltmeterOhm: 10e6, milliAmmeterOhm: 0.5, milliFuseA: 0.4, ampmeterOhm: 0.01, lampOhm: 5, testCurrentA: 1e-3, shortCircuitA: 2 } as const;

export type Terminal = 'B+' | 'B-' | 'Sa' | 'Sb' | 'La' | 'Lb' | 'Ja' | 'Jb';
export type MeterMode = 'off' | 'vdc' | 'vac' | 'ohm' | 'ma' | 'a10';

const NODE: Readonly<Record<Terminal, string>> = { 'B+': 'n1', Sa: 'n1', Sb: 'n2', La: 'n2', Lb: 'n3', Ja: 'n3', Jb: 'n4', 'B-': 'n4' };

export type MeterDisplay =
  | { kind: 'off' }
  | { kind: 'value'; value: number; unit: 'V' | 'Ω' | 'A' }
  | { kind: 'OL' }
  | { kind: 'FUSE' }
  | { kind: 'error'; reason: 'liveCircuit' | 'acrossSource' | 'noProbes' };

export interface MeterSetup {
  battery: BatteryId;
  switchClosed: boolean;
  mode: MeterMode;
  /** Red and black probe terminals, or null when not placed. */
  red: Terminal | null;
  black: Terminal | null;
  /** State of the mA fuse (persistent; «Замінити запобіжник» resets it). */
  milliFuseBlown: boolean;
}

export interface MeterReading {
  display: MeterDisplay;
  /** True if this reading blew the mA fuse. */
  blowsFuse: boolean;
  /** Battery current (with the meter connected), A. */
  batteryCurrentA: number;
  lampCurrentA: number;
  /** 10 A mode across the battery: short circuit (battery heats, red chip). */
  shortCircuit: boolean;
}

function circuit(setup: MeterSetup, replaceJumper: boolean): CircuitElement[] {
  const b = BATTERIES[setup.battery];
  const els: CircuitElement[] = [
    { kind: 'source', id: 'bat', plus: 'n1', minus: 'n4', emfV: b.emfV, internalResistanceOhm: b.internalOhm },
    { kind: 'switch', id: 'sw', a: 'n1', b: 'n2', closed: setup.switchClosed },
    { kind: 'resistor', id: 'lamp', a: 'n2', b: 'n3', resistanceOhm: MULTIMETER.lampOhm },
  ];
  if (!replaceJumper) els.push({ kind: 'wire', id: 'jumper', a: 'n3', b: 'n4' });
  return els;
}

export function readMeter(setup: MeterSetup): MeterReading {
  const probes = setup.red !== null && setup.black !== null;
  const ammeterMode = setup.mode === 'ma' || setup.mode === 'a10';
  const onJumper = probes && new Set([setup.red, setup.black]).size === 2 && [setup.red, setup.black].every((t) => t === 'Ja' || t === 'Jb');
  const els = circuit(setup, ammeterMode && onJumper);
  const base = (display: MeterDisplay, extra: CircuitElement[] = [], blowsFuse = false): MeterReading => {
    const s = solveDc([...els, ...extra]);
    const bat = s.elements.get('bat')!.currentA;
    const meter = s.elements.get('meter');
    return {
      display,
      blowsFuse,
      batteryCurrentA: bat,
      lampCurrentA: s.elements.get('lamp')!.currentA,
      shortCircuit: setup.mode === 'a10' && Math.abs(meter?.currentA ?? 0) > MULTIMETER.shortCircuitA,
    };
  };
  if (setup.mode === 'off') return base({ kind: 'off' });
  if (!probes) return base({ kind: 'error', reason: 'noProbes' });
  const a = NODE[setup.red!];
  const k = NODE[setup.black!];
  switch (setup.mode) {
    case 'vac':
      return base({ kind: 'value', value: 0, unit: 'V' });
    case 'vdc': {
      const meter: CircuitElement = { kind: 'resistor', id: 'meter', a, b: k, resistanceOhm: MULTIMETER.voltmeterOhm };
      const s = solveDc([...els, meter]);
      return { ...base({ kind: 'value', value: voltageBetween(s, a, k) ?? 0, unit: 'V' }, [meter]) };
    }
    case 'ohm': {
      if (setup.switchClosed) return base({ kind: 'error', reason: 'liveCircuit' });
      if (new Set([a, k]).size === 2 && [a, k].includes('n1') && [a, k].includes('n4')) return base({ kind: 'error', reason: 'acrossSource' });
      const r = resistanceBetween(els, a, k, MULTIMETER.testCurrentA);
      return base(Number.isFinite(r) ? { kind: 'value', value: r, unit: 'Ω' } : { kind: 'OL' });
    }
    case 'ma':
    case 'a10': {
      if (setup.mode === 'ma' && setup.milliFuseBlown) return base({ kind: 'FUSE' });
      const ra = setup.mode === 'ma' ? MULTIMETER.milliAmmeterOhm : MULTIMETER.ampmeterOhm;
      const meter: CircuitElement = { kind: 'ammeter', id: 'meter', a, b: k, resistanceOhm: ra };
      const s = solveDc([...els, meter]);
      const i = s.elements.get('meter')!.currentA;
      if (setup.mode === 'ma' && Math.abs(i) > MULTIMETER.milliFuseA) {
        const blown = base({ kind: 'FUSE' }, [{ ...meter, kind: 'fuse', blown: true } as CircuitElement], true);
        return blown;
      }
      return base({ kind: 'value', value: i, unit: 'A' }, [meter]);
    }
  }
}

/** «Калькулятор r»: r = (U₀ − U)/I from the open-circuit and loaded measurements. */
export const internalResistanceFromMeasurements = (openCircuitV: number, loadedV: number, currentA: number): number =>
  currentA > 0 ? (openCircuitV - loadedV) / currentA : NaN;
