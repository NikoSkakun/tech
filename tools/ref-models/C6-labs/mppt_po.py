from pv_model import *
def curve(Gs,Tc): 
    pts=module_iv(Gs,Tc,npts=600)
    return sorted(pts)  # by V ascending
def i_at(pts,V):
    if V<=pts[0][0]: return pts[0][1]
    for (v0,i0,_),(v1,i1,_) in zip(pts,pts[1:]):
        if v0<=V<=v1:
            return i0+(V-v0)/(v1-v0)*(i1-i0) if v1>v0 else i0
    return 0.0
def po(Gs,Tc,V0=None,dV=0.5,iters=60):
    pts=curve(Gs,Tc); voc_=pts[-1][0]
    V=V0 if V0 else 0.8*voc_; d=-1; Pprev=V*i_at(pts,V); hist=[]
    for k in range(iters):
        V+=d*dV; P=V*i_at(pts,V)
        if P<Pprev: d=-d
        Pprev=P; hist.append((round(V,2),round(P,1)))
    return hist
def scan(Gs,Tc,n=40):
    pts=curve(Gs,Tc); voc_=pts[-1][0]
    best=max(((v*i_at(pts,v),v) for v in [voc_*(0.1+0.85*k/n) for k in range(n+1)]))
    return best
h=po([1000]*3,25); print("STC P&O from 0.8Voc:",h[:3],"... last",h[-4:])
h=po([1000,1000,500],25); print("shade P&O:",h[:3],"... last",h[-4:])
print("scan shade:",scan([1000,1000,500],25))
h=po([1000,1000,500],25,V0=scan([1000,1000,500],25)[1]); print("after scan P&O last",h[-4:])
