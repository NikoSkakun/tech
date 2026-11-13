"""Rankine constants of plants.md M2 recomputed with IAPWS-IF97 (package `iapws`).

Run on lenovo:  /srv/electricity/venv/bin/python app/src/volumes/electricity/sim/plants/tools/rankine_iapws.py
Prints the JSON that is copied into `../rankine.ts` (RANKINE_IAPWS).

Cycle: live steam 16 MPa, condenser 30 °C (4,247 kPa), turbine isentropic efficiency 0,88, pump 0,80, reheat at
3,5 MPa to 540 °C, no regeneration, before boiler losses and auxiliaries. «No condenser»: exhaust at 1 bar,
make-up water at 15 °C and 1 atm.
"""
import json

from iapws import IAPWS97 as W

P_HI, P_RH, T_RH, T_C = 16.0, 3.5, 540.0, 30.0


def cycle(t_live=None, reheat=False, eta_t=0.88, eta_p=0.80, p_exh=None, t_feed=None):
    cond = W(T=T_C + 273.15, x=0) if p_exh is None else W(P=p_exh, x=0)
    pc = cond.P
    feed = cond if t_feed is None else W(T=t_feed + 273.15, P=0.101325)
    wp = feed.v * (P_HI - feed.P) * 1000 / eta_p
    h2 = feed.h + wp
    live = W(P=P_HI, x=1) if t_live is None else W(P=P_HI, T=t_live + 273.15)
    q_in = live.h - h2
    w_t = 0.0
    h_start, s_start = live.h, live.s
    if reheat:
        h_a = live.h - eta_t * (live.h - W(P=P_RH, s=live.s).h)
        w_t += live.h - h_a
        rh = W(P=P_RH, T=T_RH + 273.15)
        q_in += rh.h - h_a
        h_start, s_start = rh.h, rh.s
    h_out = h_start - eta_t * (h_start - W(P=pc, s=s_start).h)
    w_t += h_start - h_out
    out = W(P=pc, h=h_out)
    x = out.x if out.region == 4 else 1.0
    return {"eta": (w_t - wp) / q_in, "moisture": 1 - x, "turbineKJkg": w_t, "pumpKJkg": wp}


def config(t_live, reheat):
    real = cycle(t_live, reheat)
    ideal = cycle(t_live, reheat, eta_t=1.0, eta_p=1.0)
    nocond = cycle(t_live, reheat, p_exh=0.1, t_feed=15.0)
    return {
        "eta": round(real["eta"], 4),
        "moisture": round(real["moisture"], 4),
        "turbineKJkg": round(real["turbineKJkg"], 1),
        "pumpKJkg": round(real["pumpKJkg"], 2),
        "etaIdeal": round(ideal["eta"], 4),
        "noCondenserEta": round(nocond["eta"], 4),
        "noCondenserFactor": round(nocond["eta"] / real["eta"], 3),
    }


if __name__ == "__main__":
    print(json.dumps({
        "saturated": config(None, False),
        "superheat": config(540.0, False),
        "reheat": config(540.0, True),
        "saturationTempC": round(W(P=P_HI, x=1).T - 273.15, 2),
        "condenserKPa": round(W(T=T_C + 273.15, x=0).P * 1000, 3),
    }, indent=1))
