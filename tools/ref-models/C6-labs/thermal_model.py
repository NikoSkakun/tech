"""Illustrative thermal-runaway model for lab-battery (step `safety`, §M7): a cell in an oven at T_oven.

    dT/dt = (T_oven - T)/tau + sum_k dT_k * da_k/dt
    da_k/dt = r_k * exp(min(50, (T - T_k)/theta)) * (1 - a_k)   for T > T_k, else 0
Runaway when T >= T_cathode and self-heating > 10 °C/min; then T -> T_peak with tau_rise.
Explicit Euler, dt = 0.5 s (model time; the UI accelerates ×30).

Test oracle for the simulation library (DECISIONS §10, §14, §41); the chapter document
`docs/volumes/electricity/chapters/lab-battery.md` §M7 is authoritative. Updated by E1-reconcile (requests/R11 §2): control point
«LFP, oven 230 °C» instead of 240 °C (240 °C equals the stage threshold — knife-edge), the «перезаряд без BMS»
ramp scenario, and a `--check` mode.

Usage:  python3 thermal_model.py           print events for a sweep of oven temperatures
        python3 thermal_model.py --check   compare with the control points of the document; exit 1 on mismatch
"""
import math
import sys

TAU = 300.0     # s, thermal time constant cell ↔ oven
THETA = 12.0    # °C, exponential temperature scale of the side reactions
CHEM = {  # stages: (T_k [°C], r_k [1/s], dT_k [°C]) — SEI decomposition, cathode / electrolyte reaction
    'NMC': dict(stages=[(90.0, 0.00002, 30.0), (165.0, 0.002, 600.0)], T_sep=130.0, T_vent=140.0, T_peak=750.0, tau_rise=5.0),
    'LFP': dict(stages=[(90.0, 0.00001, 25.0), (240.0, 0.001, 250.0)], T_sep=130.0, T_vent=180.0, T_peak=450.0, tau_rise=30.0),
}


def overcharge_ramp(t):
    """«Перезаряд без BMS» (§M7): effective ambient temperature T_oven(t) = 25 + 2·t/60 [°C], t in s."""
    return 25.0 + 2.0 * t / 60.0


def run(chem, T_oven, T0=25.0, t_max=7200.0, dt=0.5):
    """Simulate; T_oven is a number [°C] or a function of time [s]. Returns (events, T_end, stage progress).
    events: model seconds of 'sei', 'separator', 'vent', 'cathode', 'runaway' and 'T_onset' [°C]."""
    p = CHEM[chem]
    oven = T_oven if callable(T_oven) else (lambda _t: T_oven)
    T, t = T0, 0.0
    ev = {}
    t_run = None
    T_run = None
    a = [0.0] * len(p['stages'])
    thresholds = (('sei', p['stages'][0][0]), ('separator', p['T_sep']), ('vent', p['T_vent']), ('cathode', p['stages'][1][0]))
    while t < t_max:
        if t_run is None:
            self_heat = 0.0   # °C/s
            for i, (Tk, r, dTk) in enumerate(p['stages']):
                if T > Tk:
                    da = r * math.exp(min(50.0, (T - Tk) / THETA)) * (1 - a[i])
                    a[i] = min(1.0, a[i] + da * dt)
                    self_heat += dTk * da
            T += ((oven(t) - T) / TAU + self_heat) * dt
            for name, Tk in thresholds:
                if name not in ev and T >= Tk:
                    ev[name] = round(t)
            if T >= p['stages'][1][0] and self_heat * 60 > 10.0:
                t_run, T_run = t, T
                ev['runaway'] = round(t)
                ev['T_onset'] = round(T)
        else:
            T = T_run + (p['T_peak'] - T_run) * (1 - math.exp(-(t - t_run) / p['tau_rise']))
        t += dt
    return ev, T, a


# Control table of lab-battery §M7 (model seconds from the start at T0 = 25 °C):
# (chem, T_oven, sei, separator, vent, runaway or None, T_onset or None)
EXPECTED_OVEN = [
    ('NMC', 150, 220, 529, 666, None, None),
    ('NMC', 160, 196, 440, 533, 804, 166),
    ('NMC', 200, 139, 272, 313, 410, 165),
    ('LFP', 200, 139, 274, 504, None, None),
    ('LFP', 230, 114, 214, 368, None, None),
    ('LFP', 260, 97, 177, 293, 638, 240),
]
# «Перезаряд без BMS»: (chem, sei, separator, vent, runaway, T_onset)
EXPECTED_RAMP = [('NMC', 2250, 3380, 3618, 4297, 166), ('LFP', 2250, 3418, 4882, 6750, 240)]
TOL_S = 2        # s (events are rounded model seconds)
TOL_T = 1.5      # °C for the onset temperature («≈»)


def check():
    bad = 0
    n = 0

    def cmp(tag, ev, exp):
        nonlocal bad, n
        for key, e in exp.items():
            n += 1
            got = ev.get(key)
            if e is None:
                if got is not None:
                    bad += 1
                    print('MISMATCH %s %s: model %s, document —' % (tag, key, got))
            elif got is None or abs(got - e) > (TOL_T if key == 'T_onset' else TOL_S):
                bad += 1
                print('MISMATCH %s %s: model %s, document %s' % (tag, key, got, e))

    for chem, T_oven, sei, sep, vent, runaway, T_on in EXPECTED_OVEN:
        ev, _, _ = run(chem, T_oven)
        cmp('%s oven %d °C' % (chem, T_oven), ev, dict(sei=sei, separator=sep, vent=vent, runaway=runaway, T_onset=T_on))
    for chem, sei, sep, vent, runaway, T_on in EXPECTED_RAMP:
        ev, _, _ = run(chem, overcharge_ramp)
        cmp('%s overcharge ramp' % chem, ev, dict(sei=sei, separator=sep, vent=vent, runaway=runaway, T_onset=T_on))
    print('thermal_model check: %d control values, %d mismatches' % (n, bad))
    return bad


if __name__ == '__main__':
    if '--check' in sys.argv:
        sys.exit(1 if check() else 0)
    for chem in ('NMC', 'LFP'):
        for To in (120, 130, 140, 150, 160, 180, 200, 220, 230, 260):
            ev, T, a = run(chem, To)
            print(chem, 'oven', To, ev, 'T_end=%.0f' % T)
        ev, T, a = run(chem, overcharge_ramp)
        print(chem, 'overcharge ramp', ev, 'T_end=%.0f' % T)
