"""Reference PV model for lab-pv (pure Python, mirrors what the TS builder will code).

Single-diode model without shunt in forward region (explicit V(I)), 3 substrings with bypass diodes.
"""
import math

K_B = 1.380649e-23
Q_E = 1.602176634e-19

# Lab reference module "ЛМ-440" (generic TOPCon, 108 half-cut cells = 54 series-equivalent cells)
REF = dict(Isc=13.90, Voc=39.40, Vmp=33.00, Imp=13.33, Ns=54, nsub=3,
           alpha=0.00045, beta=-0.0025, NMOT=45.0)


def vt(Tc):
    return K_B * (Tc + 273.15) / Q_E


def fit(ref=REF):
    """Find n, Rs, I0 so that Voc, MPP point and dP/dV=0 at MPP match at STC (Iph = Isc)."""
    Iph = ref['Isc']
    Ns = ref['Ns']

    def v_of_i(I, n, Rs):
        a = n * Ns * vt(25.0)
        I0 = Iph / (math.exp(ref['Voc'] / a) - 1)
        return a * math.log((Iph - I) / I0 + 1) - I * Rs

    def dpdi(n, Rs, I):
        h = 1e-5
        return ((I + h) * v_of_i(I + h, n, Rs) - (I - h) * v_of_i(I - h, n, Rs)) / (2 * h)

    # 2D Newton on (n, Rs): f1 = V(Imp)-Vmp, f2 = dP/dI at Imp
    n, Rs = 1.1, 0.2
    for _ in range(100):
        f1 = v_of_i(ref['Imp'], n, Rs) - ref['Vmp']
        f2 = dpdi(n, Rs, ref['Imp'])
        e = 1e-6
        j11 = (v_of_i(ref['Imp'], n + e, Rs) - ref['Vmp'] - f1) / e
        j12 = (v_of_i(ref['Imp'], n, Rs + e) - ref['Vmp'] - f1) / e
        j21 = (dpdi(n + e, Rs, ref['Imp']) - f2) / e
        j22 = (dpdi(n, Rs + e, ref['Imp']) - f2) / e
        det = j11 * j22 - j12 * j21
        dn = (f1 * j22 - f2 * j12) / det
        dR = (j11 * f2 - j21 * f1) / det
        n -= dn
        Rs -= dR
        if abs(dn) < 1e-12 and abs(dR) < 1e-12:
            break
    a = n * Ns * vt(25.0)
    I0 = Iph / (math.exp(ref['Voc'] / a) - 1)
    return n, Rs, I0


N_FIT, RS_FIT = 1.0, 0.1477  # n fixed at 1.0 (physical); Rs fitted so that Pmp(STC)=439.9 W
I0_FIT = REF['Isc'] / (math.exp(REF['Voc'] / (N_FIT * REF['Ns'] * vt(25.0))) - 1)


def cell_temp(G, Tamb, ref=REF):
    return Tamb + (ref['NMOT'] - 20.0) / 800.0 * G


def sub_params(G, Tc, ref=REF):
    """Parameters of ONE substring (Ns/nsub cells) at irradiance G [W/m2], cell temp Tc [C]."""
    Iph = ref['Isc'] * (G / 1000.0) * (1 + ref['alpha'] * (Tc - 25.0))
    ns = ref['Ns'] / ref['nsub']
    a = N_FIT * ns * vt(Tc)
    # I0(T) chosen so that Voc at 1000 W/m2 follows datasheet beta exactly
    voc_sub_T = ref['Voc'] / ref['nsub'] * (1 + ref['beta'] * (Tc - 25.0))
    iph_1000 = ref['Isc'] * (1 + ref['alpha'] * (Tc - 25.0))
    I0 = iph_1000 / (math.exp(voc_sub_T / a) - 1)
    Rs = RS_FIT / ref['nsub']
    return Iph, I0, a, Rs


RSH_SUB = 18 * 30.0   # ohm, reverse-branch shunt of a substring (30 ohm per cell, illustrative)
V_BYPASS = 0.4        # V, Schottky bypass diode forward drop


def v_sub(I, p, bypass=True):
    Iph, I0, a, Rs = p
    if I < Iph:
        v = a * math.log((Iph - I) / I0 + 1) - I * Rs
    else:
        v = -(I - Iph) * RSH_SUB - I * Rs
    if bypass:
        v = max(v, -V_BYPASS)
    return v


def module_iv(Gs, Tc, bypass=True, npts=600, n_modules=1):
    """Gs: list of 3 substring irradiances. Returns list of (V, I, P) for a string of n identical modules."""
    ps = [sub_params(G, Tc) for G in Gs]
    Imax = max(p[0] for p in ps)
    pts = []
    for k in range(npts + 1):
        I = Imax * k / npts
        V = n_modules * sum(v_sub(I, p, bypass) for p in ps)
        if V < 0:
            break
        pts.append((V, I, V * I))
    return pts


def mpp(pts):
    return max(pts, key=lambda t: t[2])


def local_maxima(pts):
    out = []
    for i in range(1, len(pts) - 1):
        if pts[i][2] > pts[i - 1][2] and pts[i][2] >= pts[i + 1][2]:
            out.append(pts[i])
    return out


def voc(Gs, Tc):
    ps = [sub_params(G, Tc) for G in Gs]
    return sum(v_sub(0.0, p) for p in ps)


if __name__ == '__main__':
    print('fit n=%.4f Rs=%.4f ohm I0=%.4e A' % (N_FIT, RS_FIT, I0_FIT))
    def rep(label, Gs, Tc, bypass=True):
        pts = module_iv(Gs, Tc, bypass, npts=4000)
        V, I, P = mpp(pts)
        isc = pts[-1][1] if pts[-1][0] < 0.5 else None
        print('%-38s Voc=%6.2f V  Isc~%5.2f A  Vmp=%6.2f Imp=%6.2f Pmp=%6.1f W  FF=%.3f peaks=%s' % (
            label, voc(Gs, Tc), max(p[1] for p in pts), V, I, P,
            P / (voc(Gs, Tc) * max(p[1] for p in pts)),
            [round(p[2], 1) for p in local_maxima(pts)]))
    rep('STC 1000/25', [1000] * 3, 25)
    rep('800 W/m2, 25C', [800] * 3, 25)
    rep('500 W/m2, 25C', [500] * 3, 25)
    rep('200 W/m2, 25C', [200] * 3, 25)
    rep('1000, 50C', [1000] * 3, 50)
    rep('1000, 65C', [1000] * 3, 65)
    rep('1000, -10C', [1000] * 3, -10)
    rep('1000, 0C', [1000] * 3, 0)
    rep('NMOT 800/Tamb20 -> Tc=45', [800] * 3, 45)
    rep('1 substring 50% shaded (bypass)', [1000, 1000, 500], 25)
    rep('1 substring 50% shaded (NO bypass)', [1000, 1000, 500], 25, bypass=False)
    rep('1 substring 10% (bypass)', [1000, 1000, 100], 25)
    rep('1 substring 10% (NO bypass)', [1000, 1000, 100], 25, bypass=False)
    rep('2 substr 30% (bypass)', [1000, 300, 300], 25)
    # Temperature coefficient check
    p25 = mpp(module_iv([1000] * 3, 25, npts=4000))[2]
    p65 = mpp(module_iv([1000] * 3, 65, npts=4000))[2]
    print('gamma Pmax = %.3f %%/C' % ((p65 / p25 - 1) / 40 * 100))
    # Hot-spot: shaded substring dissipation in a string of 10 modules at the string MPP (no bypass vs bypass)
    for bp in (True, False):
        ps_ok = sub_params(1000, 25)
        ps_sh = sub_params(100, 25)
        # string: 10 modules, module 1 has one substring at 100 W/m2
        def string_v(I):
            v = 9 * 3 * v_sub(I, ps_ok, bp) + 2 * v_sub(I, ps_ok, bp) + v_sub(I, ps_sh, bp)
            return v
        best = max(((string_v(I) * I, I) for I in [13.9 * k / 4000 for k in range(4001)] if string_v(I) > 0))
        I = best[1]
        print('string10 bypass=%s Pmp=%.0f W at I=%.2f A, shaded substring V=%.2f V, P_diss=%.1f W' % (
            bp, best[0], I, v_sub(I, ps_sh, bp), -v_sub(I, ps_sh, bp) * I))
