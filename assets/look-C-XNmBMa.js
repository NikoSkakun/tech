import{A as e,Dt as t,Et as n,F as r,G as i,K as a,L as o,P as s,Y as c,bt as l,dt as u,h as d,it as f,p,pt as m,tt as h,ut as g,v as _,vt as v}from"./three-DWXlCPAH.js";import{u as y}from"./environment-BnkkY2XI.js";import{l as b}from"./palette-DZS2tKC3.js";import{t as x}from"./text3d-DD8R4f1P.js";import"./api-CvH05dcR.js";import{a as S,r as C}from"./tween-BOlNBNwa.js";import{t as w}from"./style-D10H0tay.js";import{Ct as T,Tt as E,wt as D}from"./fx-CzsNEQGv.js";import"./text-CE9mnjCq.js";var O=3.2,k=O/Math.SQRT2,A=1/6,j=1.52,M=.085,N=4.5*O;function ee(){let e=[];for(let t=0;t<4;t++){let r=t%2==1?O/2:0,i=7+Math.ceil(t*1.5),a=4+t;for(let o=-a;o<=a;o++)for(let a=-i;a<=i;a++){let i=a*O+r,s=o*O+r;if(s>14.4-(t>0?1.2:0))continue;let c=Math.abs(a),l=Math.abs(o),u=t>0?1e3*t+Math.max(c,l):c<=2&&l<=1?l*100+c*4+(a>0?0:2)+(o>0?0:1):400+Math.max(c,l)*40+l;e.push({p:new n(i,s,-t*k),plane:t,i:a,j:o,rank:u})}}return e.sort((e,t)=>e.rank-t.rank)}var P=e=>Math.min(Math.max(e,0),1),F=(e,t,n)=>{let r=P((n-e)/(t-e));return r*r*(3-2*r)},I=(e,t,n)=>e+(t-e)*n,te=`
varying vec3 vN;
varying vec3 vP;   // position in the frame of the copper world (before the dive's scaling of the lattice)
varying float vAlong; // along the wire, in the core's own units (they grow with it)
uniform mat4 uToCopper;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = (uToCopper * w).xyz;
  vN = normalize(normal);
  vAlong = position.x;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,L=(O/1).toFixed(4),ne=`
uniform mat4 projectionMatrix;
uniform mat4 uFromCopper;
uniform vec3 uEye;       // the camera in the frame of the copper world
// metal: the upper edge, lit, half-tone, shade, glint — each [handed over · lamp off, on; inside · lamp off, on]
uniform vec3 uTop[4];
uniform vec3 uLit[4];
uniform vec3 uMid[4];
uniform vec3 uShade[4];
uniform vec3 uGlint[4];
uniform vec3 uRim[4];   // the very top edge, where the stand's rim light shows
uniform float uWarmth; // 0 = as handed over by the stand … 1 = inside
uniform vec3 uAtom;
uniform vec3 uAtomShade;
uniform vec3 uDeep;
uniform vec3 uWarm;
uniform vec3 uCool;
uniform float uLamp;
uniform float uDots;   // 0…1 dots showing in the metal
uniform float uBalls;  // 0…1 metal → balls in the dark
uniform float uOpen;   // 0…1 the flat picture opens between the balls
uniform float uPitch;  // lattice pitch, in copper-world units
uniform float uFade;
uniform float uKTime;
varying vec3 vN;
varying vec3 vP;
varying float vAlong;

float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

vec3 pick(vec3 c[4], float lamp, float w) { return mix(mix(c[0], c[1], lamp), mix(c[2], c[3], lamp), w); }

// where the line of sight through this fragment meets the plane z = const of the copper world
vec3 onPlane(float z) {
  vec3 d = vP - uEye;
  return uEye + d * ((z - uEye.z) / d.z);
}

// one plane of the lattice as discs shaded like the atoms: lit cap, shaded underside
vec4 plane(vec2 cellPos, float fw, vec3 L, float soft) {
  vec2 c = fract(cellPos + 0.5) - 0.5;
  float r = length(c) * ${L};
  float mask = 1.0 - smoothstep(1.0 - max(2.5 * fw, soft), 1.0, r);
  vec3 n = vec3(c * ${L}, sqrt(max(1.0 - r * r, 0.0)));
  vec3 col = mix(uAtomShade, uAtom, smoothstep(-0.45, 0.4, n.y));
  // the same two-band light as the real atoms: lit from above, the underside in indigo shade
  col *= mix(vec3(0.42, 0.4, 0.74), vec3(1.0), smoothstep(-0.1, 0.14, dot(n, L)));
  return vec4(col, mask);
}

// a soft elliptical glint of the stand's lamp: centre along the wire and in n.y, half-sizes, strength
float glint(float x, float ny, vec4 e, float strength) {
  vec2 q = vec2((x - e.x) / e.z, (ny - e.y) / e.w);
  return strength * (1.0 - smoothstep(0.55, 1.0, dot(q, q)));
}

void main() {
  float dither = ign(gl_FragCoord.xy + fract(uKTime) * 37.0) * 0.998 + 0.001;
  if (uFade < 0.999 && uFade <= dither) discard;
  vec3 n = normalize(vN);
  float lamp = clamp(uLamp, 0.0, 1.0);
  // Two measured looks of the same wire (core.ts): «as handed over» — under the stand's own light at the moment
  // of the dissolve, a lit top third over dark red-brown — and «inside», under the light of this floor, a
  // brighter three-band copper. uWarmth goes from the first to the second as the dive leaves the stand.
  float w = uWarmth;
  float lit = smoothstep(mix(0.19, -0.12, w), mix(0.29, 0.36, w), n.y);
  float shade = 1.0 - smoothstep(mix(-0.13, -0.45, w), mix(-0.04, -0.35, w), n.y);
  vec3 metal = mix(pick(uMid, lamp, w), pick(uLit, lamp, w), lit);
  metal = mix(metal, pick(uTop, lamp, w), smoothstep(0.22, 0.95, n.y));
  metal = mix(metal, pick(uShade, lamp, w), shade);
  metal = mix(metal, pick(uRim, lamp, w), smoothstep(0.7, 0.97, n.y));
  // the lamp's soft glints (and, inside, the room's cool one far left); they breathe a little
  float breathe = 0.94 + 0.06 * sin(uKTime * 1.3);
  float handed = lamp * (glint(vAlong, n.y, vec4(3.9, 0.72, 1.7, 0.05), 0.8)
                       + glint(vAlong, n.y, vec4(-1.3, 0.62, 2.6, 0.04), 0.3));
  float inside = lamp * (glint(vAlong, n.y, vec4(5.05, 0.5, 2.9, 0.075), 1.0)
                       + glint(vAlong, n.y, vec4(7.4, 0.72, 1.5, 0.05), 0.9)
                       + glint(vAlong, n.y, vec4(1.2, 0.63, 2.2, 0.04), 0.3))
               + (1.0 - lamp) * glint(vAlong, n.y, vec4(-6.4, 0.5, 3.6, 0.05), 0.8);
  metal = mix(metal, pick(uGlint, lamp, w), min(mix(handed, inside, w) * breathe, 1.0));

  // the lattice: the focal plane and, in its gaps, the plane behind it — each where the eye will find it
  vec3 L = normalize(vec3(mix(-0.4, 0.42, lamp), 0.82, 0.5));
  vec3 lightCol = mix(vec3(0.62, 0.74, 0.98) * 0.78, vec3(1.0, 0.96, 0.86), lamp);
  float s = uPitch / ${O.toFixed(4)};
  vec2 cell0 = onPlane(0.0).xy / uPitch;
  vec2 cell1 = onPlane(-${k.toFixed(4)} * s).xy / uPitch + 0.5;
  float fw = max(fwidth(cell0.x), fwidth(cell0.y)) * ${L};
  vec4 front = plane(cell0, fw, L, 0.0);
  vec4 back = plane(cell1, fw, L, 0.3 * uBalls); // the plane behind is out of focus once it is a plane
  // stage 1: in the metal — lighter dots, the plane behind as a fainter print
  vec3 inMetal = mix(metal * 0.86, metal * 0.95, back.a);
  inMetal = mix(inMetal, metal * 1.1 + vec3(0.03, 0.0, 0.0), front.a);
  // stage 2: balls in the dark — the dark is what the veils of backdrop.ts will show there (the lamp's light
  // from above included), the plane behind as it will look through one veil: nothing jumps when it opens
  vec3 ray = normalize(vP - uEye);
  float glow = smoothstep(-0.3, 0.34, ray.y * 0.92 + ray.x * mix(-0.45, 0.45, lamp) * 0.5);
  vec3 dark = uDeep + mix(uCool * 0.3, uWarm * 0.72, lamp) * glow * glow * 0.32;
  vec3 inDark = mix(dark, mix(dark, back.rgb * lightCol * 0.8, 0.42), back.a);
  inDark = mix(inDark, front.rgb * lightCol, front.a);
  vec3 rows = mix(inMetal, inDark, uBalls);
  // too small to be told apart (a phone, the first moment): plain metal
  float seen = uDots * smoothstep(0.7, 0.35, fw);
  vec3 col = mix(metal, rows, seen);
  // stage 3: between the balls the picture opens (the flat front balls stay: the real ones stand before them)
  float gone = mix(uOpen * 1.6, (uOpen - 0.6) * 2.5, front.a * seen);
  if (uOpen > 0.001 && (uOpen >= 0.999 || gone > dither)) discard;
  gl_FragColor = vec4(col, 1.0);
  // once it is a picture of balls it lies just behind the real front atoms (and before everything else)
  vec4 clip = projectionMatrix * viewMatrix * uFromCopper * vec4(onPlane(-0.8 * s), 1.0);
  gl_FragDepth = uBalls > 0.001 ? clip.z / clip.w * 0.5 + 0.5 : gl_FragCoord.z;
}`,R=6.1,z=19.7,B={handed:{top:[[169,75,32],[222,93,36]],lit:[[167,74,29],[200,86,34]],mid:[[167,74,29],[177,76,31]],shade:[[167,74,29],[171,74,30]],glint:[[167,74,29],[243,130,80]],rim:[[182,84,78],[222,104,112]]},inside:{rim:[[200,110,76],[255,158,90]],top:[[200,110,76],[255,158,90]],lit:[[210,104,48],[254,135,47]],mid:[[154,70,34],[188,79,32]],shade:[[110,42,24],[130,46,22]],glint:[[250,190,170],[255,176,118]]}};function re(){let t=new e;t.name=`wire-core`;let r=new _(R,R,600,128,1,!0);r.rotateZ(Math.PI/2);let o=e=>[...B.handed[e],...B.inside[e]].map(([e,t,n])=>new d().setRGB(e/255,t/255,n/255,u)),s=new m({vertexShader:te,fragmentShader:ne,uniforms:{uTop:{value:o(`top`)},uLit:{value:o(`lit`)},uMid:{value:o(`mid`)},uShade:{value:o(`shade`)},uGlint:{value:o(`glint`)},uRim:{value:o(`rim`)},uWarmth:{value:0},uAtom:{value:b(`coral`)},uAtomShade:{value:b(`coral.dark`)},uDeep:{value:b(`bg.deep`).lerp(b(`bg.indigo`),.35)},uWarm:{value:b(`yellow.light`).lerp(b(`amber`),.25)},uCool:{value:b(`sky`)},uLamp:{value:0},uDots:{value:0},uBalls:{value:0},uOpen:{value:0},uPitch:{value:O},uFade:{value:1},uEye:{value:new n(0,0,z)},uToCopper:{value:new i},uFromCopper:{value:new i},uKTime:y.uKTime}}),c=new a(r,s);c.name=`wire-core-metal`,c.frustumCulled=!1,t.add(c);let l=s.uniforms,f={group:t,scale:1,surface:.35,dots:0,balls:0,open:0,latticeScale:1,fade:1,lamp:0,warmth:0,eye:l.uEye.value,update(e){t.visible=f.fade>.004&&f.open<.999,t.visible&&(t.scale.setScalar(f.scale),t.position.set(0,0,f.surface-R*f.scale),l.uFromCopper.value.copy(e),l.uToCopper.value.copy(e).invert(),l.uDots.value=f.dots,l.uBalls.value=f.balls,l.uOpen.value=f.open,l.uPitch.value=O*f.latticeScale,l.uFade.value=f.fade,l.uLamp.value=f.lamp,l.uWarmth.value=f.warmth)}};return f}var V=z,H=(e,t,n)=>({position:[e[0]+t[0],e[1]+t[1],e[2]+t[2]],target:e,fit:n}),U={core:H([0,0,0],[0,0,V],4.6),rows:H([0,0,0],[0,2.4,V],4.6),atom:H([0,0,0],[0,1.5,V],5.4),apart:H([-2.6,0,0],[0,1.5,V],4.8),one:H([0,0,0],[0,.9,V*.5],2.4),pair:H([O/2,0,0],[0,1.1,V*.62],3.6),row:H([0,0,0],[0,1.8,V],7.8),piece:H([0,0,0],[0,2.2,V*1.06],7.8),gate:H([-.6,0,0],[0,2.4,V],6.4),edge:H([0,N+.4,0],[0,1.6,V],4.8),plastic:H([0,N+8.6,0],[0,1.6,V],4.8)},ie=-4.8;function ae(e,t=``){e.updateWorldMatrix(!0,!1);let r=e.matrixWorld.getMaxScaleOnAxis(),i=t=>new n(...t).applyMatrix4(e.matrixWorld).toArray(),a=new n(0,1,0).transformDirection(e.matrixWorld).y<.998;return Object.fromEntries(Object.entries(U).map(([e,n])=>[t+e,{position:i(n.position),target:i(n.target),fov:27,fit:{center:i(n.target),radius:n.fit*r},orbit:{azimuth:a?.03:.3,polar:.16,zoom:[.8,1.25]},drift:a?.4:1}]))}var oe=`
uniform float uReach;
varying vec2 vUv;
void main() {
  vUv = position.xy * 2.0 * uReach;
  float scale = length(modelMatrix[0].xyz);
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * 2.0 * uReach * scale;
  gl_Position = projectionMatrix * mv;
}`,se=`
uniform vec3 uColor;
uniform vec4 uRadii;
uniform float uFade;
uniform float uOuter;
uniform float uKTime;
varying vec2 vUv;
float band(float r, float at, float width) {
  float d = (r - at) / width;
  return exp(-d * d);
}
void main() {
  float r = length(vUv);
  float a = atan(vUv.y, vUv.x);
  // each layer breathes a little and is never evenly bright all the way round
  float w1 = 0.82 + 0.18 * sin(a * 2.0 + uKTime * 0.31);
  float w2 = 0.82 + 0.18 * sin(a * 3.0 - uKTime * 0.23 + 1.7);
  float w3 = 0.82 + 0.18 * sin(a * 2.0 + uKTime * 0.17 + 4.1);
  float g = band(r, uRadii.x, 0.085) * 0.34 * w1
          + band(r, uRadii.y, 0.1) * 0.25 * w2
          + band(r, uRadii.z, 0.12) * 0.2 * w3
          + band(r, uRadii.w, 0.2) * 0.06 * uOuter;
  // a faint fill inside the ion core ties the layers into one body
  g += 0.045 * (1.0 - smoothstep(uRadii.z * 0.6, uRadii.z * 1.25, r));
  if (g * uFade < 0.002) discard;
  gl_FragColor = vec4(uColor * g * uFade, 0.0);
}`;function ce(e){let n=e[3]*1.35,r=new m({vertexShader:oe,fragmentShader:se,uniforms:{uColor:{value:b(`cyan`).lerp(b(`cyan.dark`),.35)},uRadii:{value:new t(...e)},uReach:{value:n},uFade:{value:1},uOuter:{value:1},uKTime:y.uKTime},transparent:!0,depthWrite:!1,blending:2,premultipliedAlpha:!0}),i=new a(new h(1,1),r);return i.name=`atom-shells`,i.frustumCulled=!1,i.renderOrder=2,{mesh:i,get fade(){return r.uniforms.uFade.value},set fade(e){r.uniforms.uFade.value=e,i.visible=e>.004},get outer(){return r.uniforms.uOuter.value},set outer(e){r.uniforms.uOuter.value=e}}}var le=`
attribute vec4 aInst;  // xyz centre, w radius
attribute float aGlow; // brightness
varying vec2 vUv;
varying float vGlow;
void main() {
  vUv = position.xy * 2.0;
  vGlow = aGlow;
  float scale = length(modelMatrix[0].xyz);
  vec4 mv = modelViewMatrix * vec4(aInst.xyz, 1.0);
  mv.xy += position.xy * 2.0 * aInst.w * scale;
  gl_Position = projectionMatrix * mv;
}`,ue=`
uniform vec3 uColor;
uniform float uFade;
uniform float uKTime;
varying vec2 vUv;
varying float vGlow;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  // a bright heart inside a wide soft body; nothing that reads as a surface
  float body = exp(-r2 * 3.2) - exp(-3.2);
  float heart = exp(-r2 * 26.0);
  vec3 c = uColor * (body * 0.75 + heart * 1.15) + vec3(heart * 0.35);
  gl_FragColor = vec4(c * vGlow * uFade, 0.0);
}`;function de(e,t){let n=new r,i=new h(1,1);n.index=i.index,n.setAttribute(`position`,i.getAttribute(`position`));let o=new s(new Float32Array(e*4),4),c=new s(new Float32Array(e),1);n.setAttribute(`aInst`,o),n.setAttribute(`aGlow`,c),n.instanceCount=e;let l=new m({vertexShader:le,fragmentShader:ue,uniforms:{uColor:{value:b(t)},uFade:{value:1},uKTime:y.uKTime},transparent:!0,depthWrite:!1,blending:2,premultipliedAlpha:!0}),u=new a(n,l);return u.name=`soft-dots`,u.frustumCulled=!1,u.renderOrder=3,{mesh:u,get fade(){return l.uniforms.uFade.value},set fade(e){l.uniforms.uFade.value=e,u.visible=e>.004},set(e,t,n,r,i,a){o.setXYZW(e,t,n,r,i),c.setX(e,a)},commit(){o.needsUpdate=!0,c.needsUpdate=!0}}}var W=[{count:2,radius:.27,glow:.95},{count:8,radius:.53,glow:.8},{count:18,radius:.84,glow:.66}],G=2.15;function fe(t){let r=new e;r.name=`copper-atom`;let i=E({kind:{...D.blob,color:`coral`,shade:`coral.dark`,selfLit:.8,intensity:1.3,glyph:`none`,shimmer:.3,halo:{color:`coral`,size:4.2,strength:.6}},radius:M});i.name=`copper-nucleus`;let a=de(28,`cyan`),o=E({kind:{...D.electron,glyph:`none`,halo:{color:`cyan`,size:3.6,strength:.75}},radius:A*.62});o.name=`copper-outer-electron`;let s=new T({capacity:8,color:`mist`,width:.04,intensity:1,dashStrength:0,base:1,endFade:[0,0],hotCore:.4}),c=ce([W[0].radius,W[1].radius,W[2].radius,j]);r.add(c.mesh,s,a.mesh,i,o);let l=[];W.forEach((e,r)=>{for(let i=0;i<e.count;i++){let a=(i+t.range(-.22,.22))/e.count*Math.PI*2+r*.7,o=t.onSphere();l.push({layer:r,start:new n(Math.cos(a),Math.sin(a),t.range(-.3,.3)).normalize(),axis:new n(o[0]*.16,o[1]*.16,1).normalize(),speed:t.range(.1,.2)*(r%2==0?1:-1),off:new n,now:new n})}});let u=new n(.25,.3,.92).normalize(),d=new n,f=new n,p=new n,m=new n,h=new n,g=new n,_={points:Array.from({length:8},()=>new n),brightness:Array(8).fill(0)},v=0,y=(e,t)=>t.copy(e===28?f:l[e].now),b={group:r,nucleus:i,outer:o,open:1,apart:0,aside:new n(-2.2,0,0),outerShown:1,nucleusShown:1,freed:!1,held:-1,hold(e,t){b.held=e,t&&m.copy(t).sub(r.position)},nearest(e,t,n=.22){let r=-1,i=n;for(let n=0;n<=28;n++){b.electronPosition(n,g).sub(e);let a=g.addScaledVector(t,-g.dot(t)).length();a<i&&(i=a,r=n)}return r},electronPosition:(e,t)=>y(e,t).add(r.position),reset(){b.freed=!1,b.held=-1,d.set(0,0,0);for(let e of l)e.off.set(0,0,0)},update(e,t){let n=P(b.open);if(r.visible=n>.004,!r.visible)return;let x=F(0,1,b.apart);h.copy(b.aside).multiplyScalar(x),l.forEach((n,r)=>{let i=W[n.layer],o=1+.05*Math.sin(t*.9+r*1.3),s=g.copy(n.start).applyAxisAngle(n.axis,t*n.speed).multiplyScalar(i.radius*o).add(h);if(b.held===r){let t=m.clone().sub(s),r=t.length();t.multiplyScalar(.55/(.55+r)),n.off.x=C(n.off.x,t.x,14,e),n.off.y=C(n.off.y,t.y,14,e),n.off.z=C(n.off.z,t.z,14,e)}else n.off.multiplyScalar(Math.exp(-9*e));n.now.copy(s).add(n.off);let c=Math.min(n.off.length()*1.6,1);a.set(r,n.now.x,n.now.y,n.now.z,.15+.05*c,i.glow*(1+.8*c))}),a.fade=n,a.commit(),c.mesh.position.copy(h),c.fade=n,c.outer=b.freed?0:b.outerShown;let S=g.set(.2,.97,0).applyAxisAngle(u,t*.55).multiplyScalar(j).add(h);b.held===28?(d.copy(m).sub(S),m.distanceTo(h)>G&&(b.freed=!0),p.copy(m)):b.freed?d.copy(p).sub(S):d.multiplyScalar(Math.exp(-5*e)),f.copy(S).add(d),b.freed&&b.held!==28&&(f.x+=.12*Math.sin(t*.7),f.y+=.1*Math.sin(t*.9+1)),o.position.copy(f),o.scale.setScalar(Math.max(b.outerShown*n,.001)),o.visible=b.outerShown*n>.01,i.visible=b.nucleusShown>.5;let w=b.held,T=w<0?0:w===28?b.freed?0:.35:1;if(v=C(v,T,10,e),s.visible=v>.02&&w>=0,s.visible){y(w,g);let e=w===28?1-P(g.length()/G)**2:1;_.points.forEach((t,r)=>{let i=r/(_.points.length-1);t.copy(g).multiplyScalar(i),_.brightness[r]=v*n*e*(1-.6*i)}),s.setLines([_])}}};return b}var pe=`
varying vec3 vWorld;
varying vec3 vLocal;
void main() {
  vLocal = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,me=`
uniform vec3 uDeep;   // colour of the depth
uniform vec3 uVoid;
uniform vec3 uWarm;
uniform vec3 uCool;
uniform vec3 uUp;     // «above» and «right» of the copper world in world space
uniform vec3 uRight;
uniform float uLamp;
uniform float uAlpha;
uniform float uVeil;  // 0 = dome, 1 = veil between planes
uniform float uKTime;
varying vec3 vWorld;
varying vec3 vLocal;
void main() {
  vec3 dir = normalize(vWorld - cameraPosition);
  float h = dot(dir, uUp);                       // sine of the elevation of this line of sight
  float side = mix(-0.45, 0.45, uLamp);          // the lamp stands to the upper right, the cool light is upper left
  float lateral = dot(dir, uRight);
  float glow = smoothstep(-0.3, 0.34, h * 0.92 + lateral * side * 0.5);
  glow *= glow;
  // shafts: a fan of soft rays from the lamp far above the frame, drifting very slowly; each veil has its own
  // phase, so the rays have depth
  float fan = atan(lateral - side * 1.3, 0.85 - h);
  float bands = 0.5 + 0.3 * sin(fan * 19.0 + uKTime * 0.05 + uVeil * vLocal.z * 1.7) + 0.2 * sin(fan * 41.0 - uKTime * 0.03 + uVeil * vLocal.z);
  bands = mix(1.0, smoothstep(0.15, 0.85, bands), 0.3 * smoothstep(0.0, 0.3, glow));
  vec3 light = mix(uCool * 0.3, uWarm * 0.72, uLamp) * glow * bands * mix(1.0, 0.3, uVeil);
  vec3 base = mix(uVoid, uDeep, smoothstep(-0.5, 0.25, h));
  float a = uAlpha * mix(1.0, 0.6 + 0.1 * glow, uVeil);
  gl_FragColor = vec4(base + light, a);
}`;function he(){let t=new e;t.name=`copper-backdrop`;let r=e=>({uDeep:{value:b(`bg.deep`).lerp(b(`bg.indigo`),.35)},uVoid:{value:b(`bg.void`)},uWarm:{value:b(`yellow.light`).lerp(b(`amber`),.25)},uCool:{value:b(`sky`)},uUp:i.uUp,uRight:i.uRight,uLamp:i.uLamp,uAlpha:{value:1},uVeil:{value:e},uKTime:y.uKTime}),i={uUp:{value:new n(0,1,0)},uRight:{value:new n(1,0,0)},uLamp:{value:0}},o=e=>new m({vertexShader:pe,fragmentShader:me,uniforms:r(e),transparent:!0,depthWrite:!1,side:e?2:1}),s=o(0),c=new a(new v(300,32,20),s);c.name=`copper-dome`,c.renderOrder=-20,c.frustumCulled=!1,t.add(c);let l=o(1),u=new e;u.name=`copper-veils`;let d=new h(260,160);for(let e=0;e<3;e++){let t=new a(d,l);t.position.z=-(e*k+.85),t.renderOrder=-10+e*-1,t.name=`copper-veil-${e}`,u.add(t)}return{group:t,sheets:u,get lamp(){return i.uLamp.value},set lamp(e){i.uLamp.value=e},get dome(){return s.uniforms.uAlpha.value},set dome(e){s.uniforms.uAlpha.value=e,c.visible=e>.003},get veils(){return l.uniforms.uAlpha.value},set veils(e){l.uniforms.uAlpha.value=e,u.visible=e>.003},up:i.uUp.value,right:i.uRight.value}}var K=1+A*1.15;function ge(e){let t=new Map,n=(e,t,n)=>(e*128+(t+64))*128+(n+64);return e.forEach((e,r)=>t.set(n(e.plane,e.i,e.j),r)),(e,r,i)=>t.get(n(e,r,i))??-1}function q(e,t,n,r,i){let a=3*t,o=e[a]*n+e[a+1]*r+e[a+2]*i;o>=0||(e[a]=e[a]-2*o*n,e[a+1]=e[a+1]-2*o*r,e[a+2]=e[a+2]-2*o*i)}function _e(e,t,n,r){let i=3*n,a=Math.round(-e[i+2]/k),o=-1;for(let s=Math.max(a-1,0);s<=Math.min(a+1,3);s++){let a=s%2==1?O/2:0,c=Math.round((e[i]-a)/O),l=Math.round((e[i+1]-a)/O),u=r.at(s,c,l);if(u<0||r.presence(u)<.5)continue;let d=r.sites[u].p,f=e[i]-d.x,p=e[i+1]-d.y,m=e[i+2]-d.z,h=Math.hypot(f,p,m);if(h>=K||h<1e-6)continue;let g=f/h,_=p/h,v=m/h;e[i]=d.x+g*K,e[i+1]=d.y+_*K,e[i+2]=d.z+v*K,q(t,n,g,_,v),o=u}return o}function ve(e,t,n,r,i,a){let o=3*n,s=1/0,c=0,l=0,u=0;for(let t=0;t<i;t++){if(r.presence(t)<.5)continue;let n=r.sites[t].p,i=Math.hypot(e[o]-n.x,e[o+1]-n.y,e[o+2]-n.z);i<s&&(s=i,c=n.x,l=n.y,u=n.z)}if(s===1/0||s<=a)return;let d=(c-e[o])/s,f=(l-e[o+1])/s,p=(u-e[o+2])/s;e[o]=c-d*a,e[o+1]=l-f*a,e[o+2]=u-p*a,q(t,n,d,f,p)}function ye(e,t,n){let r=3*n,i=N-.2;e[r+1]<=i||(e[r+1]=i,q(t,n,0,-1,0))}function J(e,t,n,r,i){let a=3*n;e[a+2]<r?(e[a+2]=r,q(t,n,0,0,1)):e[a+2]>i&&(e[a+2]=i,q(t,n,0,0,-1))}var be=[15.5,8.6],xe=[21,11.5],Y=[-.75,1.7],Se=[6.4,3.5];function Ce(e,t){let n=new Float32Array(228),r=new Float32Array(228),i=new Float32Array(228),a=new Float32Array(76),o=new Float32Array(76),s=new Float32Array(76),c=new Float32Array(76),l=Array.from({length:76},()=>{let[t,n,r]=e.onSphere(),i=Math.hypot(n,t)||1,a=[n/i,-t/i,0];return{u:a,v:[n*a[2]-r*a[1],r*a[0]-t*a[2],t*a[1]-n*a[0]],phase:e.range(0,6.28),w:e.range(1.7,2.6)*(e.next()<.5?-1:1)}}),u=t=>{let[n,r,a]=e.onSphere(),o=1/Math.hypot(n,r,a*.3);i.set([n*o,r*o,a*.3*o],3*t)},d=()=>{for(let t=0;t<76;t++){let n=t>=32,i=n?xe:be;o[t]=n?e.range(.25,1):0;let l=n?-k*(.6+3.2*o[t]):e.range(Y[0],Y[1]);r.set([e.range(-i[0],i[0]),e.range(-i[1],i[1]),l],3*t),s[t]=e.range(.75,1.25),c[t]=e.range(0,.6),a[t]=0,u(t)}};d();let f={count:76,pos:n,shown:a,depthOf:o,speed:12,drift:0,shared:1,piece:32,centre:{x:0,y:0},gate:{on:!1,x:0,y:0,half:2.4,left:0,right:0,last:-1,balance:0,turned:0},followed:-1,nearest(e,t){let r=-1,i=1/0;for(let o=0;o<32;o++){let s=Math.hypot(n[3*o]-e,n[3*o+1]-t);a[o]>.5&&s<i&&(i=s,r=o)}return r},reset:d,step(o,d){let p=f.piece>=32,m=P(f.shared);for(let h=0;h<76;h++){let g=3*h,_=h>=32,v=_?+!!p:p?1:t.presence(h),y=a[h];a[h]=y+(v-y)*Math.min(o*6,1);let b=t.sites[Math.min(h,t.sites.length-1)].p,x=l[h],S=x.phase+d*x.w,C=Math.cos(S)*j,w=Math.sin(S)*j,T=b.x+x.u[0]*C+x.v[0]*w,E=b.y+x.u[1]*C+x.v[1]*w,D=b.z+.55*(x.u[2]*C+x.v[2]*w);if(!_&&(m<.02||!p&&y<.05))r.set([T,E,D],g);else if(a[h]>.02||p){let n=r[g],a=f.speed*s[h]*o*(_?.8:1);if(r[g]=n+i[g]*a+f.drift*f.speed*o,r[g+1]=r[g+1]+i[g+1]*a,r[g+2]=r[g+2]+i[g+2]*a,d>=c[h]&&(u(h),c[h]=d+.18-.42*Math.log(1-e.next()*.98)),_e(r,i,h,t),ye(r,i,h),_?J(r,i,h,-k*4.2,-k*.6):J(r,i,h,Y[0],Y[1]),!p&&!_)ve(r,i,h,t,Math.ceil(f.piece),j+.75);else if(h===f.followed)for(let e of[0,1]){let t=r[g+e]-(e===0?f.centre.x:f.centre.y);Math.abs(t)>Se[e]&&t*i[g+e]>0&&(i[g+e]=-i[g+e])}else{let e=_?xe:be,t=r[g]-f.centre.x,n=r[g+1]-f.centre.y;Math.abs(t)>e[0]&&(r[g]=r[g]-Math.sign(t)*2*e[0]),Math.abs(n)>e[1]&&(r[g+1]=r[g+1]-Math.sign(n)*2*e[1])}let l=f.gate;if(l.on&&!_&&Math.abs(r[g+1]-l.y)<l.half&&Math.abs(r[g]-n)<2){let t=r[g],a=n<l.x&&t>=l.x?1:n>=l.x&&t<l.x?-1:0,o=(l.right-l.left)*a;a!==0&&o>0&&e.next()<.5*l.balance*o*o?(u(h),i[g]=-a*Math.abs(i[g]),r[g]=2*l.x-t,c[h]=d+.18-.42*Math.log(1-e.next()*.98),l.turned++):a!==0&&(a>0?l.right++:l.left++,l.last=h)}}n[g]=T+(r[g]-T)*(_?1:m),n[g+1]=E+(r[g+1]-E)*(_?1:m),n[g+2]=D+(r[g+2]-D)*(_?1:m)}}};return f}var we=`
attribute vec4 aHead; // xyz position of the electron, w half-width at the head
attribute vec4 aTail; // xyz end of the tail, w brightness
varying vec2 vUv;
varying float vGlow;
void main() {
  // u: 0 at the tail's end … 1 at the electron; v: −1 … 1 across
  vUv = vec2(position.x + 0.5, position.y * 2.0);
  vGlow = aTail.w;
  float scale = length(modelMatrix[0].xyz);
  vec4 head = modelViewMatrix * vec4(aHead.xyz, 1.0);
  vec4 tail = modelViewMatrix * vec4(aTail.xyz, 1.0);
  vec2 along = head.xy - tail.xy;
  float len = max(length(along), 1e-5);
  vec2 across = vec2(-along.y, along.x) / len;
  vec4 mv = mix(tail, head, vUv.x);
  mv.xy += across * vUv.y * aHead.w * scale;
  // a hair behind the electron, so its marble covers the blunt end
  mv.z -= 0.02 * scale;
  gl_Position = projectionMatrix * mv;
}`,Te=`
uniform vec3 uColor;
uniform vec3 uDim;
uniform float uFade;
varying vec2 vUv;
varying float vGlow;
void main() {
  // a comet: full width at the electron, a point at the far end
  float half_w = pow(vUv.x, 0.6);
  float edge = fwidth(vUv.y) * 1.2;
  // fading out, a tail thins away (it is a solid shape: darkening it would leave black needles)
  if (abs(vUv.y) > half_w * uFade - edge * 0.5 || vGlow < 0.02) discard;
  vec3 c = mix(uDim, uColor, vUv.x * vUv.x) * mix(0.55, 1.15, vUv.x);
  gl_FragColor = vec4(c * vGlow, 1.0);
}`;function Ee(e){let t=new r,n=new h(1,1,6,1);t.index=n.index,t.setAttribute(`position`,n.getAttribute(`position`));let i=new s(new Float32Array(e*4),4),o=new s(new Float32Array(e*4),4);t.setAttribute(`aHead`,i),t.setAttribute(`aTail`,o),t.instanceCount=e;let c=new m({vertexShader:we,fragmentShader:Te,uniforms:{uColor:{value:b(`cyan`)},uDim:{value:b(`cyan.dark`).lerp(b(`cyan`),.35)},uFade:{value:1}},side:2}),l=new a(t,c);return l.name=`electron-streaks`,l.frustumCulled=!1,{mesh:l,get fade(){return c.uniforms.uFade.value},set fade(e){c.uniforms.uFade.value=e,l.visible=e>.02},set(e,t,n,r,a,s,c,l,u){i.setXYZW(e,t,n,r,l),o.setXYZW(e,a,s,c,u)},commit(){i.needsUpdate=!0,o.needsUpdate=!0}}}var De=.11,X=2.4,Oe=48,ke=3;function Ae(t){let r=t.count,i=new e;i.name=`copper-electrons`;let o=E({kind:{...D.electron,glyph:`none`,halo:{color:`cyan`,size:3.4,strength:.55}},count:r,radius:A,instanceColors:!0}),s=Ee(r),c=new T({capacity:96,color:`cyan.light`,width:A*.55,intensity:.95,dashStrength:0,base:1,endFade:[0,0],hotCore:.3}),l=new a(new g(A*2.5,A*2.95,48),w.glow({color:`white`,intensity:1.5,falloff:0,edge:0}));l.name=`electron-mark`,i.add(s.mesh,c,o,l),S(c),S(l);let u=Array.from({length:r},()=>({prev:new n,corner:new n,dir:new n,speed:0})),d=[],f=Array.from({length:Oe},()=>({points:[new n,new n],brightness:[0,0]})),p=!1,m=-1,h=0,_=new n,v=new n,y=e=>Math.max(1-(h-e)/X,0)**1.3,b={group:i,orbs:o,marked:-1,fade:1,crowd:1,positionOf:(e,n)=>n.fromArray(t.pos,3*e),cut:()=>p=!1,update(e,n){let i=b.marked;i!==m&&(d.length=0),m=i,h+=e;for(let n=0;n<r;n++){_.fromArray(t.pos,3*n);let r=u[n],a=v.subVectors(_,r.prev).length();!p||a>ke?(r.corner.copy(_),r.speed=0,n===i&&(d.length=0)):e>0&&a>1e-5&&(v.multiplyScalar(1/a),r.speed>0&&v.dot(r.dir)<.96&&(r.corner.copy(r.prev),n===i&&d.push({p:r.prev.clone(),at:h-e})),r.dir.copy(v),r.speed=a/e),r.prev.copy(_);let c=Math.min(r.speed*De,r.corner.distanceTo(_));v.copy(_).addScaledVector(r.dir,-c);let l=t.depthOf[n],f=t.shown[n],m=n===i,g=m?1.5:b.crowd*I(1,.34,l);o.setPosition(n,_.x,_.y,_.z,f*(m?1.25:I(1,.8,l))),o.setInstanceColor(n,m?`white`:`cyan`,g);let y=f*(m?1.25:I(1,.8,l));s.set(n,_.x,_.y,_.z,v.x,v.y,v.z,A*.9*y,c>.05?Math.min(g,1.2):0)}if(p=!0,o.commit(),o.fade=b.fade,s.commit(),s.fade=b.fade,c.visible=b.fade>.5,l.visible=i>=0&&b.fade>.5,i>=0){for(b.positionOf(i,_),l.position.copy(_),l.quaternion.copy(n.quaternion),l.scale.setScalar(t.shown[i]);d.length>1&&d[1].at<h-X;)d.shift();for(;d.length>=Oe;)d.shift();let e=d.length;for(let t=0;t<e;t++){let n=d[t],r=t+1<e?d[t+1].p:_,i=t+1<e?d[t+1].at:h,a=f[t],o=Math.min(Math.max((h-X-n.at)/Math.max(i-n.at,1e-4),0),1);a.points[0].lerpVectors(n.p,r,o),a.points[1].copy(r),a.brightness[0]=y(n.at+(i-n.at)*o),a.brightness[1]=y(i)}c.setLines(f.slice(0,e))}else c.setLines([])}};return b}var Z=[-1.15,3];function je(t){let r=new e;r.name=`counter-frame`;let i=new e,o=w.glow({color:`teal`,intensity:1.45,whiten:0,keepHue:!0}),s=w.glass({color:`teal`,opacity:.13,edgeOpacity:.32,specular:0}),u=null,d=null,f=-1,m=e=>{u&&(i.remove(u),u.geometry.dispose()),d&&(i.remove(d),d.geometry.dispose());let t=.45,r=[],c=(e,i,a)=>{for(let o=0;o<=6;o++){let s=a+o/6*(Math.PI/2);r.push(new n(0,e+Math.cos(s)*t,i+Math.sin(s)*t))}};c(e-t,Z[1]-t,0),c(-e+t,Z[1]-t,Math.PI/2),c(-e+t,Z[0]+t,Math.PI),c(e-t,Z[0]+t,Math.PI*1.5),u=new a(new l(new p(r,!0,`catmullrom`,.1),160,.07,8,!0),o),d=new a(new h(Z[1]-Z[0]-.1,2*e-.1),s),d.rotation.y=Math.PI/2,d.position.z=(Z[0]+Z[1])/2,i.add(u,d),f=e},_=e=>{let t=new x(`0`,{font:`display`,size:46,color:`white`,anchorX:e,anchorY:`bottom`,billboard:!0,screenSpace:!0,rich:!1});return S(t),t},v=_(`right`),y=_(`left`);r.add(i,v,y);let b=new g(.36,.44,40);b.rotateY(Math.PI/2);let T=Array.from({length:5},()=>{let e=w.glow({color:`teal`,intensity:0,whiten:.2,keepHue:!0}),t=new a(b,e);return t.visible=!1,r.add(t),{mesh:t,material:e,age:1}}),E=0,D=new n,O=0,k=0,A=0,j={left:0,right:0},M={left:0,right:0},N={group:r,shown:0,numbers:!0,leftAnchor:new c,rightAnchor:new c,update(e){let n=t.gate;if(O=C(O,N.shown,9,e),r.visible=O>.01,!r.visible)return;if(n.half!==f&&m(n.half),r.position.set(n.x,n.y,0),i.scale.setScalar(O),n.left+n.right!==A&&(A=n.left+n.right,k=1,n.last>=0)){let e=T[E++%T.length];e.mesh.position.set(0,t.pos[3*n.last+1]-n.y,t.pos[3*n.last+2]),e.age=0}k=C(k,0,7,e),o.intensity=1.45+.9*k;for(let t of T)t.age+=e/.45,t.mesh.visible=t.age<1,t.mesh.scale.setScalar(.35+1.1*Math.sqrt(Math.min(t.age,1))),t.material.intensity=1.6*(1-t.age)**2;let a=n.half+.4,s=(Z[0]+Z[1])/2;N.leftAnchor.position.set(-.85,a,s),N.rightAnchor.position.set(.85,a,s),v.position.copy(N.leftAnchor.position),y.position.copy(N.rightAnchor.position),v.visible=y.visible=N.numbers&&O>.6,n.left!==j.left&&(M.left=+(n.left>j.left)),n.right!==j.right&&(M.right=+(n.right>j.right)),j.left=n.left,j.right=n.right,M.left=C(M.left,0,6,e),M.right=C(M.right,0,6,e);let c=r.getWorldScale(D).x;v.scale.setScalar((1+.28*M.left)/c),y.scale.setScalar((1+.28*M.right)/c);let l=`← ${n.left}`,u=`${n.right} →`;v.text!==l&&(v.text=l),y.text!==u&&(y.text=u)}};return r.add(N.leftAnchor,N.rightAnchor),N}var Q=1.6,Me=`
attribute vec4 aInst; // xyz centre, w presence
varying vec2 vUv;
varying float vK;
void main() {
  vUv = position.xy * 2.0;
  vK = aInst.w;
  float scale = length(modelMatrix[0].xyz);
  vec4 mv = modelViewMatrix * vec4(aInst.xyz, 1.0);
  mv.xy += position.xy * 2.0 * ${(1*Q).toFixed(3)} * scale * (0.6 + 0.4 * aInst.w);
  gl_Position = projectionMatrix * mv;
}`,Ne=`
uniform vec3 uColor;
uniform vec3 uHot;
uniform float uAmount;
uniform float uHeat;
varying vec2 vUv;
varying float vK;
void main() {
  float r = length(vUv) * ${Q.toFixed(3)}; // in atom radii
  // dense next to the sphere, thinning outward; the sphere itself hides the middle (it is in front)
  float veil = smoothstep(${Q.toFixed(3)}, 1.0, r);
  veil = veil * veil * (0.55 + 0.45 * smoothstep(0.75, 1.02, r));
  float a = veil * vK * uAmount * mix(0.17, 0.8, uHeat);
  if (a < 0.003) discard;
  gl_FragColor = vec4(mix(uColor, uHot, uHeat), a);
}`;function Pe(e){let t=new r,n=new h(1,1);t.index=n.index,t.setAttribute(`position`,n.getAttribute(`position`));let i=new s(new Float32Array(e*4),4);t.setAttribute(`aInst`,i),t.instanceCount=e;let o=new m({vertexShader:Me,fragmentShader:Ne,uniforms:{uColor:{value:b(`cyan.dark`).lerp(b(`cyan`),.2)},uHot:{value:b(`orange`)},uAmount:{value:1},uHeat:{value:0}},transparent:!0,depthWrite:!1,blending:1,side:2}),c=new a(t,o);return c.name=`copper-haze`,c.frustumCulled=!1,c.renderOrder=2,{mesh:c,get amount(){return o.uniforms.uAmount.value},set amount(e){o.uniforms.uAmount.value=e,c.visible=e>.004},get heat(){return o.uniforms.uHeat.value},set heat(e){o.uniforms.uHeat.value=e},set:(e,t,n,r,a)=>i.setXYZW(e,t,n,r,a),commit:()=>i.needsUpdate=!0}}var Fe={...D.blob,color:`coral`,shade:`coral.dark`,selfLit:0,gloss:0,rim:.55,glyph:`none`},Ie=e=>1+2.7*(e-1)**3+1.7*(e-1)**2;function Le(){let t=new e;t.name=`copper-lattice`;let n=ee(),r=n.length,i=E({kind:Fe,count:r-1,radius:1,instanceColors:!0,halo:!1}),a=E({kind:Fe,count:1,radius:1,instanceColors:!0,halo:!1});i.name=`copper-atoms`,a.name=`copper-hero-atom`;let o=Pe(r);t.add(i,a,o.mesh);let s=new Float32Array(r),c=new Float32Array(r),l=n.map(e=>e.p.clone()),u=b(`coral`),d=b(`bg.indigo`).lerp(b(`coral.dark`),.45),f=b(`orange`),p=u.clone(),m={group:t,sites:n,atoms:i,hero:a,haze:o,reveal:r,tremble:.05,heat:0,fade:1,heroShrink:0,others:1,recede:1,hazeAmount:1,selected:-1,heroSite:0,touch:e=>c[e]=1,siteAt(e){let t=-1,i=1.25;for(let a=0;a<r&&n[a].plane===0;a++){let n=l[a].distanceTo(e);n<i&&s[a]>.5&&(i=n,t=a)}return t},positionOf:(e,t)=>t.copy(l[e]),presence:e=>s[e],update(e,h){let g=m.tremble*(1+3.8*m.heat),_=n[m.heroSite]?.plane===0?m.heroSite:0,v=n[_].p;for(let t=0;t<r;t++){let r=n[t];s[t]=C(s[t],P(m.reveal-t),10,e);let y=t===m.selected?.5:0;c[t]=C(c[t],y,3.2,e);let b=c[t],x=Ie(s[t])*(1+.1*b+.08*Math.sin(Math.PI*Math.min(b*1.4,1))),S=5.3+t%7*.37,w=l[t].set(r.p.x+g*Math.sin(h*S+t*1.7),r.p.y+g*Math.sin(h*S*1.13+t*2.3),r.p.z+g*Math.sin(h*S*.91+t*.9)),T=m.recede*(1-.72**r.plane);p.copy(u).lerp(d,T).lerp(f,.35*m.heat*(1-T));let E=I(1,.56,T)+.5*c[t];if(t===_){let e=I(1,M/1,F(0,1,m.heroShrink));a.setPosition(0,w.x,w.y,w.z,Math.max(x,0)*e),a.setInstanceColor(0,p,E+.25*m.heroShrink);let n=(1+2.4*b)*(1-F(0,.5,m.heroShrink));o.set(t,w.x,w.y,w.z,Math.max(x,0)*n);continue}let D=.15+.7*Math.min(Math.hypot(r.p.x-v.x,r.p.y-v.y)/16,1),O=m.others>=1?1:P(m.others*(1+D)-D),k=t>_?t-1:t;i.setPosition(k,w.x,w.y,w.z,Math.max(x,0)*Math.sqrt(O)),i.setInstanceColor(k,p,E),o.set(t,w.x,w.y,w.z,Math.max(x,0)*(1-T)**3*O*(1+2.4*b))}i.commit(),a.commit(),i.fade=a.fade=m.fade,i.visible=m.others>.004,a.visible=m.heroShrink<.995,o.amount=m.hazeAmount*m.fade,o.heat=m.heat,o.commit(),t.visible=m.fade>.004}};return m}var Re=`
varying vec2 vP;
varying float vDiag;
void main() {
  // the aspect ratio of the viewport is in the projection matrix; work in units of half the frame height
  float aspect = projectionMatrix[1][1] / projectionMatrix[0][0];
  vP = position.xy * 2.0 * vec2(aspect, 1.0);
  vDiag = length(vec2(aspect, 1.0));
  gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
}`,ze=`
uniform vec3 uColor;
uniform vec3 uDark;
uniform float uOpen;
uniform float uAmount;
varying vec2 vP;
varying float vDiag;
void main() {
  float px = fwidth(vP.y);                 // one pixel, in units of half the frame height
  float d = length(vP) - uOpen * vDiag;    // signed distance to the rim
  float line = 1.0 - smoothstep(1.1 * px, 2.4 * px, abs(d));
  float glow = exp(-abs(d) / (0.018 + 5.0 * px)) * 0.32;
  float rim = max(line, glow);
  float outside = smoothstep(0.0, 0.12, d) * 0.55;   // beyond the glass the frame sinks into the dark
  float a = clamp(rim + outside, 0.0, 1.0) * uAmount;
  if (a < 0.003) discard;
  gl_FragColor = vec4(mix(uDark, uColor * 1.2, clamp(rim / max(rim + outside, 1e-4), 0.0, 1.0)), a);
}`;function Be(){let e=new m({vertexShader:Re,fragmentShader:ze,uniforms:{uColor:{value:b(`cyan`)},uDark:{value:b(`bg.void`)},uOpen:{value:.97},uAmount:{value:1}},transparent:!0,depthTest:!1,depthWrite:!1,blending:1}),t=new a(new h(1,1),e);return t.name=`lens-rim`,t.frustumCulled=!1,t.renderOrder=50,S(t),{mesh:t,get amount(){return e.uniforms.uAmount.value},set amount(n){e.uniforms.uAmount.value=n,t.visible=n>.004},get open(){return e.uniforms.uOpen.value},set open(t){e.uniforms.uOpen.value=t}}}var Ve=.9,He=2.7,Ue=[{y:2.1,z:0},{y:4.6,z:-2.6},{y:6.7,z:0},{y:8.8,z:-2.6},{y:10.9,z:0},{y:13,z:-2.6},{y:15.1,z:0}],We=10;function Ge(t){let r=new e;r.name=`plastic-sheath`;let a=[],s=[];Ue.forEach((e,r)=>{let i=null,o=t.range(0,6.28);for(let t=-10;t<=We;t++){let c=t*He+r%3*.7,l=N+e.y+(t%2==0?.42:-.42)+.55*Math.sin(c*.33+o),u=new n(c,l,e.z+.35*Math.sin(c*.21+o*2));a.push({p:u,deep:e.z<-1}),i&&s.push([i,u]),i=u}});let c=E({kind:{...D.blob,color:`violet`,shade:`violet.dark`,selfLit:0,gloss:0,rim:.5,glyph:`none`},count:a.length,radius:Ve,instanceColors:!0,halo:!1});c.name=`plastic-atoms`,a.forEach(({p:e,deep:t},n)=>{c.setPosition(n,e.x,e.y,e.z),c.setInstanceColor(n,t?`violet.dark`:`violet`,t?.7:1)}),c.commit();let l=w.toon({color:`violet.dark`}),u=new o(new _(.2,.2,1,10,1,!0),l,s.length);u.name=`plastic-bonds`;let d=new i,p=new f,m=new n(0,1,0),h=new n;s.forEach(([e,t],r)=>{h.subVectors(t,e);let i=h.length();p.setFromUnitVectors(m,h.normalize()),d.compose(e.clone().add(t).multiplyScalar(.5),p,new n(1,i,1)),u.setMatrixAt(r,d)}),u.frustumCulled=!1;let g=a.filter(e=>!e.deep).map(({p:e})=>{let r=t.range(0,6.28),i=new n(Math.cos(r),Math.sin(r)*.8,t.range(.15,.6)).normalize();return{home:e,dir:i,side:new n(-i.y,i.x,0).normalize(),rate:t.range(2.4,4.2),phase:t.range(0,6.28)}}),v=E({kind:{...D.electron,glyph:`none`,intensity:.95,halo:{color:`cyan`,size:3,strength:.4}},count:g.length,radius:A});v.name=`plastic-electrons`;let y=new T({capacity:g.length*2,color:`cyan`,width:.11,intensity:.95,dashStrength:0,base:1,endFade:[0,0],hotCore:0,keepHue:!0}),b=g.map(()=>({points:[new n,new n],brightness:[.35,1]}));r.add(u,c,y,v);let x={group:r,atoms:c,electrons:v,fade:1,update(e){r.visible=x.fade>.004,r.visible&&(g.forEach((t,n)=>{let r=.5*Math.sin(e*t.rate+t.phase),i=1.4+.16*Math.sin(e*t.rate*1.7+t.phase*2),a=b[n].points[1].copy(t.dir).addScaledVector(t.side,r).normalize().multiplyScalar(i).add(t.home);b[n].points[0].copy(a).sub(t.home).setLength(Ve*.96).add(t.home),v.setPosition(n,a.x,a.y,a.z)}),v.commit(),y.setLines(b),c.fade=v.fade=l.fade=x.fade,y.visible=x.fade>.5)}};return x}var Ke=2.35,$=[[0,.03],[.7,.62],[1,1]],qe=.064,Je=[1.06,1.5];function Ye(e){let t=Math.max(e,0);for(let e=1;e<$.length;e++){let[n,r]=$[e],[i,a]=$[e-1];if(t<=n)return a*(r/a)**+((t-i)/(n-i))}return 1}function Xe(t){let n=new e;n.name=`copper-world`;let r=new e;r.name=`copper-space`;let a=Le(),o=Ce(t.random.fork(`copper-electrons`),{sites:a.sites,at:ge(a.sites),presence:e=>a.presence(e)}),s=Ae(o),c=fe(t.random.fork(`copper-atom`)),l=Ge(t.random.fork(`plastic`)),u=je(o),d=he(),p=Be(),m=re();r.add(d.sheets,a.group,l.group,s.group,c.group,u.group),n.add(d.group,m.group,r,p.mesh);let h=new f,g=new i,_={quaternion:h},v=a.sites.length,y=v,b=40,x=!0,S=1,C={group:n,space:r,lattice:a,sim:o,electrons:s,atom:c,plastic:l,gate:u,backdrop:d,core:m,rim:p,depth:1,lamp:0,atoms:1/0,growSeconds:1.1,hero:0,look:{x:0,y:0},marked:-1,heroPosition:e=>r.localToWorld(e.copy(a.sites[a.heroSite].p)),markNearest(e=C.look.x,t=C.look.y){return C.marked=o.nearest(e,t)},toLocal:e=>r.worldToLocal(e),localRay(e,t){return g.copy(r.matrixWorld).invert(),t.origin.copy(e.origin).applyMatrix4(g),t.direction.copy(e.direction).transformDirection(g),t},snap(){x=!0,s.cut()},update(e,i){let f=C.depth,p=f<1?Ye(f):Ke**(Math.min(f,2)-1);r.scale.setScalar(p),m.scale=p/$[0][1],m.latticeScale=p,m.eye.copy(t.camera.camera.position).applyMatrix4(g.copy(n.matrixWorld).invert()),m.dots=F(.05,.4,f),m.balls=F(.26,.7,f),m.open=F(.72,.9,f),m.fade=1,m.lamp=C.lamp,m.warmth=.55*F(.02,.34,f),m.update(n.matrixWorld),d.dome=F(.02,.22,f),d.lamp=C.lamp,d.up.set(0,1,0).transformDirection(n.matrixWorld),d.right.set(1,0,0).transformDirection(n.matrixWorld);let w=a.sites[C.hero]?.plane===0?C.hero:0,T=a.sites[w].p;a.heroSite=w;let E=p*F(1,1.45,f);r.position.set(-T.x*E,-T.y*E,0);let D=Math.min(C.atoms,a.sites.length);D!==y&&(y=D,b=Math.max(40,Math.abs(D-v)/Math.max(C.growSeconds,.001)));let O=x?1/0:b*e;v+=Math.min(Math.max(D-v,-O),O),a.reveal=v,a.heroShrink=F(1.05,1.68,f),a.others=1-Math.min(Math.max((f-1.06)/.62,0),1),a.fade=F(.54,.7,f);let k=qe+.9359999999999999*F(Je[0],Je[1],f);d.veils=f>.7?(1-Math.cbrt(k))/(1-Math.cbrt(qe)):0,l.fade=a.others*F(.9,1,f),s.fade=F(.6,.8,f)*(1-F(1.1,1.4,f)),s.marked=o.followed=C.marked,S=x?C.marked>=0?.6:1:S+((C.marked>=0?.6:1)-S)*Math.min(e*4,1),s.crowd=S,c.open=F(1.05,1.25,f),c.outerShown=F(1.25,1.55,f),c.nucleusShown=+(f>=1.65),c.group.position.copy(T),o.piece=Math.min(Math.ceil(v),32),o.centre.x=C.look.x,o.centre.y=Math.min(C.look.y,N-8.2),x=!1,a.update(e,i),c.update(e,i),l.update(i),s.fade>.004&&o.step(e,i),u.update(e),n.getWorldQuaternion(h).invert().multiply(t.camera.camera.quaternion),s.group.visible=s.fade>.004,s.group.visible&&s.update(e,_)}};return C}var Ze=.35;function Qe(e,t){let r=new n(...t.axis).normalize(),a=new n(...t.view).normalize().negate(),o=new n().crossVectors(a,r).normalize();r.crossVectors(o,a);let s=t.coreRadius/R;return e.quaternion.setFromRotationMatrix(new i().makeBasis(r,o,a)),e.scale.setScalar(s),e.position.set(...t.point).addScaledVector(a,-(Ze-R)*s),e.updateMatrixWorld(!0),s}function $e(e,t){let r=Math.min(Math.max(e,0),1),i=b(`sky`).lerp(b(`white`),.6),a=b(`yellow.light`).lerp(b(`white`),.45),o=(e,r,i)=>{let a=new n(e,r,i).normalize();return t&&a.transformDirection(t.matrixWorld),a.toArray()},s=-.3+.55*r;return{sunDir:o(s,.9,.4),keyColor:i.lerp(a,r),keyIntensity:.8+.2*r,fillSky:new d(.3,.3,.66).lerp(new d(.5,.4,.62),r),fillGround:new d(.2,.15,.48),fillIntensity:.92,rimColor:r>.5?`yellow.light`:`sky`,rimIntensity:.35+.7*r,rimDir:o(s*.8,.75,-.6),bokeh:0,motes:0,fogDensity:0}}function et(e,t=1){let n=e<.5;return{dofAperture:n?.12:5,dofRange:.45*t,dofMaxBlur:20,dofReference:2.2*6*t,bloomIntensity:1,aoIntensity:n?0:.3,aoRadius:.35*t,vignette:.55}}export{U as a,N as c,Xe as i,O as l,et as n,ie as o,Qe as r,ae as s,$e as t};