import math
def eta(P,P0,k1,k2): return P/(P+P0+k1*P+k2*P*P)
for name,(P0,k1,k2) in {"pv":(20,0.012,1.5e-6),"bat":(50,0.02,3e-6)}.items():
    pts={p:eta(p,P0,k1,k2) for p in (60,100,300,600,1200,1800,3000,4000,6000)}
    print(name,{k:round(v*100,2) for k,v in pts.items()})
    Pr=6000; e=lambda f: eta(f*Pr,P0,k1,k2)
    eu=0.03*e(.05)+0.06*e(.1)+0.13*e(.2)+0.10*e(.3)+0.48*e(.5)+0.20*e(1.0)
    pk=math.sqrt(P0/k2); print("  euro %.2f peak at %.0f W = %.2f"%(eu*100,pk,eta(pk,P0,k1,k2)*100))
# PLL
for Kp in (2.0,5.0,10.0):
  th_g=0.0; th_i=math.radians(-90); dt=1e-4; t=0; locked=None
  while t<5:
    err=math.atan2(math.sin(th_g-th_i),math.cos(th_g-th_i))
    f=50+Kp*err
    th_i+=2*math.pi*f*dt; th_g+=2*math.pi*50*dt; t+=dt
    if locked is None and abs(math.degrees(err))<2: locked=t
  print("PLL Kp=%.0f Hz/rad: lock<2deg after %.3f s"%(Kp,locked))
# phasor
V=230; X=2*math.pi*50*3e-3
for P in (1000,3000,6000):
  d=math.asin(P*X/(V*V)); print("P=%d delta=%.2f deg (E=V)"%(P,math.degrees(d)))
# Q with E slightly higher
for E in (230,232,235):
  d=math.asin(3000*X/(V*E)); Q=(V*E*math.cos(d)-V*V)/X; print("E=%d P=3000 delta=%.2f Q=%.0f var"%(E,math.degrees(d),Q))
# boost
for vin,vout in ((250,400),(150,400),(48,400),(300,400)): print("boost %d->%d D=%.3f"%(vin,vout,1-vin/vout))
# LC
for L,C in ((1.5e-3,10e-6),(0.5e-3,5e-6),(3e-3,20e-6),(1e-3,4.7e-6)):
  f0=1/(2*math.pi*math.sqrt(L*C)); print("L=%.1fmH C=%.1fuF f0=%.0f Hz Z0=%.1f ohm att@20k=%.1f dB att@40k=%.1f dB"%(L*1e3,C*1e6,f0,math.sqrt(L/C),20*math.log10(abs(1/(1-(2*math.pi*20000)**2*L*C))),20*math.log10(abs(1/(1-(2*math.pi*40000)**2*L*C)))))
