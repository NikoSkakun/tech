"""Reference inverter waveform model for lab-inverter: square, quasi-square, SPWM (bipolar/unipolar),
LC filter, THD. Pure Python radix-2 FFT."""
import cmath
import math

F1 = 50.0
N = 1 << 16              # samples per fundamental period -> fs = 3.2768 MHz
FS = F1 * N


def fft(x):
    n = len(x)
    if n == 1:
        return [complex(x[0])]
    a = list(map(complex, x))
    j = 0
    for i in range(1, n):
        bit = n >> 1
        while j & bit:
            j ^= bit
            bit >>= 1
        j ^= bit
        if i < j:
            a[i], a[j] = a[j], a[i]
    length = 2
    while length <= n:
        w = cmath.exp(-2j * math.pi / length)
        for i in range(0, n, length):
            wk = 1
            half = length // 2
            for k in range(half):
                u = a[i + k]
                v = a[i + k + half] * wk
                a[i + k] = u + v
                a[i + k + half] = u - v
                wk *= w
        length <<= 1
    return a


def tri(t, fc):
    """triangle carrier in [-1, 1], starting at -1 for t=0"""
    ph = (t * fc) % 1.0
    return 4 * ph - 1 if ph < 0.5 else 3 - 4 * ph


def wave(kind, vdc=400.0, ma=0.8125, fc=20000.0, alpha_deg=30.0, dead_us=0.0):
    out = []
    for i in range(N):
        t = i / FS
        th = 2 * math.pi * F1 * t
        s = math.sin(th)
        if kind == 'square':
            v = vdc if s >= 0 else -vdc
        elif kind == 'quasi':
            # zero for alpha around each zero crossing (alpha_deg = half of zero gap)
            deg = math.degrees(th) % 360
            a = alpha_deg
            if a <= deg <= 180 - a:
                v = vdc
            elif 180 + a <= deg <= 360 - a:
                v = -vdc
            else:
                v = 0.0
        elif kind == 'spwm_bi':
            v = vdc if ma * s >= tri(t, fc) else -vdc
        elif kind == 'spwm_uni':
            c = tri(t, fc)
            va = 1 if ma * s >= c else 0
            vb = 1 if -ma * s >= c else 0
            v = vdc * (va - vb)
        out.append(v)
    return out


def spectrum(x):
    X = fft(x)
    # one-sided amplitude per harmonic h: |X[h]|*2/N
    return X


def harmonics_amp(X, hmax):
    return [abs(X[h]) * 2 / N for h in range(hmax + 1)]


def thd(X, hmax=None):
    if hmax is None:
        hmax = N // 2 - 1
    v1 = abs(X[1])
    s = sum(abs(X[h]) ** 2 for h in range(2, hmax + 1))
    return math.sqrt(s) / v1


def lc_filter(X, L, C, R):
    Y = list(X)
    for h in range(1, N // 2):
        w = 2 * math.pi * F1 * h
        H = 1 / (1 - w * w * L * C + 1j * w * L / R)
        Y[h] = X[h] * H
        Y[N - h] = X[N - h] * H.conjugate()
    Y[0] = X[0]
    return Y


def rms_fund(X):
    return abs(X[1]) * 2 / N / math.sqrt(2)


if __name__ == '__main__':
    L, C, R = 1.5e-3, 10e-6, 230.0 ** 2 / 2000.0
    print('LC f0 = %.0f Hz, R=%.2f ohm' % (1 / (2 * math.pi * math.sqrt(L * C)), R))
    cases = [
        ('square 325', dict(kind='square', vdc=325.0)),
        ('quasi a=30 (120deg pulse) Vdc=400', dict(kind='quasi', vdc=400.0, alpha_deg=30.0)),
        ('quasi a=45 Vdc=325', dict(kind='quasi', vdc=325.0, alpha_deg=45.0)),
        ('spwm_bi fc=20k ma=0.8125', dict(kind='spwm_bi')),
        ('spwm_uni fc=20k ma=0.8125', dict(kind='spwm_uni')),
        ('spwm_uni fc=20k ma=0.5', dict(kind='spwm_uni', ma=0.5)),
        ('spwm_uni fc=20k ma=1.0', dict(kind='spwm_uni', ma=1.0)),
        ('spwm_uni fc=2k ma=0.8125', dict(kind='spwm_uni', fc=2000.0)),
        ('spwm_bi fc=2k ma=0.8125', dict(kind='spwm_bi', fc=2000.0)),
        ('spwm_uni fc=5k', dict(kind='spwm_uni', fc=5000.0)),
        ('spwm_uni fc=10k', dict(kind='spwm_uni', fc=10000.0)),
        ('spwm_bi fc=10k', dict(kind='spwm_bi', fc=10000.0)),
    ]
    for name, kw in cases:
        x = wave(**kw)
        X = spectrum(x)
        vrms_total = math.sqrt(sum(v * v for v in x) / N)
        Y = lc_filter(X, L, C, R)
        print('%-36s V1rms=%6.1f Vrms=%6.1f THD_all=%6.1f%% THD_50=%5.2f%% | after LC: V1rms=%6.1f THD_all=%5.2f%% THD_50=%5.2f%%' % (
            name, rms_fund(X), vrms_total, thd(X) * 100, thd(X, 50) * 100,
            rms_fund(Y), thd(Y) * 100, thd(Y, 50) * 100))
        if name.startswith('quasi a=30') or name.startswith('square'):
            amps = harmonics_amp(X, 11)
            print('   harmonics rel:', [round(amps[h] / amps[1], 3) for h in (1, 3, 5, 7, 9, 11)])
