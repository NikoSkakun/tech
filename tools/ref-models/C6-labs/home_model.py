"""Reference 24 h energy-flow model for lab-hybrid-home. Pure Python, deterministic.
dt = 5 min, 288 steps per day; the day is simulated 3 times and day 3 is reported (quasi steady state).

Test oracle for the simulation library (DECISIONS §10, §14, §41). The chapter document
`docs/volumes/electricity/chapters/lab-hybrid-home.md` (§M1–§M6) is authoritative; appliance constants are the "Симулятор" column of
`docs/volumes/electricity/chapters/_shared-house.md` §3. Brought in line with the reviewed document by E1-reconcile (requests/R11 §1):
self-sufficiency formula, battery power rule, boiler / air-conditioner constants, zero-capacity battery, CP8 start.

Usage:  python3 home_model.py           print PV / load summaries and CP1–CP12
        python3 home_model.py --check   compare with the control tables of the document; exit 1 on mismatch
"""
import math
import sys

DT_MIN = 5
STEPS = 24 * 60 // DT_MIN
H = DT_MIN / 60.0  # hours per step

SEASONS = {  # day-of-year, clock offset (clock = solar time + offset h), ambient-agnostic
    'winter': dict(doy=355, offset=0.0),
    'spring': dict(doy=80, offset=0.0),
    'summer': dict(doy=172, offset=1.0),
}
WEATHER = {'clear': 1.0, 'partly': 0.6, 'overcast': 0.2}
LAT = 50.45
TILT = 35.0
PR = 0.80


def poa_clear(doy, solar_hour, tilt=TILT, lat=LAT):
    """clear-sky plane-of-array irradiance [W/m2], south-facing panel."""
    decl = math.radians(23.45) * math.sin(2 * math.pi * (284 + doy) / 365)
    ha = math.radians(15 * (solar_hour - 12))
    phi = math.radians(lat)
    cz = math.sin(phi) * math.sin(decl) + math.cos(phi) * math.cos(decl) * math.cos(ha)
    if cz <= 0.0:
        return 0.0
    zdeg = math.degrees(math.acos(cz))
    am = 1.0 / (cz + 0.50572 * (96.07995 - zdeg) ** -1.6364)
    i0 = 1361.0 * (1 + 0.033 * math.cos(2 * math.pi * doy / 365))
    dni = i0 * 0.7 ** (am ** 0.678)
    dhi = 0.1 * dni
    ghi = dni * cz + dhi
    b = math.radians(tilt)
    # incidence on south-facing tilted plane: equivalent to horizontal at latitude (lat - tilt)
    phi2 = math.radians(lat - tilt)
    cos_i = math.sin(phi2) * math.sin(decl) + math.cos(phi2) * math.cos(decl) * math.cos(ha)
    cos_i = max(0.0, cos_i)
    return dni * cos_i + dhi * (1 + math.cos(b)) / 2 + 0.2 * ghi * (1 - math.cos(b)) / 2


def pv_kw(t_min, kwp, season, weather):
    s = SEASONS[season]
    solar_h = t_min / 60.0 - s['offset']
    return kwp * PR * poa_clear(s['doy'], solar_h) / 1000.0 * WEATHER[weather]


# Appliances: (id, kW, [(start_h, end_h)], critical, seasons)
ALL = ('winter', 'spring', 'summer')
APPLIANCES = [
    ('fridge', 0.06, [(0, 24)], True, ALL),
    ('router', 0.02, [(0, 24)], True, ALL),
    ('boiler_pump', 0.08, [(0, 24)], True, ('winter',)),
    ('lights', 0.15, [(6, 8), (17, 23)], True, ALL),
    ('tv_laptops', 0.15, [(18, 23)], True, ALL),
    ('laptop_work', 0.10, [(9, 17)], True, ALL),
    ('kettle', 2.0, [(7, 7 + 5 / 60), (13, 13 + 5 / 60), (19, 19 + 5 / 60)], False, ALL),
    ('stove', 1.5, [(18, 19)], False, ALL),
    ('washer', 0.8, [(10, 11.5)], False, ALL),
    # optional (off by default):
    ('water_heater', 2.0, [(13, 15)], False, ALL),   # same boiler as `home` §Г (2000 W)
    ('air_cond', 0.9, [(12, 18)], False, ('summer',)),  # same air conditioner as `home` §Г (900 W)
    ('ev', 3.7, [(22, 24), (0, 2)], False, ALL),
]
DEFAULT_ON = {'fridge', 'router', 'boiler_pump', 'lights', 'tv_laptops', 'laptop_work', 'kettle', 'stove', 'washer'}

OUTAGES = {
    'none': [],
    'two_queues': [(8, 12), (18, 22)],
    'hard_day': [(6, 10), (14, 18), (22, 24), (0, 2)],
    'day12': [(6, 18)],
    'blackout': [(0, 24)],
}


def in_windows(h, windows):
    return any(a <= h < b for a, b in windows)


def loads_kw(t_min, season, enabled):
    h = t_min / 60.0
    crit = non = 0.0
    for aid, kw, win, critical, seasons in APPLIANCES:
        if aid in enabled and season in seasons and in_windows(h, win):
            if critical:
                crit += kw
            else:
                non += kw
    return crit, non


def simulate(kwp=5.0, bat_kwh=10.24, inv_kw=6.0, season='winter', weather='overcast', outage='two_queues',
             mode='self_use', enabled=DEFAULT_ON, whole_home_backup=False, export_allowed=True, export_kw=5.0,
             reserve=30.0, soc_min=10.0, pbat_kw=None, grid_chg_kw=2.0, gen_kw=0.0, gen_start=20.0, gen_stop=80.0,
             idle_kw=0.05, eta_pv=0.97, eta_ch=0.95, eta_dis=0.95, soc0=50.0, days=3,
             tariff_day=4.32, tariff_night=2.16, multi_day=False):
    if pbat_kw is None:
        # UI rule «min(інвертор, 0,5 C)»: BMS-recommended 0.5 C (DECISIONS §24), capped by the inverter
        pbat_kw = min(inv_kw, 0.5 * bat_kwh)
    has_bat = bat_kwh > 0.0   # «Батарея 0 kWh»: no charge/discharge, SOC undefined (reported as nan)
    soc = soc0 if has_bat else 0.0
    gen_on = False
    for day in range(days):
        tot = dict(shed=0.0, pv=0.0, pv_used=0.0, load=0.0, served=0.0, unserved=0.0, imp=0.0, exp=0.0, curt=0.0,
                   chg=0.0, dis=0.0, gen=0.0, cost=0.0, island_h=0.0, dark_h=0.0)
        trace = []
        soc_min_seen = soc
        for k in range(STEPS):
            t = k * DT_MIN
            h = t / 60.0
            sched = OUTAGES[outage] if (day == days - 1 or multi_day) else []
            grid = not in_windows(h, sched)
            night = h >= 23 or h < 7
            pv = pv_kw(t + DT_MIN / 2, kwp, season, weather)  # mid-step sample
            crit, non = loads_kw(t, season, enabled)
            crit += idle_kw
            e_bat = bat_kwh * soc / 100.0
            room = bat_kwh * (100.0 - soc) / 100.0          # kWh that can still be stored
            pchg_lim = min(pbat_kw, room / eta_ch / H)       # kW at battery input side (before losses)
            if not has_bat and not grid:
                # no battery: the hybrid inverter cannot form an island — backup output off, PV curtailed,
                # generator is not started (document §M5, «Без батареї»)
                load = crit + (non if whole_home_backup else 0.0)
                tot['pv'] += pv * H
                tot['load'] += (crit + non) * H
                tot['unserved'] += load * H
                tot['shed'] += (0 if whole_home_backup else non) * H
                tot['curt'] += pv * H
                tot['island_h'] += H
                tot['dark_h'] += H
                gen_on = False
                trace.append((t, round(pv, 3), round(crit, 3), round(non, 3), grid, float('nan'), 0.0, 0.0, 0.0, 0.0,
                              round(pv, 3), 0.0))
                continue
            if grid:
                load = crit + non
                floor = reserve if mode != 'backup' else 100.0
                avail = max(0.0, (e_bat - bat_kwh * max(floor, soc_min) / 100.0)) * eta_dis / H
                pdis_lim = min(pbat_kw, avail, inv_kw)
                pv_ac = min(pv * eta_pv, inv_kw)
                pv_to_load = min(pv_ac, load)
                rest_load = load - pv_to_load
                surplus_dc = pv - pv_to_load / eta_pv
                chg = min(surplus_dc, pchg_lim)
                surplus_dc -= chg
                exp = min(surplus_dc * eta_pv, export_kw, inv_kw - pv_to_load) if export_allowed else 0.0
                exp = max(0.0, exp)
                curt = max(0.0, surplus_dc - exp / eta_pv)
                dis = 0.0
                if mode in ('self_use', 'tou') and not (mode == 'tou' and night):
                    dis = min(rest_load, max(0.0, min(pbat_kw, avail, inv_kw - pv_to_load)))
                rest_load -= dis
                gchg = 0.0
                if (mode == 'backup' or (mode == 'tou' and night)) and soc < 100.0:
                    gchg = max(0.0, min(grid_chg_kw, pchg_lim - chg))
                elif mode in ('self_use', 'tou') and soc < reserve:
                    gchg = max(0.0, min(grid_chg_kw, pchg_lim - chg))
                imp = rest_load + gchg
                served, unserved = load, 0.0
                if has_bat:
                    soc += ((chg + gchg) * eta_ch - dis / eta_dis) * H / bat_kwh * 100.0
                gen = 0.0
                gen_on = False
                island = False
            else:
                island = True
                load = crit + (non if whole_home_backup else 0.0)
                avail = max(0.0, (e_bat - bat_kwh * soc_min / 100.0)) * eta_dis / H
                pdis_lim = min(pbat_kw, avail)
                if gen_kw > 0 and soc <= gen_start:
                    gen_on = True
                if gen_on and soc >= gen_stop:
                    gen_on = False
                gen_cap = gen_kw if gen_on else 0.0
                pv_ac_cap = min(pv * eta_pv, inv_kw)
                pv_to_load = min(pv_ac_cap, load)
                need = load - pv_to_load
                gen_to_load = min(gen_cap, need)
                need -= gen_to_load
                dis = min(need, pdis_lim, max(0.0, inv_kw - pv_to_load))
                need -= dis
                if need > 1e-9:
                    # cannot cover: inverter shuts the backup output for this step (dark house)
                    served, unserved = 0.0, load
                    # undo: nothing delivered, PV may still charge battery
                    pv_to_load = gen_to_load = dis = 0.0
                else:
                    served, unserved = load, 0.0
                surplus_dc = pv - pv_to_load / eta_pv
                chg_pv = min(surplus_dc, pchg_lim)
                curt = surplus_dc - chg_pv
                gchg = min(gen_cap - gen_to_load, max(0.0, pchg_lim - chg_pv)) if gen_on else 0.0
                chg = chg_pv
                soc += ((chg + gchg) * eta_ch - dis / eta_dis) * H / bat_kwh * 100.0
                imp = exp = 0.0
                gen = gen_to_load + gchg
            soc = min(100.0, max(0.0, soc))
            soc_min_seen = min(soc_min_seen, soc)
            tot['pv'] += pv * H
            tot['pv_used'] += (pv - curt) * H
            tot['load'] += load * H if grid else (crit + non) * H
            tot['served'] += served * H
            tot['unserved'] += unserved * H
            tot['shed'] += (0 if (grid or whole_home_backup) else non) * H
            tot['imp'] += imp * H
            tot['exp'] += exp * H
            tot['curt'] += curt * H
            tot['chg'] += (chg + gchg) * H
            tot['dis'] += dis * H
            tot['gen'] += gen * H
            tot['cost'] += imp * H * (tariff_night if night else tariff_day)
            if island:
                tot['island_h'] += H
                if unserved > 0:
                    tot['dark_h'] += H
            trace.append((t, round(pv, 3), round(crit, 3), round(non, 3), grid, round(soc, 2) if has_bat else float('nan'),
                          round(imp, 3),
                          round(exp, 3), round(dis, 3), round(chg + gchg, 3), round(curt, 3), round(gen, 3)))
        tot['soc_end'] = soc if has_bat else float('nan')
        tot['soc_min'] = soc_min_seen if has_bat else float('nan')
    # share of the demand of critical + enabled appliances covered without the grid; dark hours lower it
    tot['self_sufficiency'] = max(0.0, (tot['served'] - tot['imp']) / max(1e-9, tot['served'] + tot['unserved']))
    tot['self_consumption'] = (tot['pv_used'] - tot['exp']) / max(1e-9, tot['pv'])
    return tot, trace


def fmt(tot):
    keys = ['pv', 'load', 'served', 'unserved', 'shed', 'imp', 'exp', 'curt', 'chg', 'dis', 'gen', 'cost', 'island_h', 'dark_h',
            'soc_min', 'soc_end', 'self_sufficiency', 'self_consumption']
    return ' '.join('%s=%.2f' % (k, tot[k]) for k in keys)


CASES = [
    ('CP1 default: winter overcast two_queues backup', dict(mode='backup')),
    ('CP2 winter overcast two_queues self_use', dict()),
    ('CP3 summer clear none self_use', dict(season='summer', weather='clear', outage='none')),
    ('CP4 summer clear none self_use zero export', dict(season='summer', weather='clear', outage='none', export_allowed=False)),
    ('CP5 winter overcast blackout backup', dict(outage='blackout', mode='backup')),
    ('CP6 winter overcast blackout self_use', dict(outage='blackout')),
    ('CP7 winter overcast blackout x3 days backup', dict(outage='blackout', mode='backup', multi_day=True)),
    ('CP8 same + generator 3 kW, gen_start 50', dict(outage='blackout', mode='backup', multi_day=True, gen_kw=3.0, gen_start=50.0)),
    ('CP9 winter overcast hard_day backup 5.12 kWh', dict(outage='hard_day', mode='backup', bat_kwh=5.12)),
    ('CP10 spring partly day12 tou', dict(season='spring', weather='partly', outage='day12', mode='tou')),
    ('CP11 summer clear blackout whole-home self_use', dict(season='summer', weather='clear', outage='blackout', whole_home_backup=True)),
    ('CP12 winter clear day12 self_use', dict(weather='clear', outage='day12')),
]

# Control table of lab-hybrid-home §M6 (day 3). Columns: pv load served unserved shed imp exp curt chg dis gen cost
# island_h dark_h soc_min soc_end SS SC. Tolerances: ±0.05 kWh (and грн), ±0.3 pp SOC, ±0.01 SS/SC.
EXPECTED = [
    (2.10, 10.99, 8.12, 0, 2.87, 6.43, 0.11, 0, 2.53, 2.28, 0, 23.28, 8, 0, 79.03, 100.00, 0.21, 0.95),
    (2.10, 10.99, 8.00, 0.13, 2.87, 6.20, 0, 0, 2.58, 2.33, 0, 22.56, 8, 0.25, 10.34, 30.00, 0.22, 1.00),
    (31.97, 9.07, 9.07, 0, 0, 0, 21.66, 0, 4.10, 3.70, 0, 0, 0, 0, 62.24, 71.35, 1.00, 0.32),
    (31.97, 9.07, 9.07, 0, 0, 0, 0, 22.33, 4.10, 3.70, 0, 0, 0, 0, 62.24, 71.35, 1.00, 0.30),
    (2.10, 10.99, 7.79, 0, 3.20, 0, 0, 0, 0.25, 5.99, 0, 0, 24, 0, 40.72, 40.72, 1.00, 1.00),
    (2.10, 10.99, 3.95, 3.84, 3.20, 0, 0, 0, 0.37, 2.27, 0, 0, 24, 9.50, 10.00, 10.08, 0.51, 1.00),
    (2.10, 10.99, 2.02, 5.77, 3.20, 0, 0, 0, 0.37, 0.33, 0, 0, 24, 17.42, 10.01, 10.08, 0.26, 1.00),
    (2.10, 10.99, 7.79, 0, 3.20, 0, 0, 0, 3.58, 5.58, 3.75, 0, 24, 0, 49.78, 50.79, 1.00, 1.00),
    (2.10, 10.99, 10.82, 0, 0.17, 8.49, 0.16, 0, 2.65, 3.11, 0, 33.84, 12, 0, 79.25, 85.20, 0.22, 0.92),
    (15.08, 9.07, 7.54, 0, 1.53, 5.31, 0, 12.33, 4.57, 4.13, 0, 11.47, 12, 0, 59.18, 77.73, 0.30, 0.18),
    (31.97, 9.07, 9.07, 0, 0, 0, 0, 22.33, 4.10, 3.70, 0, 0, 24, 0, 62.24, 71.35, 1.00, 0.30),
    (10.52, 10.99, 9.46, 0, 1.53, 0.31, 0, 0, 8.22, 6.91, 0, 0.68, 12, 0, 22.06, 44.90, 0.97, 1.00),
]
KEYS = ['pv', 'load', 'served', 'unserved', 'shed', 'imp', 'exp', 'curt', 'chg', 'dis', 'gen', 'cost', 'island_h', 'dark_h',
        'soc_min', 'soc_end', 'self_sufficiency', 'self_consumption']
TOL = dict(soc_min=0.3, soc_end=0.3, self_sufficiency=0.011, self_consumption=0.011)
# SOC traces of §M6 at steps 0, 72, 144, 216, 252, 287 (value after the step), keyed by CP number
SOC_TRACES = {
    1: [100.0, 100.0, 100.0, 99.56, 83.84, 100.0], 2: [30.0, 30.0, 30.31, 29.56, 13.84, 30.0],
    3: [71.24, 64.05, 100.0, 99.36, 81.16, 71.35], 5: [99.82, 86.74, 78.41, 68.65, 52.93, 40.72],
    8: [74.69, 61.61, 53.27, 78.73, 63.0, 50.79], 12: [39.56, 29.69, 61.83, 88.68, 57.11, 44.9],
}
# «Контроль челенджів кроку 8» of §M6: (name, kwargs, {key: expected})
OFF = lambda *ids: DEFAULT_ON - set(ids)
CP4 = dict(season='summer', weather='clear', outage='none', export_allowed=False)
CP7 = dict(outage='blackout', mode='backup', multi_day=True)
WOC = dict(season='winter', weather='overcast', outage='none')
CHALLENGES = [
    ('1 three days off-grid', dict(CP7, kwp=12, bat_kwh=20.48, enabled=OFF('tv_laptops')), dict(dark_h=0, soc_min=14.0)),
    ('1 second solution', dict(CP7, kwp=12, enabled=OFF('tv_laptops', 'laptop_work', 'lights')), dict(dark_h=0, soc_min=24.1)),
    ('2 summer without export', dict(CP4, kwp=3, enabled=DEFAULT_ON | {'water_heater', 'air_cond'}),
     dict(curt=0.0, imp=0.0, soc_min=32.7)),
    ('2 fails with 2 kWp', dict(CP4, kwp=2), dict(curt=3.08)),
    ('3 cheapest day: backup', dict(WOC, mode='backup'), dict(cost=35.42)),
    ('3 cheapest day: self_use', dict(WOC, mode='self_use'), dict(cost=34.76)),
    ('3 cheapest day: tou', dict(WOC, mode='tou'), dict(cost=21.64)),
    ('3 tou, 20.48 kWh', dict(WOC, mode='tou', bat_kwh=20.48), dict(cost=21.02)),
    ('3 tou, 5.12 kWh', dict(WOC, mode='tou', bat_kwh=5.12), dict(cost=28.20)),
]


def check():
    """Compare the model with the control tables of lab-hybrid-home §M2, §M6. Returns the number of mismatches."""
    bad = 0
    for i, ((name, kw), exp) in enumerate(zip(CASES, EXPECTED), 1):
        tot, trace = simulate(**kw)
        for k, e in zip(KEYS, exp):
            if abs(tot[k] - e) > TOL.get(k, 0.05) + 1e-9:
                bad += 1
                print('MISMATCH CP%d %s: model %.3f, document %.3f' % (i, k, tot[k], e))
        if i in SOC_TRACES:
            got = [trace[j][5] for j in (0, 72, 144, 216, 252, 287)]
            if any(abs(g - e) > 0.3 for g, e in zip(got, SOC_TRACES[i])):
                bad += 1
                print('MISMATCH CP%d SOC trace: model %s, document %s' % (i, got, SOC_TRACES[i]))
    for name, kw, exp in CHALLENGES:
        tot, _ = simulate(**kw)
        for k, e in exp.items():
            if abs(tot[k] - e) > TOL.get(k, 0.05) + 1e-9:
                bad += 1
                print('MISMATCH challenge «%s» %s: model %.3f, document %.3f' % (name, k, tot[k], e))
    for season, (c_exp, n_exp) in dict(winter=(6.59, 3.20), spring=(4.67, 3.20), summer=(4.67, 3.20)).items():
        c = sum(loads_kw(k * DT_MIN, season, DEFAULT_ON)[0] * H for k in range(STEPS))
        n = sum(loads_kw(k * DT_MIN, season, DEFAULT_ON)[1] * H for k in range(STEPS))
        if abs(c - c_exp) > 0.006 or abs(n - n_exp) > 0.006:
            bad += 1
            print('MISMATCH loads %s: %.3f + %.3f, document %.2f + %.2f' % (season, c, n, c_exp, n_exp))
    # zero-capacity battery (§M5 «Без батареї»): must not crash; island → output off, PV curtailed
    tot, _ = simulate(bat_kwh=0.0, outage='blackout')
    if not (tot['served'] == 0.0 and abs(tot['curt'] - tot['pv']) < 1e-6 and abs(tot['dark_h'] - 24.0) < 1e-6):
        bad += 1
        print('MISMATCH zero-capacity battery in island:', fmt(tot))
    tot, _ = simulate(bat_kwh=0.0, season='summer', weather='clear', outage='none')
    if not (tot['chg'] == 0.0 and tot['dis'] == 0.0 and tot['unserved'] == 0.0 and tot['exp'] > 0.0):
        bad += 1
        print('MISMATCH zero-capacity battery with grid:', fmt(tot))
    print('home_model check: %d control scenarios, %d challenge fixtures, %d mismatches'
          % (len(CASES), len(CHALLENGES), bad))
    return bad


if __name__ == '__main__':
    if '--check' in sys.argv:
        sys.exit(1 if check() else 0)
    for season in SEASONS:
        for w in WEATHER:
            e = sum(pv_kw(k * DT_MIN + DT_MIN / 2, 1.0, season, w) * H for k in range(STEPS))
            print('PV per kWp %s %s: %.2f kWh/day, peak %.2f kW' % (season, w, e, max(
                pv_kw(k * DT_MIN, 1.0, season, w) for k in range(STEPS))))
    for season in SEASONS:
        c = sum(loads_kw(k * DT_MIN, season, DEFAULT_ON)[0] * H for k in range(STEPS))
        n = sum(loads_kw(k * DT_MIN, season, DEFAULT_ON)[1] * H for k in range(STEPS))
        print('loads %s: critical %.2f + noncritical %.2f = %.2f kWh/day (excl. idle 1.2)' % (season, c, n, c + n))
    for name, kw in CASES:
        tot, trace = simulate(**kw)
        print(name)
        print('   ' + fmt(tot))
        print('   SOC@00,06,12,18,21,24h:', [trace[i][5] for i in (0, 72, 144, 216, 252, 287)])
