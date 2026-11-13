import re,sys
for fn in sys.argv[1:]:
    step=None; over=0; n=0; mx=0
    for line in open(fn,encoding="utf-8"):
        m=re.match(r"### (\d+)\. `([^`]+)`",line)
        if m: step=m.group(2)
        m=re.match(r"\s+- \*\*С(\d)\.\*\* «(.*)»\s*$",line)
        if m:
            t=re.sub(r"\*\*|`|_","",m.group(2)); L=len(t); n+=1; mx=max(mx,L)
            if L>450: over+=1; print(fn.split("/")[-1],step,"С"+m.group(1),L)
    print(fn.split("/")[-1],"pages",n,"max",mx,"over",over)
