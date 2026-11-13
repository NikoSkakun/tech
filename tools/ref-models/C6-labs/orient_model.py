"""Orientation / annual-yield model for Kyiv (lab-pv step 'orientation').

Hourly loop over a 365-day year:
  - sun position (Cooper declination, equation of time ignored, solar time)
  - monthly horizontal irradiation H_h and diffuse ratio Kd from PVGIS (Kyiv, 2018-2020 avg)
  - hourly GHI distributed proportional to cos(zenith) within each day (sum = H_h/day)
  - beam/diffuse split by Kd, isotropic sky + ground albedo 0.2
  - incidence-angle loss ASHRAE b0=0.05, temperature derate gamma=-0.30 %/C
Normalised so that the optimum equals PVGIS 1114 kWh/kWp (14 % system loss).
"""
import math

LAT = 50.45
H_H = [24.64, 41.89, 85.30, 147.18, 161.67, 192.08, 174.08, 171.39, 116.54, 68.66, 25.20, 17.24]
KD = [0.69, 0.64, 0.50, 0.39, 0.48, 0.40, 0.48, 0.37, 0.39, 0.49, 0.68, 0.72]
TAMB = [-2.1, -0.8, 2.5, 10.6, 16.1, 22.1, 20.8, 21.4, 16.7, 11.1, 3.0, 0.2]
DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
ALBEDO = 0.2
GAMMA = -0.0030


def sun(doy, hour, lat=LAT):
    decl = math.radians(23.45) * math.sin(2 * math.pi * (284 + doy) / 365)
    ha = math.radians(15 * (hour - 12))
    phi = math.radians(lat)
    cz = math.sin(phi) * math.sin(decl) + math.cos(phi) * math.cos(decl) * math.cos(ha)
    cz = max(-1, min(1, cz))
    zen = math.acos(cz)
    # azimuth measured from south, positive to the west
    sa = math.cos(decl) * math.sin(ha) / max(1e-9, math.sin(zen))
    ca = (math.sin(phi) * cz - math.sin(decl)) / max(1e-9, math.cos(phi) * math.sin(zen))
    az = math.atan2(sa, ca)
    return zen, az


def raw_yield(tilt, azim, monthly=False):
    """tilt [deg], azim [deg] from south (+west, -east). Returns un-normalised relative energy."""
    b = math.radians(tilt)
    g = math.radians(azim)
    total = 0.0
    months = []
    doy = 0
    for m in range(12):
        em = 0.0
        for d in range(DAYS[m]):
            doy += 1
            hours = [h + 0.5 for h in range(24)]
            cz = []
            for h in hours:
                z, a = sun(doy, h)
                cz.append((max(0.0, math.cos(z)), z, a))
            s = sum(c[0] for c in cz)
            if s <= 0:
                continue
            Hday = H_H[m] / DAYS[m] * 1000.0  # Wh/m2 per day
            for c, z, a in cz:
                if c <= 0.02:
                    continue
                ghi = Hday * c / s
                dhi = KD[m] * ghi
                bhi = ghi - dhi
                dni = bhi / c
                cos_i = math.cos(z) * math.cos(b) + math.sin(z) * math.sin(b) * math.cos(a - g)
                cos_i = max(0.0, cos_i)
                iam = max(0.0, 1 - 0.05 * (1 / max(cos_i, 1e-3) - 1)) if cos_i > 0 else 0.0
                poa = dni * cos_i * iam + dhi * (1 + math.cos(b)) / 2 * 0.95 + ghi * ALBEDO * (1 - math.cos(b)) / 2 * 0.95
                tc = TAMB[m] + 0.03 * poa  # rough instantaneous cell temperature (poa in W/m2 for 1 h)
                em += poa * (1 + GAMMA * (tc - 25))
        months.append(em)
        total += em
    return (total, months) if monthly else total


if __name__ == '__main__':
    best = max(((raw_yield(t, 0), t) for t in range(20, 56, 1)))
    k = 1114.0 / best[0]
    print('optimum tilt (az 0) = %d deg' % best[1])
    def Y(t, a):
        return raw_yield(t, a) * k
    checks = [((37, 0), 1114), ((0, 0), 938), ((90, 0), 775), ((37, -90), 875), ((37, 180), 547)]
    for (t, a), ref in checks:
        y = Y(t, a)
        print('tilt %2d az %4d: model %6.0f  PVGIS %5d  diff %+5.1f %%' % (t, a, y, ref, (y / ref - 1) * 100))
    tilts = [0, 15, 30, 37, 45, 60, 75, 90]
    azs = [0, 45, 90, 135, 180]
    print('table kWh/kWp/yr; rows tilt, cols az ' + str(azs))
    for t in tilts:
        print(t, [round(Y(t, a)) for a in azs])
    tot, mon = raw_yield(37, 0, monthly=True)
    print('monthly kWh/kWp at 37/0:', [round(x * k / 1, 1) for x in mon])
