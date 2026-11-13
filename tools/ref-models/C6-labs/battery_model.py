"""Reference Li-ion cell/pack model for lab-battery: OCV(SOC) tables, R0 + 1RC, discharge curves,
CC/CV charge, temperature factors, pack builder, toy ageing model. Pure Python, explicit Euler dt=1 s.

Test oracle for the simulation library (DECISIONS §10, §14, §41). The chapter document
`docs/volumes/electricity/chapters/lab-battery.md` (§M2–§M8) is authoritative. Brought in line with the reviewed document by
E1-reconcile (requests/R11 §2): heat counter (§M2), three-state ЛІ-6 compatibility (§M4), SOH clamp and
«поза межами моделі» rule (§M6), price table and calculators (§M8).

Usage:  python3 battery_model.py           print the reference values
        python3 battery_model.py --check   compare with the control points of the document; exit 1 on mismatch
"""
import math
import sys

SOC_PTS = [0, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100]
OCV = {
    'LFP': [2.50, 3.10, 3.20, 3.25, 3.28, 3.29, 3.30, 3.31, 3.32, 3.33, 3.34, 3.36, 3.60],
    'NMC': [2.75, 3.35, 3.45, 3.55, 3.62, 3.67, 3.72, 3.79, 3.88, 3.97, 4.07, 4.12, 4.19],
}
LIMITS = {  # Vmin discharge cut-off, Vmax charge (CV), nominal
    'LFP': dict(vmin=2.50, vmax=3.65, vnom=3.20),
    'NMC': dict(vmin=2.75, vmax=4.20, vnom=3.60),
}
CELLS = {
    # id: chem, Q [Ah], R0 [ohm] @25C, R1 [ohm], tau1 [s], mass [kg], Imax_cont [A], label
    '18650-NMC': dict(chem='NMC', Q=3.0, R0=0.030, R1=0.030, tau=200.0, m=0.047, Imax=15.0),
    '21700-NMC': dict(chem='NMC', Q=5.0, R0=0.020, R1=0.020, tau=200.0, m=0.069, Imax=10.0),
    'LFP-100': dict(chem='LFP', Q=100.0, R0=0.0008, R1=0.0006, tau=300.0, m=1.98, Imax=100.0),
    'LFP-314': dict(chem='LFP', Q=314.0, R0=0.00025, R1=0.0002, tau=300.0, m=5.6, Imax=157.0),
}


def ocv(chem, soc):
    xs, ys = SOC_PTS, OCV[chem]
    if soc > 100.0:  # steep extrapolation above 100 %% so CV taper terminates (0.5 V per 1 %% SOC)
        return ys[-1] + 0.5 * (soc - 100.0)
    s = max(0.0, soc)
    for i in range(len(xs) - 1):
        if s <= xs[i + 1]:
            t = (s - xs[i]) / (xs[i + 1] - xs[i])
            return ys[i] + t * (ys[i + 1] - ys[i])
    return ys[-1]


def r_temp_factor(T):
    """resistance multiplier vs 25 C (Arrhenius-like, illustrative)"""
    return math.exp(0.03 * (25.0 - T)) if T < 25 else max(0.8, 1 - 0.01 * (T - 25))


def cap_temp_factor(T):
    """available-capacity multiplier at discharge (illustrative table, linear interp)"""
    pts = [(-20, 0.70), (-10, 0.80), (0, 0.90), (10, 0.96), (25, 1.00), (45, 1.00)]
    if T <= pts[0][0]:
        return pts[0][1]
    for (t0, f0), (t1, f1) in zip(pts, pts[1:]):
        if T <= t1:
            return f0 + (T - t0) / (t1 - t0) * (f1 - f0)
    return pts[-1][1]


def discharge(cell, c_rate, T=25.0, soc0=100.0, dt=1.0):
    """constant-current discharge until V <= vmin.
    Returns (Ah delivered, Wh delivered, minutes, curve, heat [J]); heat counter of §M2:
    P_heat = I*(U_OCV - U) = I^2*R0 + I*U1, Q_heat = sum(P_heat*dt)."""
    c = CELLS[cell]
    lim = LIMITS[c['chem']]
    Qeff = c['Q'] * cap_temp_factor(T)
    I = c_rate * c['Q']
    R0 = c['R0'] * r_temp_factor(T)
    R1 = c['R1'] * r_temp_factor(T)
    C1 = c['tau'] / c['R1']
    soc, v1, ah, wh, t = soc0, 0.0, 0.0, 0.0, 0.0
    heat = 0.0
    curve = []
    while True:
        u_ocv = ocv(c['chem'], soc)
        v = u_ocv - I * R0 - v1
        if t % 60 == 0:
            curve.append((round(ah, 4), round(v, 4)))
        if v <= lim['vmin'] or soc <= 0:
            break
        v1 += dt * (I / C1 - v1 / (R1 * C1))
        soc -= I * dt / 3600.0 / Qeff * 100.0
        ah += I * dt / 3600.0
        wh += v * I * dt / 3600.0
        heat += I * (u_ocv - v) * dt
        t += dt
    return ah, wh, t / 60.0, curve, heat


def cccv(cell, c_rate, soc0=0.0, i_term_c=0.05, T=25.0, dt=1.0, vmax=None):
    """CC/CV charge. Returns dict with times (min), SOC at CC->CV, final SOC, Ah."""
    c = CELLS[cell]
    lim = LIMITS[c['chem']]
    vmax = vmax or lim['vmax']
    R0 = c['R0'] * r_temp_factor(T)
    R1 = c['R1'] * r_temp_factor(T)
    C1 = c['tau'] / c['R1']
    Q = c['Q']
    Icc = c_rate * Q
    soc, v1, t, ah = soc0, 0.0, 0.0, 0.0
    phase = 'CC'
    t_cv = None
    soc_cv = None
    soc80_t = None
    I = Icc
    while True:
        if phase == 'CC':
            I = Icc
            v = ocv(c['chem'], soc) + I * R0 + v1
            if v >= vmax:
                phase = 'CV'
                t_cv, soc_cv = t, soc
        if phase == 'CV':
            # current that holds terminal voltage at vmax (explicit in v1, soc)
            I = (vmax - ocv(c['chem'], soc) - v1) / R0
            I = max(0.0, min(I, Icc))
            if I <= i_term_c * Q:
                break
        v1 += dt * (I / C1 - v1 / (R1 * C1))
        soc += I * dt / 3600.0 / Q * 100.0
        ah += I * dt / 3600.0
        t += dt
        if soc80_t is None and soc >= 80.0:
            soc80_t = t
        if t > 48 * 3600:
            break
    return dict(t_total=t / 60.0, t_cc=(t_cv or t) / 60.0, soc_cv=soc_cv, soc_end=soc, ah=ah,
                t_to_80=(soc80_t or float('nan')) / 60.0)


def pack(cell, s, p, overhead=1.25):
    c = CELLS[cell]
    lim = LIMITS[c['chem']]
    V = s * lim['vnom']
    Q = p * c['Q']
    E = V * Q / 1000.0
    Imax = p * c['Imax']
    R = s * c['R0'] / p
    m = s * p * c['m'] * overhead
    return dict(V=V, Vmax=s * lim['vmax'], Vmin=s * lim['vmin'], Q=Q, kWh=E, Imax=Imax, Pmax_kW=V * Imax / 1000,
                R_mohm=R * 1000, mass_kg=m, Wh_per_kg=E * 1000 / m, cells=s * p)


LI6_WINDOW = (40.0, 60.0)   # battery port of the hybrid inverter ЛІ-6, V (docs/volumes/electricity/chapters/_shared-house.md §4)


def li6_compat(chem, s):
    """Three-state compatibility of an sS pack with the ЛІ-6 battery window (§M4):
    'ok'      — U_min >= 40 and U_max <= 60;
    'partial' — U_max <= 60 and U_min < 40 and U_nom >= 40 (the inverter stops discharging at 40 V);
    'fail'    — U_max > 60 or U_nom < 40."""
    lim = LIMITS[chem]
    lo, hi = LI6_WINDOW
    u_min, u_max, u_nom = s * lim['vmin'], s * lim['vmax'], s * lim['vnom']
    eps = 1e-9
    if u_max > hi + eps or u_nom < lo - eps:
        return 'fail'
    if u_min >= lo - eps:
        return 'ok'
    return 'partial'


def soh_after(chem, years, fec_per_year, dod, T=25.0, soc_avg=60.0):
    """toy ageing model: SOH = 1 - calendar - cycle.
    calendar: a_cal * f_T * f_SOC * sqrt(years); cycle: b * f_DoD * FEC / 1000.
    f_T = 2 ** ((T-25)/10); f_SOC = 0.5 + soc_avg/100; f_DoD = (dod/100) ** 0.5 (per FEC, deeper -> more wear)"""
    a_cal = {'LFP': 0.020, 'NMC': 0.030}[chem]
    b = {'LFP': 0.029, 'NMC': 0.118}[chem]
    f_T = 2 ** ((T - 25.0) / 10.0)
    f_soc = 0.5 + soc_avg / 100.0
    f_dod = (dod / 100.0) ** 0.5
    fec = fec_per_year * years
    return max(0.0, 1 - a_cal * f_T * f_soc * math.sqrt(years) - b * f_dod * fec / 1000.0)


SOH_MODEL_FLOOR = 0.60


def soh_in_model(soh):
    """§M6: the UI draws a solid curve down to SOH 0.60; below it — dashed, chip «поза межами моделі»."""
    return soh >= SOH_MODEL_FLOOR


# §M8 calculators ------------------------------------------------------------------------------------------------
# average pack price, $/kWh in 2025 dollars (BNEF; intermediate years approximated — see the document)
PRICE = dict(zip(range(2010, 2026), [1474, 1140, 900, 820, 730, 470, 365, 270, 225, 195, 170, 160, 170, 147, 118, 108]))
PRICE_STATIONARY_2025 = 70
SPECIFIC_ENERGY = {'lead': 40.0, 'LFP': 160.0, 'NMC': 250.0}   # Wh/kg
DOD_USE = {'lead': 0.5, 'LFP': 0.9, 'NMC': 0.9}


def cells_mass_kg(kwh, tech, usable=False):
    w = SPECIFIC_ENERGY[tech] * (DOD_USE[tech] if usable else 1.0)
    return kwh * 1000.0 / w


def runtime_h(kwh, dod, p_kw, eta=0.95):
    return kwh * dod * eta / p_kw


def cost_usd(kwh, year=2025, stationary=False):
    return kwh * (PRICE_STATIONARY_2025 if stationary else PRICE[year])


def check():
    """Compare the model with the control points of lab-battery §M2–§M8. Returns the number of mismatches."""
    bad = [0]
    n = [0]

    def eq(name, got, exp, tol):
        n[0] += 1
        if got is None or abs(got - exp) > tol + 1e-12:
            bad[0] += 1
            print('MISMATCH %s: model %s, document %s' % (name, got, exp))

    def same(name, got, exp):
        n[0] += 1
        if got != exp:
            bad[0] += 1
            print('MISMATCH %s: model %r, document %r' % (name, got, exp))

    # §M2 discharge (±0.3 % Ah/Wh, ±0.01 V, minutes ±0.5)
    m2 = [('21700-NMC', 0.2, 25, 4.983, 18.41, 299.0, 3.680), ('21700-NMC', 0.5, 25, 4.959, 18.05, 119.0, None),
          ('21700-NMC', 1.0, 25, 4.918, 17.47, 59.0, 3.520), ('21700-NMC', 2.0, 25, 4.836, 16.35, 29.0, 3.322),
          ('21700-NMC', 0.5, 0, 4.421, 15.66, None, None), ('21700-NMC', 0.5, -10, 3.905, 13.59, None, None),
          ('21700-NMC', 0.5, -20, 3.388, 11.53, None, None),
          ('LFP-100', 0.2, 25, 99.767, 324.04, 299.3, 3.272), ('LFP-100', 0.5, 25, 99.431, 319.13, 119.3, 3.230),
          ('LFP-100', 1.0, 25, 98.861, 311.15, 59.3, 3.160), ('LFP-100', 2.0, 25, 97.722, 296.05, 29.3, 3.026),
          ('LFP-100', 0.5, 0, 88.889, 279.19, None, None), ('LFP-100', 0.5, -10, 78.681, 243.78, None, None),
          ('LFP-100', 0.5, -20, 68.444, 208.44, None, None)]
    for cell, cr, T, ah_e, wh_e, min_e, vhalf_e in m2:
        ah, wh, mins, curve, heat = discharge(cell, cr, T=T)
        tag = 'M2 %s %.1fC %d°C' % (cell, cr, T)
        eq(tag + ' Ah', ah, ah_e, 0.003 * ah_e)
        eq(tag + ' Wh', wh, wh_e, 0.003 * wh_e)
        if min_e is not None:
            eq(tag + ' min', mins, min_e, 0.5)
        if vhalf_e is not None:
            eq(tag + ' U(half)', curve[len(curve) // 2][1], vhalf_e, 0.01)
        # heat counter: energy balance  sum(U_OCV*I*dt) = Wh*3600 + Q_heat  →  Q_heat = I^2*R0*t + I*sum(v1*dt) > 0
        c = CELLS[cell]
        i_a = cr * c['Q']
        ohmic = i_a ** 2 * c['R0'] * r_temp_factor(T) * mins * 60.0
        n[0] += 1
        if not (heat > 0 and ohmic <= heat * (1 + 1e-9) and heat <= ohmic * (1 + c['R1'] / c['R0']) + 1e-9):
            bad[0] += 1
            print('MISMATCH %s heat counter: %.1f J outside [%.1f, %.1f]' % (tag, heat, ohmic, ohmic * (1 + c['R1'] / c['R0'])))
    # §M3 CC/CV (±1 % time, ±0.3 pp SOC)
    m3 = [('21700-NMC', 0.5, None, 111.6, 93.0, 134.1, 96.0, 99.8), ('21700-NMC', 1.0, None, 49.8, 83.0, 81.9, 48.0, 99.8),
          ('21700-NMC', 0.5, 4.10, None, None, 129.3, None, 91.8),
          ('LFP-100', 0.5, None, 119.5, 99.6, 120.3, 96.0, 100.0), ('LFP-100', 1.0, None, 58.9, 98.1, 62.2, 48.0, 100.0)]
    for cell, cr, vmax, tcc_e, soccv_e, ttot_e, t80_e, socend_e in m3:
        r = cccv(cell, cr, vmax=vmax)
        tag = 'M3 %s %.1fC%s' % (cell, cr, ' U_max %.2f' % vmax if vmax else '')
        if tcc_e is not None:
            eq(tag + ' t_CC', r['t_cc'], tcc_e, 0.01 * tcc_e)
            eq(tag + ' SOC at CV', r['soc_cv'], soccv_e, 0.3)
            eq(tag + ' t to 80 %', r['t_to_80'], t80_e, 0.01 * t80_e)
        eq(tag + ' t_total', r['t_total'], ttot_e, 0.01 * ttot_e)
        eq(tag + ' SOC end', min(100.0, r['soc_end']), socend_e, 0.3)
    # §M4 pack builder and ЛІ-6 compatibility
    pk = pack('LFP-314', 16, 1)
    for key, exp, tol in (('V', 51.2, 0.05), ('Vmax', 58.4, 0.05), ('Vmin', 40.0, 0.05), ('Q', 314, 0.5), ('kWh', 16.08, 0.005),
                          ('Imax', 157, 0.5), ('Pmax_kW', 8.04, 0.005), ('R_mohm', 4.0, 0.05), ('mass_kg', 112.0, 0.05),
                          ('Wh_per_kg', 143.5, 0.05)):
        eq('M4 LFP-314 16S1P ' + key, pk[key], exp, tol)
    pk = pack('LFP-100', 16, 2)
    for key, exp, tol in (('kWh', 10.24, 0.005), ('Imax', 200, 0.5), ('R_mohm', 6.4, 0.05), ('mass_kg', 79.2, 0.05)):
        eq('M4 LFP-100 16S2P ' + key, pk[key], exp, tol)
    pk = pack('18650-NMC', 10, 4)
    for key, exp, tol in (('V', 36.0, 0.05), ('Q', 12, 0.5), ('kWh', 0.43, 0.005), ('Imax', 60, 0.5), ('Pmax_kW', 2.16, 0.005),
                          ('R_mohm', 75, 0.5), ('mass_kg', 2.35, 0.005)):
        eq('M4 18650 10S4P ' + key, pk[key], exp, tol)
    pk = pack('21700-NMC', 13, 4)
    for key, exp, tol in (('V', 46.8, 0.05), ('Q', 20, 0.5), ('kWh', 0.94, 0.005), ('R_mohm', 65, 0.5)):
        eq('M4 21700 13S4P ' + key, pk[key], exp, tol)
    pk = pack('18650-NMC', 96, 74)
    for key, exp, tol in (('V', 345.6, 0.05), ('Q', 222, 0.5), ('kWh', 76.72, 0.005), ('cells', 7104, 0)):
        eq('M4 18650 96S74P ' + key, pk[key], exp, tol)
    for chem, s_, exp in (('LFP', 16, 'ok'), ('LFP', 15, 'partial'), ('NMC', 14, 'partial'), ('LFP', 17, 'fail'), ('NMC', 10, 'fail')):
        same('M4 ЛІ-6 compatibility %s %dS' % (chem, s_), li6_compat(chem, s_), exp)
    # §M6 ageing
    for chem, yrs, exp in (('LFP', 5, 0.912), ('LFP', 10, 0.853), ('LFP', 15, 0.798), ('NMC', 5, 0.768), ('NMC', 10, 0.579)):
        eq('M6 SOH %s %d y' % (chem, yrs), soh_after(chem, yrs, 300, 80), exp, 0.0006)
    for T, exp in ((15, 0.887), (35, 0.783), (45, 0.644)):
        eq('M6 SOH LFP 10 y %d°C' % T, soh_after('LFP', 10, 300, 80, T=T), exp, 0.0006)
    for chem, exp in (('LFP', 15.1), ('NMC', 4.3)):
        y = 0.0
        while soh_after(chem, y, 292, 80) > 0.8 and y < 60:
            y += 0.01
        eq('M6 years to 80 %% %s' % chem, y, exp, 0.06)
    eq('M6 clamp SOH >= 0', soh_after('NMC', 40, 730, 100), 0.0, 0.0)
    y = 0.0
    while soh_in_model(soh_after('NMC', y, 730, 100)) and y < 60:   # 730 cycles/year of DoD 100 % = 730 FEC/year
        y += 0.01
    eq('M6 NMC 730 cycles/y leaves the model (0.60) after, years', y, 3.9, 0.06)
    same('M6 soh_in_model(0.60)', soh_in_model(0.60), True)
    same('M6 soh_in_model(0.59)', soh_in_model(0.59), False)
    # §M8 calculators
    for tech, exp, exp_use in (('lead', 125.0, 250.0), ('LFP', 31.25, 34.7), ('NMC', 20.0, 22.2)):
        eq('M8 mass 5 kWh %s' % tech, cells_mass_kg(5, tech), exp, 0.005)
        eq('M8 usable mass 5 kWh %s' % tech, cells_mass_kg(5, tech, usable=True), exp_use, 0.05)
    eq('M8 runtime 10 kWh, 90 %, 0.3 kW', runtime_h(10, 0.9, 0.3), 28.5, 0.005)
    eq('M8 cost 10 kWh 2010', cost_usd(10, 2010), 14740, 0.5)
    eq('M8 cost 10 kWh 2025', cost_usd(10, 2025), 1080, 0.5)
    eq('M8 cost 10 kWh stationary 2025', cost_usd(10, stationary=True), 700, 0.5)
    same('M8 price series length 2010–2025', len(PRICE), 16)
    print('battery_model check: %d control values, %d mismatches' % (n[0], bad[0]))
    return bad[0]


if __name__ == '__main__':
    if '--check' in sys.argv:
        sys.exit(1 if check() else 0)
    for chem in ('LFP', 'NMC'):
        print(chem, 'OCV@50%% = %.3f, @20%% = %.3f' % (ocv(chem, 50), ocv(chem, 20)))
    for cell in ('21700-NMC', 'LFP-100'):
        for cr in (0.2, 0.5, 1.0, 2.0):
            ah, wh, mins, curve, heat = discharge(cell, cr)
            print('%s %.1fC 25C: %.3f Ah  %.2f Wh  %.1f min  V@start=%.3f  V@50%%Ah=%.3f' % (
                cell, cr, ah, wh, mins, curve[0][1], curve[len(curve) // 2][1]))
        for T in (0, -10, -20):
            ah, wh, mins, curve, heat = discharge(cell, 0.5, T=T)
            print('%s 0.5C %dC: %.3f Ah  %.2f Wh' % (cell, T, ah, wh))
    for cell, cr in (('21700-NMC', 0.5), ('21700-NMC', 1.0), ('LFP-100', 0.5), ('LFP-100', 1.0), ('LFP-100', 0.2)):
        r = cccv(cell, cr)
        print('CCCV %s %.1fC from 0%%: CC %.1f min (SOC at CV %.1f%%), total %.1f min, to80 %.1f min, end SOC %.1f%%' % (
            cell, cr, r['t_cc'], r['soc_cv'], r['t_total'], r['t_to_80'], r['soc_end']))
    r = cccv('21700-NMC', 0.5, vmax=4.10)
    print('CCCV 21700 0.5C vmax 4.10: end SOC %.1f%% total %.1f' % (r['soc_end'], r['t_total']))
    for args in (('LFP-314', 16, 1), ('LFP-100', 16, 1), ('LFP-100', 16, 2), ('21700-NMC', 13, 4), ('18650-NMC', 10, 4),
                 ('18650-NMC', 96, 74), ('LFP-314', 1, 1), ('21700-NMC', 1, 1)):
        print('pack', args, {k: round(v, 2) for k, v in pack(*args).items()})
    for chem, fec, dod in (('LFP', 300, 80), ('LFP', 365, 100), ('NMC', 300, 80), ('NMC', 300, 50)):
        for yrs in (5, 10, 15):
            print('SOH %s %d FEC/yr DoD %d%% after %d yrs: %.3f' % (chem, fec, dod, yrs, soh_after(chem, yrs, fec, dod)))
    # cycles to 80% at DoD 80, 1 cycle/day-ish, 25C
    for chem in ('LFP', 'NMC'):
        y = 0.0
        while soh_after(chem, y, 365 * 0.8, 80) > 0.8 and y < 60:
            y += 0.01
        print('%s years to 80%% at 1 cycle/day DoD80 (FEC=292/yr): %.1f yrs = %d FEC' % (chem, y, y * 292))
    for T in (15, 25, 35, 45):
        print('SOH LFP 10 yrs 300FEC DoD80 T=%d: %.3f' % (T, soh_after('LFP', 10, 300, 80, T=T)))
