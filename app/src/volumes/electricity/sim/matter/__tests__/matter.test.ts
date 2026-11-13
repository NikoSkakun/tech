import { describe, expect, it } from 'vitest';
import {
  bandTower,
  breakdownState,
  conductivityRelativeToSi300,
  createElectronGas,
  diodeCircuit,
  dopedSilicon,
  driftVelocity,
  ELECTRON_GAS,
  hopRatePerS,
  intrinsicCarrierDensity,
  ledEmission,
  mercuryResistivityOhmM,
  mosfetSwitch,
  rectifierSample,
  resistivityOhmM,
  scatteringTimeS,
  siliconIntrinsic,
} from '../index';

describe('§2 electron gas', () => {
  it('drift: E = 0,2 V/m → 0,88 mm/s, v_d/v_F 5,6×10⁻¹⁰; 1 V/m → 4,4 mm/s; 0,112 V/m → 0,49 mm/s', () => {
    const d = driftVelocity(0.2);
    expect(d.driftMPerS * 1e3).toBeCloseTo(0.88, 2);
    expect(d.ratioToFermi / 5.6e-10).toBeCloseTo(1, 2);
    expect(driftVelocity(1).driftMPerS * 1e3).toBeCloseTo(4.4, 1);
    expect(driftVelocity(0.112).driftMPerS * 1e3).toBeCloseTo(0.49, 2);
  });
  it('scene: ~3 nm/s chaotic speed, mean scattering every 12,5 scene s at 20 °C, more often when hot', () => {
    expect(scatteringTimeS(20) / ELECTRON_GAS.realSecondsPerSceneSecond).toBeCloseTo(12.5, 9);
    expect(scatteringTimeS(300)).toBeLessThan(scatteringTimeS(20));
    const gas = createElectronGas({ fieldVPerM: 0.2 }, 9);
    let scattered = 0;
    for (let i = 0; i < 300; i++) {
      gas.step(1 / 30);
      scattered += gas.scatteredLastStep;
    }
    // 600 electrons × 10 s / 12,5 s ≈ 480 events
    expect(scattered).toBeGreaterThan(400);
    expect(scattered).toBeLessThan(560);
    // visual drift: v_d × 10⁸ × 2×10⁻¹⁵ s × 10⁹ = 0,176 nm/s against E
    expect(gas.driftOffsetNm() / 10).toBeCloseTo(-0.176, 2);
    for (const v of gas.positions) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(ELECTRON_GAS.boxNm);
    }
  });
});

describe('§3 bands', () => {
  it('Si n_i: 250 K 1,0×10⁸; 300 K 1,0×10¹⁰; 400 K 3,5×10¹²; 500 K 1,2×10¹⁴; Ge 400 K 7,5×10¹⁴', () => {
    const r = (m: 'Si' | 'Ge', t: number): number => intrinsicCarrierDensity(m, t).perCm3;
    expect(r('Si', 250) / 1e8).toBeCloseTo(1, 1);
    expect(r('Si', 300)).toBeCloseTo(1e10, 0);
    expect(r('Si', 400) / 3.5e12).toBeCloseTo(1, 1);
    expect(r('Si', 500) / 1.2e14).toBeCloseTo(1, 1);
    expect(r('Ge', 400) / 7.5e14).toBeCloseTo(1, 1);
  });
  it('0 K and < 50 K → 0; diamond/SiO₂ negligible; hop rate Si 300 K ≈ 0,7/s, clamped to 3', () => {
    expect(intrinsicCarrierDensity('Si', 0).perCm3).toBe(0);
    expect(intrinsicCarrierDensity('Si', 40).perCm3).toBe(0);
    expect(intrinsicCarrierDensity('diamond', 600)).toEqual({ perCm3: 0, negligible: true });
    expect(hopRatePerS(1e10)).toBeCloseTo(0.714, 3);
    expect(hopRatePerS(0)).toBe(0);
    expect(conductivityRelativeToSi300('Si', 300)).toBeCloseTo(1, 9);
    expect(conductivityRelativeToSi300('Cu', 300)).toBeGreaterThan(1e11);
  });
  it('tight-binding tower: N levels, gap → E_g as N → ∞, Cu has no gap', () => {
    const t = bandTower('Si', 16);
    expect(t.lower.levels).toHaveLength(16);
    expect(t.gapEv).toBeGreaterThan(1.12);
    expect(bandTower('Si', 1e23).gapEv).toBeCloseTo(1.12, 12);
    expect(bandTower('Si', 1).lower.levels).toEqual([-6]);
    expect(bandTower('Cu', 1e23)).toMatchObject({ upper: null, gapEv: 0, fermiEv: -6 });
  });
});

describe('§4 breakdown, §5 resistivity', () => {
  it('air 2,9 kV no breakdown, 3,0 kV breakdown; PTFE 59 kV no breakdown; avalanches from 0,85', () => {
    expect(breakdownState('air', 2.9).breakdown).toBe(false);
    expect(breakdownState('air', 2.9).avalanches).toBe(true);
    expect(breakdownState('air', 3.0).breakdown).toBe(true);
    expect(breakdownState('ptfe', 59).breakdown).toBe(false);
    expect(breakdownState('mica', 1).avalancheRatePerS).toBe(0);
  });
  it('Cu: −100 °C 0,89; 20 °C 1,68; 100 °C 2,20; 300 °C 3,51 ×10⁻⁸ Ω·m; NiCr 300 °C 1,22×10⁻⁶; impurities', () => {
    expect(resistivityOhmM('Cu', -100) * 1e8).toBeCloseTo(0.89, 2);
    expect(resistivityOhmM('Cu', 20) * 1e8).toBeCloseTo(1.68, 9);
    expect(resistivityOhmM('Cu', 100) * 1e8).toBeCloseTo(2.2, 2);
    expect(resistivityOhmM('Cu', 300) * 1e8).toBeCloseTo(3.51, 2);
    expect(resistivityOhmM('NiCr', 300) * 1e6).toBeCloseTo(1.22, 2);
    expect(resistivityOhmM('Cu', 20, 2) * 1e8).toBeCloseTo(3.68, 9);
    expect(mercuryResistivityOhmM(4.1).resistivityOhmM).toBe(0);
    expect(mercuryResistivityOhmM(4.15).resistivityOhmM).toBe(1e-10);
  });
});

describe('§6 silicon, §7 doping', () => {
  it('intrinsic Si 300 K: ρ ≈ 3,4×10³ Ω·m, pair rate 0,5/s; clamped 0,1…6', () => {
    const s = siliconIntrinsic(300);
    expect(s.resistivityOhmM / 3.4e3).toBeCloseTo(1, 1);
    expect(s.pairRatePerS).toBeCloseTo(0.5, 9);
    expect(siliconIntrinsic(200).pairRatePerS).toBe(0.1);
    expect(siliconIntrinsic(500).pairRatePerS).toBe(6);
  });
  it('N_D 10¹⁶ → μ_n ≈ 1110, ρ ≈ 0,56 Ω·cm; 10¹⁸ → μ_n ≈ 250, ρ ≈ 0,025; N_A 10¹⁶ → μ_p ≈ 405, ρ ≈ 1,5', () => {
    const n16 = dopedSilicon('n', 1e16);
    expect(n16.mobilityNCm2 / 1110).toBeCloseTo(1, 2);
    expect(n16.resistivityOhmCm).toBeCloseTo(0.56, 2);
    expect(n16.holesPerCm3).toBeCloseTo(1e4, 3);
    const n18 = dopedSilicon('n', 1e18);
    expect(n18.mobilityNCm2 / 250).toBeCloseTo(1, 1);
    expect(n18.resistivityOhmCm).toBeCloseTo(0.025, 3);
    const p16 = dopedSilicon('p', 1e16);
    expect(p16.mobilityPCm2 / 405).toBeCloseTo(1, 2);
    expect(p16.resistivityOhmCm).toBeCloseTo(1.5, 1);
    expect(dopedSilicon('n', 0).dopingPerCm3).toBe(1e12);
  });
});

describe('§8 diode, §9 devices', () => {
  it.each([
    [-6, -6.0, -1e-12],
    [0, 0, 0],
    [0.5, 0.477, 0.104e-3],
    [1, 0.554, 2.03e-3],
    [3, 0.598, 10.9e-3],
    [6, 0.618, 24.5e-3],
  ])('U_s = %f V → U_D %f V, I %f A', (us, ud, i) => {
    const c = diodeCircuit(us);
    expect(c.diodeV).toBeCloseTo(ud, 3);
    if (i === 0) expect(Math.abs(c.currentA)).toBeLessThan(1e-20);
    else expect(c.currentA / i).toBeCloseTo(1, 2);
  });
  it('depletion width W₀ at 0 V, wider in reverse, min barrier 0,05 V; flip = −U_s; rectifier blocks', () => {
    expect(diodeCircuit(0).depletionWidthUm).toBeCloseTo(0.43, 9);
    expect(diodeCircuit(-6).depletionWidthUm).toBeGreaterThan(1.3);
    expect(diodeCircuit(6).barrierV).toBeCloseTo(0.71 - 0.6184, 3); // U_D never reaches V_bi − 0,05 in range
    expect(diodeCircuit(3, true).currentA).toBeCloseTo(diodeCircuit(-3).currentA, 18);
    expect(rectifierSample(0.75, 'ac').outputV).toBeLessThan(1e-6);
    expect(rectifierSample(0.25, 'ac').outputV).toBeGreaterThan(4);
  });
  it('LED 1,9 eV → 653 nm red AlGaInP; 2,7 eV → 459 nm blue InGaN; MOSFET 1 V → 0, 3 V → 0,21 A, ≥ 4 V → 0,42 A', () => {
    expect(ledEmission(1.9).wavelengthNm).toBeCloseTo(652.5, 0);
    expect(ledEmission(1.9).material).toBe('AlGaInP');
    expect(ledEmission(2.7).wavelengthNm).toBeCloseTo(459.2, 0);
    expect(ledEmission(2.7).material).toBe('InGaN-blue');
    expect(ledEmission(1.45).band).toBe('ir');
    expect(mosfetSwitch(1).lampCurrentA).toBe(0);
    expect(mosfetSwitch(3).lampCurrentA).toBeCloseTo(0.21, 2);
    expect(mosfetSwitch(4).lampCurrentA).toBeCloseTo(0.42, 2);
    expect(mosfetSwitch(10).lampCurrentA).toBeCloseTo(0.42, 2);
  });
});
