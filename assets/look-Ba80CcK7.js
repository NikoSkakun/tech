import{$ as e,At as t,I as n,L as r,M as i,St as a,X as o,Y as s,_t as c,at as l,ct as u,g as d,ht as f,jt as p,m,mt as h,wt as g,y as _,z as v}from"./three-K2PiNtFv.js";import{u as y}from"./environment-BUpG4Ejb.js";import{l as b}from"./palette-OlaaBGg3.js";import{t as x}from"./text3d-kCkuG726.js";import"./api-fV4PCqa8.js";import{a as S,r as C}from"./tween-HyA1AdHI.js";import{t as w}from"./style-DL9JJzkU.js";import{Ct as T,Tt as E,wt as D}from"./fx-DjEzSp2Q.js";import"./text-Cc_7gsp6.js";var O=3.2,k=O/Math.SQRT2,A=1/6,j=1.52,M=.085,N=4.5*O;function P(){let e=[];for(let n=0;n<4;n++){let r=n%2==1?O/2:0,i=7+Math.ceil(n*1.5),a=4+n;for(let o=-a;o<=a;o++)for(let a=-i;a<=i;a++){let i=a*O+r,s=o*O+r;if(s>14.4-(n>0?1.2:0))continue;let c=Math.abs(a),l=Math.abs(o),u=n>0?1e3*n+Math.max(c,l):c<=2&&l<=1?l*100+c*4+(a>0?0:2)+(o>0?0:1):400+Math.max(c,l)*40+l;e.push({p:new t(i,s,-n*k),plane:n,i:a,j:o,rank:u})}}return e.sort((e,t)=>e.rank-t.rank)}var F=e=>Math.min(Math.max(e,0),1),I=(e,t,n)=>{let r=F((n-e)/(t-e));return r*r*(3-2*r)},L=(e,t,n)=>e+(t-e)*n,R=`
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
}`,z=(O/1).toFixed(4),B=`
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
  float r = length(c) * ${z};
  float mask = 1.0 - smoothstep(1.0 - max(2.5 * fw, soft), 1.0, r);
  vec3 n = vec3(c * ${z}, sqrt(max(1.0 - r * r, 0.0)));
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
  float fw = max(fwidth(cell0.x), fwidth(cell0.y)) * ${z};
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
}`,V=6.1,ee=19.7,te={handed:{top:[[169,75,32],[222,93,36]],lit:[[167,74,29],[200,86,34]],mid:[[167,74,29],[177,76,31]],shade:[[167,74,29],[171,74,30]],glint:[[167,74,29],[243,130,80]],rim:[[182,84,78],[222,104,112]]},inside:{rim:[[200,110,76],[255,158,90]],top:[[200,110,76],[255,158,90]],lit:[[210,104,48],[254,135,47]],mid:[[154,70,34],[188,79,32]],shade:[[110,42,24],[130,46,22]],glint:[[250,190,170],[255,176,118]]}};function ne(){let e=new i;e.name=`wire-core`;let n=new _(V,V,600,128,1,!0);n.rotateZ(Math.PI/2);let r=e=>[...te.handed[e],...te.inside[e]].map(([e,t,n])=>new d().setRGB(e/255,t/255,n/255,f)),a=new c({vertexShader:R,fragmentShader:B,uniforms:{uTop:{value:r(`top`)},uLit:{value:r(`lit`)},uMid:{value:r(`mid`)},uShade:{value:r(`shade`)},uGlint:{value:r(`glint`)},uRim:{value:r(`rim`)},uWarmth:{value:0},uAtom:{value:b(`coral`)},uAtomShade:{value:b(`coral.dark`)},uDeep:{value:b(`bg.deep`).lerp(b(`bg.indigo`),.35)},uWarm:{value:b(`yellow.light`).lerp(b(`amber`),.25)},uCool:{value:b(`sky`)},uLamp:{value:0},uDots:{value:0},uBalls:{value:0},uOpen:{value:0},uPitch:{value:O},uFade:{value:1},uEye:{value:new t(0,0,ee)},uToCopper:{value:new s},uFromCopper:{value:new s},uKTime:y.uKTime}}),l=new o(n,a);l.name=`wire-core-metal`,l.frustumCulled=!1,e.add(l);let u=a.uniforms,p={group:e,scale:1,surface:.35,dots:0,balls:0,open:0,latticeScale:1,fade:1,lamp:0,warmth:0,eye:u.uEye.value,update(t){e.visible=p.fade>.004&&p.open<.999,e.visible&&(e.scale.setScalar(p.scale),e.position.set(0,0,p.surface-V*p.scale),u.uFromCopper.value.copy(t),u.uToCopper.value.copy(t).invert(),u.uDots.value=p.dots,u.uBalls.value=p.balls,u.uOpen.value=p.open,u.uPitch.value=O*p.latticeScale,u.uFade.value=p.fade,u.uLamp.value=p.lamp,u.uWarmth.value=p.warmth)}};return p}var H=ee,U=(e,t,n)=>({position:[e[0]+t[0],e[1]+t[1],e[2]+t[2]],target:e,fit:n}),re={core:U([0,0,0],[0,0,H],4.6),rows:U([0,0,0],[0,2.4,H],4.6),atom:U([0,0,0],[0,1.5,H],5.4),apart:U([-2.6,0,0],[0,1.5,H],4.8),one:U([0,0,0],[0,.9,H*.5],2.4),pair:U([O/2,0,0],[0,1.1,H*.62],3.6),row:U([0,0,0],[0,1.8,H],7.8),piece:U([0,0,0],[0,2.2,H*1.06],7.8),gate:U([-.6,0,0],[0,2.4,H],6.4),edge:U([0,N+.4,0],[0,1.6,H],4.8),plastic:U([0,N+8.6,0],[0,1.6,H],4.8)},ie=-4.8;function ae(e,n=``){e.updateWorldMatrix(!0,!1);let r=e.matrixWorld.getMaxScaleOnAxis(),i=n=>new t(...n).applyMatrix4(e.matrixWorld).toArray(),a=new t(0,1,0).transformDirection(e.matrixWorld).y<.998;return Object.fromEntries(Object.entries(re).map(([e,t])=>[n+e,{position:i(t.position),target:i(t.target),fov:27,fit:{center:i(t.target),radius:t.fit*r},orbit:{azimuth:a?.03:.3,polar:.16,zoom:[.8,1.25]},drift:a?.4:1}]))}var oe=`
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
}`;function ce(e){let t=e[3]*1.35,n=new c({vertexShader:oe,fragmentShader:se,uniforms:{uColor:{value:b(`cyan`).lerp(b(`cyan.dark`),.35)},uRadii:{value:new p(...e)},uReach:{value:t},uFade:{value:1},uOuter:{value:1},uKTime:y.uKTime},transparent:!0,depthWrite:!1,blending:2,premultipliedAlpha:!0}),r=new o(new l(1,1),n);return r.name=`atom-shells`,r.frustumCulled=!1,r.renderOrder=2,{mesh:r,get fade(){return n.uniforms.uFade.value},set fade(e){n.uniforms.uFade.value=e,r.visible=e>.004},get outer(){return n.uniforms.uOuter.value},set outer(e){n.uniforms.uOuter.value=e}}}var le=`
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
}`;function de(e,t){let i=new r,a=new l(1,1);i.index=a.index,i.setAttribute(`position`,a.getAttribute(`position`));let s=new n(new Float32Array(e*4),4),u=new n(new Float32Array(e),1);i.setAttribute(`aInst`,s),i.setAttribute(`aGlow`,u),i.instanceCount=e;let d=new c({vertexShader:le,fragmentShader:ue,uniforms:{uColor:{value:b(t)},uFade:{value:1},uKTime:y.uKTime},transparent:!0,depthWrite:!1,blending:2,premultipliedAlpha:!0}),f=new o(i,d);return f.name=`soft-dots`,f.frustumCulled=!1,f.renderOrder=3,{mesh:f,get fade(){return d.uniforms.uFade.value},set fade(e){d.uniforms.uFade.value=e,f.visible=e>.004},set(e,t,n,r,i,a){s.setXYZW(e,t,n,r,i),u.setX(e,a)},commit(){s.needsUpdate=!0,u.needsUpdate=!0}}}var W=[{count:2,radius:.27,glow:.95},{count:8,radius:.53,glow:.8},{count:18,radius:.84,glow:.66}],fe=2.15;function pe(e){let n=new i;n.name=`copper-atom`;let r=E({kind:{...D.blob,color:`coral`,shade:`coral.dark`,selfLit:.8,intensity:1.3,glyph:`none`,shimmer:.3,halo:{color:`coral`,size:4.2,strength:.6}},radius:M});r.name=`copper-nucleus`;let a=de(28,`cyan`),o=E({kind:{...D.electron,glyph:`none`,halo:{color:`cyan`,size:3.6,strength:.75}},radius:A*.62});o.name=`copper-outer-electron`;let s=new T({capacity:8,color:`mist`,width:.04,intensity:1,dashStrength:0,base:1,endFade:[0,0],hotCore:.4}),c=ce([W[0].radius,W[1].radius,W[2].radius,j]);n.add(c.mesh,s,a.mesh,r,o);let l=[];W.forEach((n,r)=>{for(let i=0;i<n.count;i++){let a=(i+e.range(-.22,.22))/n.count*Math.PI*2+r*.7,o=e.onSphere();l.push({layer:r,start:new t(Math.cos(a),Math.sin(a),e.range(-.3,.3)).normalize(),axis:new t(o[0]*.16,o[1]*.16,1).normalize(),speed:e.range(.1,.2)*(r%2==0?1:-1),off:new t,now:new t})}});let u=new t(.25,.3,.92).normalize(),d=new t,f=new t,p=new t,m=new t,h=new t,g=new t,_={points:Array.from({length:8},()=>new t),brightness:Array(8).fill(0)},v=0,y=(e,t)=>t.copy(e===28?f:l[e].now),b={group:n,nucleus:r,outer:o,open:1,apart:0,aside:new t(-2.2,0,0),outerShown:1,nucleusShown:1,freed:!1,held:-1,hold(e,t){b.held=e,t&&m.copy(t).sub(n.position)},nearest(e,t,n=.22){let r=-1,i=n;for(let n=0;n<=28;n++){b.electronPosition(n,g).sub(e);let a=g.addScaledVector(t,-g.dot(t)).length();a<i&&(i=a,r=n)}return r},electronPosition:(e,t)=>y(e,t).add(n.position),reset(){b.freed=!1,b.held=-1,d.set(0,0,0);for(let e of l)e.off.set(0,0,0)},update(e,t){let i=F(b.open);if(n.visible=i>.004,!n.visible)return;let x=I(0,1,b.apart);h.copy(b.aside).multiplyScalar(x),l.forEach((n,r)=>{let i=W[n.layer],o=1+.05*Math.sin(t*.9+r*1.3),s=g.copy(n.start).applyAxisAngle(n.axis,t*n.speed).multiplyScalar(i.radius*o).add(h);if(b.held===r){let t=m.clone().sub(s),r=t.length();t.multiplyScalar(.55/(.55+r)),n.off.x=C(n.off.x,t.x,14,e),n.off.y=C(n.off.y,t.y,14,e),n.off.z=C(n.off.z,t.z,14,e)}else n.off.multiplyScalar(Math.exp(-9*e));n.now.copy(s).add(n.off);let c=Math.min(n.off.length()*1.6,1);a.set(r,n.now.x,n.now.y,n.now.z,.15+.05*c,i.glow*(1+.8*c))}),a.fade=i,a.commit(),c.mesh.position.copy(h),c.fade=i,c.outer=b.freed?0:b.outerShown;let S=g.set(.2,.97,0).applyAxisAngle(u,t*.55).multiplyScalar(j).add(h);b.held===28?(d.copy(m).sub(S),m.distanceTo(h)>fe&&(b.freed=!0),p.copy(m)):b.freed?d.copy(p).sub(S):d.multiplyScalar(Math.exp(-5*e)),f.copy(S).add(d),b.freed&&b.held!==28&&(f.x+=.12*Math.sin(t*.7),f.y+=.1*Math.sin(t*.9+1)),o.position.copy(f),o.scale.setScalar(Math.max(b.outerShown*i,.001)),o.visible=b.outerShown*i>.01,r.visible=b.nucleusShown>.5;let w=b.held,T=w<0?0:w===28?b.freed?0:.35:1;if(v=C(v,T,10,e),s.visible=v>.02&&w>=0,s.visible){y(w,g);let e=w===28?1-F(g.length()/fe)**2:1;_.points.forEach((t,n)=>{let r=n/(_.points.length-1);t.copy(g).multiplyScalar(r),_.brightness[n]=v*i*e*(1-.6*r)}),s.setLines([_])}}};return b}var me=`
varying vec3 vWorld;
varying vec3 vLocal;
void main() {
  vLocal = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,he=`
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
}`;function ge(){let e=new i;e.name=`copper-backdrop`;let n=e=>({uDeep:{value:b(`bg.deep`).lerp(b(`bg.indigo`),.35)},uVoid:{value:b(`bg.void`)},uWarm:{value:b(`yellow.light`).lerp(b(`amber`),.25)},uCool:{value:b(`sky`)},uUp:r.uUp,uRight:r.uRight,uLamp:r.uLamp,uAlpha:{value:1},uVeil:{value:e},uKTime:y.uKTime}),r={uUp:{value:new t(0,1,0)},uRight:{value:new t(1,0,0)},uLamp:{value:0}},s=e=>new c({vertexShader:me,fragmentShader:he,uniforms:n(e),transparent:!0,depthWrite:!1,side:e?2:1}),u=s(0),d=new o(new a(300,32,20),u);d.name=`copper-dome`,d.renderOrder=-20,d.frustumCulled=!1,e.add(d);let f=s(1),p=new i;p.name=`copper-veils`;let m=new l(260,160);for(let e=0;e<3;e++){let t=new o(m,f);t.position.z=-(e*k+.85),t.renderOrder=-10+e*-1,t.name=`copper-veil-${e}`,p.add(t)}return{group:e,sheets:p,get lamp(){return r.uLamp.value},set lamp(e){r.uLamp.value=e},get dome(){return u.uniforms.uAlpha.value},set dome(e){u.uniforms.uAlpha.value=e,d.visible=e>.003},get veils(){return f.uniforms.uAlpha.value},set veils(e){f.uniforms.uAlpha.value=e,p.visible=e>.003},up:r.uUp.value,right:r.uRight.value}}var G=1+A*1.15;function _e(e){let t=new Map,n=(e,t,n)=>(e*128+(t+64))*128+(n+64);return e.forEach((e,r)=>t.set(n(e.plane,e.i,e.j),r)),(e,r,i)=>t.get(n(e,r,i))??-1}function K(e,t,n,r,i){let a=3*t,o=e[a]*n+e[a+1]*r+e[a+2]*i;o>=0||(e[a]=e[a]-2*o*n,e[a+1]=e[a+1]-2*o*r,e[a+2]=e[a+2]-2*o*i)}function ve(e,t,n,r){let i=3*n,a=Math.round(-e[i+2]/k),o=-1;for(let s=Math.max(a-1,0);s<=Math.min(a+1,3);s++){let a=s%2==1?O/2:0,c=Math.round((e[i]-a)/O),l=Math.round((e[i+1]-a)/O),u=r.at(s,c,l);if(u<0||r.presence(u)<.5)continue;let d=r.sites[u].p,f=e[i]-d.x,p=e[i+1]-d.y,m=e[i+2]-d.z,h=Math.hypot(f,p,m);if(h>=G||h<1e-6)continue;let g=f/h,_=p/h,v=m/h;e[i]=d.x+g*G,e[i+1]=d.y+_*G,e[i+2]=d.z+v*G,K(t,n,g,_,v),o=u}return o}function ye(e,t,n,r,i,a){let o=3*n,s=1/0,c=0,l=0,u=0;for(let t=0;t<i;t++){if(r.presence(t)<.5)continue;let n=r.sites[t].p,i=Math.hypot(e[o]-n.x,e[o+1]-n.y,e[o+2]-n.z);i<s&&(s=i,c=n.x,l=n.y,u=n.z)}if(s===1/0||s<=a)return;let d=(c-e[o])/s,f=(l-e[o+1])/s,p=(u-e[o+2])/s;e[o]=c-d*a,e[o+1]=l-f*a,e[o+2]=u-p*a,K(t,n,d,f,p)}function be(e,t,n,r=0){let i=3*n,a=N-.2-r;e[i+1]<=a||(e[i+1]=a,K(t,n,0,-1,0))}function xe(e,t,n,r,i){let a=3*n;e[a+2]<r?(e[a+2]=r,K(t,n,0,0,1)):e[a+2]>i&&(e[a+2]=i,K(t,n,0,0,-1))}var Se=.85;function Ce(e,t,n,r){let i=Math.min(Math.max(r,-.85),Se);if(i===0||n<=0)return e;let a=Math.sign(i),o=(e-t)/n*a;if(o<=-1||o>=1)return e;let s=1+1.6*Math.abs(i);return t+a*n*(1-2*((1-o)/2)**s)}function we(e,t,n,r,i,a,o){let s=3*n,c=t[s]*r-i*a,l=t[s+1]*r,u=t[s+2]*r,d=Math.max(Math.hypot(c,l,u),1e-6);t[s]=c/d,t[s+1]=l/d,t[s+2]=u/d;let f=Math.min(d,o);return e[s]=e[s]+t[s]*f*a,e[s+1]=e[s+1]+t[s+1]*f*a,e[s+2]=e[s+2]+t[s+2]*f*a,f}function Te(e,t,n,r,i){let a=3*n;for(let n of[0,1]){let o=e[a+n]-(n===0?r.x:r.y);Math.abs(o)>.45*i[n]&&o*t[a+n]>0&&(t[a+n]=-t[a+n])}}var q=[15.5,8.6],J=[21,11.5],Y=[-.75,1.7],Ee=[6.4,3.5],De=2.4,Oe=(e,t)=>Math.abs(e)<=t?e:e-2*t*Math.round(e/(2*t));function ke(e,t){let n=new Float32Array(228),r=new Float32Array(228),i=new Float32Array(228),a=new Float32Array(76),o=new Float32Array(76),s=new Float32Array(76),c=new Float32Array(76),l=new Float32Array(152),u=!1,d=0,f=Array.from({length:76},()=>{let[t,n,r]=e.onSphere(),i=Math.hypot(n,t)||1,a=[n/i,-t/i,0];return{u:a,v:[n*a[2]-r*a[1],r*a[0]-t*a[2],t*a[1]-n*a[0]],phase:e.range(0,6.28),w:e.range(1.7,2.6)*(e.next()<.5?-1:1)}}),p=t=>{let[n,r,a]=e.onSphere(),o=1/Math.hypot(n,r,a*.3);i.set([n*o,r*o,a*.3*o],3*t)},m=()=>{for(let t=0;t<76;t++){let n=t>=32,i=n?J:q;o[t]=n?e.range(.25,1):0;let l=n?-k*(.6+3.2*o[t]):e.range(Y[0],Y[1]);r.set([e.range(-i[0],i[0]),e.range(-i[1],i[1]),l],3*t),s[t]=e.range(.75,1.25),c[t]=e.range(0,.6),a[t]=0,p(t)}};m();let h={count:76,pos:n,shown:a,depthOf:o,speed:12,drift:0,leash:0,box:{x:q[0],y:q[1]},shared:1,surface:0,width:q[0],piece:32,centre:{x:0,y:0},lean:0,leanSpan:7.5,gate:{on:!1,x:0,y:0,half:2.4,left:0,right:0,last:-1,balance:0,turned:0},followed:-1,field:0,restart:7,get runSpeed(){return d},onHit:null,nearest(e,t){let r=-1,i=1/0;for(let o=0;o<32;o++){let s=Math.hypot(n[3*o]-e,n[3*o+1]-t);a[o]>.5&&s<i&&(i=s,r=o)}return r},reset:m,step(o,m){let g=h.piece>=32,_=F(h.shared),v=g?h.leash:0;if(v>0&&!u)for(let e=0;e<76;e++)l.set([r[3*e],r[3*e+1]],2*e);u=v>0;for(let y=0;y<76;y++){let b=3*y,x=y>=32,S=x?+!!g:g?1:t.presence(y),C=a[y];a[y]=C+(S-C)*Math.min(o*6,1);let w=t.sites[Math.min(y,t.sites.length-1)].p,T=f[y],E=T.phase+m*T.w,D=Math.cos(E)*j,A=Math.sin(E)*j,M=w.x+T.u[0]*D+T.v[0]*A,N=w.y+T.u[1]*D+T.v[1]*A,P=w.z+.55*(T.u[2]*D+T.v[2]*A);if(!x&&(_<.02||!g&&C<.05))r.set([M,N,P],b);else if(a[y]>.02||g){let n=r[b],a=y===h.followed&&h.field>0&&!x;a?d=we(r,i,y,d||h.speed*s[y],h.field,o,De*h.restart):y===h.followed&&(d=0);let f=h.speed*s[y]*o*(x?.8:1);if(a||(r[b]=n+i[b]*f+h.drift*h.speed*o,r[b+1]=r[b+1]+i[b+1]*f,r[b+2]=r[b+2]+i[b+2]*f),!a&&m>=c[y]&&(p(y),c[y]=m+.18-.42*Math.log(1-e.next()*.98)),u){l[2*y]=l[2*y]+h.drift*h.speed*o;let e=r[b]-l[2*y],t=r[b+1]-l[2*y+1],n=Math.hypot(e,t),s=(i[b]*e+i[b+1]*t)/(n||1);n>v&&s>0&&!a&&(i[b]=i[b]-2*s*e/n,i[b+1]=i[b+1]-2*s*t/n)}let _=x?0:h.surface;_>0&&y%4!=0&&(r[b+1]=r[b+1]+_*h.speed*.6*o);let S=ve(r,i,y,t);if(S>=0&&(a&&(d=h.restart,Te(r,i,y,h.centre,Ee)),x||h.onHit?.(y,S)),be(r,i,y,_<0&&y%4!=0?-_*O:0),x?xe(r,i,y,-k*4.2,-k*.6):xe(r,i,y,Y[0],Y[1]),!g&&!x)ye(r,i,y,t,Math.ceil(h.piece),j+.75);else if(y===h.followed)for(let e of[0,1]){let t=r[b+e]-(e===0?h.centre.x:h.centre.y);Math.abs(t)>Ee[e]&&t*i[b+e]>0&&(i[b+e]=-i[b+e])}else{let e=x?J[0]:h.width===q[0]?h.box.x:h.width,t=x?J[1]:h.box.y,n=(u?l[2*y]:r[b])-h.centre.x,i=(u?l[2*y+1]:r[b+1])-h.centre.y,a=Oe(n,e)-n,o=Oe(i,t)-i;r[b]=r[b]+a,r[b+1]=r[b+1]+o,u&&(l[2*y]=l[2*y]+a,l[2*y+1]=l[2*y+1]+o)}let C=h.gate;if(C.on&&!x&&Math.abs(r[b+1]-C.y)<C.half&&Math.abs(r[b]-n)<2){let t=r[b],a=n<C.x&&t>=C.x?1:n>=C.x&&t<C.x?-1:0,o=(C.right-C.left)*a;a!==0&&o>0&&e.next()<.5*C.balance*o*o?(p(y),i[b]=-a*Math.abs(i[b]),r[b]=2*C.x-t,c[y]=m+.18-.42*Math.log(1-e.next()*.98),C.turned++):a!==0&&(a>0?C.right++:C.left++,C.last=y)}}n[b]=M+(r[b]-M)*(x?1:_),h.lean!==0&&(n[b]=Ce(n[b],h.centre.x,h.leanSpan,h.lean)),n[b+1]=N+(r[b+1]-N)*(x?1:_),n[b+2]=P+(r[b+2]-P)*(x?1:_)}}};return h}var Ae=`
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
}`,je=`
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
}`;function Me(e){let t=new r,i=new l(1,1,6,1);t.index=i.index,t.setAttribute(`position`,i.getAttribute(`position`));let a=new n(new Float32Array(e*4),4),s=new n(new Float32Array(e*4),4);t.setAttribute(`aHead`,a),t.setAttribute(`aTail`,s),t.instanceCount=e;let u=new c({vertexShader:Ae,fragmentShader:je,uniforms:{uColor:{value:b(`cyan`)},uDim:{value:b(`cyan.dark`).lerp(b(`cyan`),.35)},uFade:{value:1}},side:2}),d=new o(t,u);return d.name=`electron-streaks`,d.frustumCulled=!1,{mesh:d,get fade(){return u.uniforms.uFade.value},set fade(e){u.uniforms.uFade.value=e,d.visible=e>.02},set(e,t,n,r,i,o,c,l,u){a.setXYZW(e,t,n,r,l),s.setXYZW(e,i,o,c,u)},commit(){a.needsUpdate=!0,s.needsUpdate=!0}}}var Ne=.11,X=2.4,Pe=48,Fe=3;function Ie(e){let n=e.count,r=new i;r.name=`copper-electrons`;let a=E({kind:{...D.electron,glyph:`none`,halo:{color:`cyan`,size:3.4,strength:.55}},count:n,radius:A,instanceColors:!0}),s=Me(n),c=new T({capacity:96,color:`cyan.light`,width:A*.55,intensity:.95,dashStrength:0,base:1,endFade:[0,0],hotCore:.3}),l=new o(new h(A*2.5,A*2.95,48),w.glow({color:`white`,intensity:1.5,falloff:0,edge:0}));l.name=`electron-mark`,r.add(s.mesh,c,a,l),S(c),S(l);let u=Array.from({length:n},()=>({prev:new t,corner:new t,dir:new t,speed:0})),d=[],f=Array.from({length:Pe},()=>({points:[new t,new t],brightness:[0,0]})),p=!1,m=-1,g=0,_=new t,v=new t,y=new t,b=e=>Math.max(1-(g-e)/X,0)**1.3,x={group:r,orbs:a,marked:-1,fade:1,crowd:1,bend:0,positionOf:(t,n)=>n.fromArray(e.pos,3*t),cut:()=>p=!1,update(t,r){let i=x.marked;i!==m&&(d.length=0),m=i,g+=t;for(let r=0;r<n;r++){v.fromArray(e.pos,3*r);let n=u[r],o=y.subVectors(v,n.prev).length();!p||o>Fe?(n.corner.copy(v),n.speed=0,r===i&&(d.length=0)):t>0&&o>1e-5&&(y.multiplyScalar(1/o),n.speed>0&&y.dot(n.dir)<.96?(n.corner.copy(n.prev),r===i&&d.push({p:n.prev.clone(),at:g-t}),_.copy(y)):r===i&&x.bend>0&&n.speed>0&&y.dot(_)<Math.cos(x.bend)&&(d.push({p:n.prev.clone(),at:g-t}),_.copy(y)),n.dir.copy(y),n.speed=o/t),n.prev.copy(v);let c=Math.min(n.speed*Ne,n.corner.distanceTo(v));y.copy(v).addScaledVector(n.dir,-c);let l=e.depthOf[r],f=e.shown[r],m=r===i,h=m?1.5:x.crowd*L(1,.34,l);a.setPosition(r,v.x,v.y,v.z,f*(m?1.25:L(1,.8,l))),a.setInstanceColor(r,m?`white`:`cyan`,h);let b=f*(m?1.25:L(1,.8,l));s.set(r,v.x,v.y,v.z,y.x,y.y,y.z,A*.9*b,c>.05?Math.min(h,1.2):0)}if(p=!0,a.commit(),a.fade=x.fade,s.commit(),s.fade=x.fade,c.visible=x.fade>.5,l.visible=i>=0&&x.fade>.5,i>=0){for(x.positionOf(i,v),l.position.copy(v),l.quaternion.copy(r.quaternion),l.scale.setScalar(e.shown[i]);d.length>1&&d[1].at<g-X;)d.shift();for(;d.length>=Pe;)d.shift();let t=d.length;for(let e=0;e<t;e++){let n=d[e],r=e+1<t?d[e+1].p:v,i=e+1<t?d[e+1].at:g,a=f[e],o=Math.min(Math.max((g-X-n.at)/Math.max(i-n.at,1e-4),0),1);a.points[0].lerpVectors(n.p,r,o),a.points[1].copy(r),a.brightness[0]=b(n.at+(i-n.at)*o),a.brightness[1]=b(i)}c.setLines(f.slice(0,t))}else c.setLines([])}};return x}var Z=[-1.15,3];function Le(n){let r=new i;r.name=`counter-frame`;let a=new i,s=w.glow({color:`teal`,intensity:1.45,whiten:0,keepHue:!0}),c=w.glass({color:`teal`,opacity:.13,edgeOpacity:.32,specular:0}),u=null,d=null,f=-1,p=e=>{u&&(a.remove(u),u.geometry.dispose()),d&&(a.remove(d),d.geometry.dispose());let n=.45,r=[],i=(e,i,a)=>{for(let o=0;o<=6;o++){let s=a+o/6*(Math.PI/2);r.push(new t(0,e+Math.cos(s)*n,i+Math.sin(s)*n))}};i(e-n,Z[1]-n,0),i(-e+n,Z[1]-n,Math.PI/2),i(-e+n,Z[0]+n,Math.PI),i(e-n,Z[0]+n,Math.PI*1.5),u=new o(new g(new m(r,!0,`catmullrom`,.1),160,.07,8,!0),s),d=new o(new l(Z[1]-Z[0]-.1,2*e-.1),c),d.rotation.y=Math.PI/2,d.position.z=(Z[0]+Z[1])/2,a.add(u,d),f=e},_=e=>{let t=new x(`0`,{font:`display`,size:46,color:`white`,anchorX:e,anchorY:`bottom`,billboard:!0,screenSpace:!0,rich:!1});return S(t),t},v=_(`right`),y=_(`left`);r.add(a,v,y);let b=new h(.36,.44,40);b.rotateY(Math.PI/2);let T=Array.from({length:5},()=>{let e=w.glow({color:`teal`,intensity:0,whiten:.2,keepHue:!0}),t=new o(b,e);return t.visible=!1,r.add(t),{mesh:t,material:e,age:1}}),E=0,D=new t,O=0,k=0,A=0,j={left:0,right:0},M={left:0,right:0},N={group:r,shown:0,numbers:!0,leftAnchor:new e,rightAnchor:new e,update(e){let t=n.gate;if(O=C(O,N.shown,9,e),r.visible=O>.01,!r.visible)return;if(t.half!==f&&p(t.half),r.position.set(t.x,t.y,0),a.scale.setScalar(O),t.left+t.right!==A&&(A=t.left+t.right,k=1,t.last>=0)){let e=T[E++%T.length];e.mesh.position.set(0,n.pos[3*t.last+1]-t.y,n.pos[3*t.last+2]),e.age=0}k=C(k,0,7,e),s.intensity=1.45+.9*k;for(let t of T)t.age+=e/.45,t.mesh.visible=t.age<1,t.mesh.scale.setScalar(.35+1.1*Math.sqrt(Math.min(t.age,1))),t.material.intensity=1.6*(1-t.age)**2;let i=t.half+.4,o=(Z[0]+Z[1])/2;N.leftAnchor.position.set(-.85,i,o),N.rightAnchor.position.set(.85,i,o),v.position.copy(N.leftAnchor.position),y.position.copy(N.rightAnchor.position),v.visible=y.visible=N.numbers&&O>.6,t.left!==j.left&&(M.left=+(t.left>j.left)),t.right!==j.right&&(M.right=+(t.right>j.right)),j.left=t.left,j.right=t.right,M.left=C(M.left,0,6,e),M.right=C(M.right,0,6,e);let c=r.getWorldScale(D).x;v.scale.setScalar((1+.28*M.left)/c),y.scale.setScalar((1+.28*M.right)/c);let l=`← ${t.left}`,u=`${t.right} →`;v.text!==l&&(v.text=l),y.text!==u&&(y.text=u)}};return r.add(N.leftAnchor,N.rightAnchor),N}var Q=1.6,Re=`
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
}`,ze=`
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
}`;function Be(e){let t=new r,i=new l(1,1);t.index=i.index,t.setAttribute(`position`,i.getAttribute(`position`));let a=new n(new Float32Array(e*4),4);t.setAttribute(`aInst`,a),t.instanceCount=e;let s=new c({vertexShader:Re,fragmentShader:ze,uniforms:{uColor:{value:b(`cyan.dark`).lerp(b(`cyan`),.2)},uHot:{value:b(`orange`)},uAmount:{value:1},uHeat:{value:0}},transparent:!0,depthWrite:!1,blending:1,side:2}),u=new o(t,s);return u.name=`copper-haze`,u.frustumCulled=!1,u.renderOrder=2,{mesh:u,get amount(){return s.uniforms.uAmount.value},set amount(e){s.uniforms.uAmount.value=e,u.visible=e>.004},get heat(){return s.uniforms.uHeat.value},set heat(e){s.uniforms.uHeat.value=e},set:(e,t,n,r,i)=>a.setXYZW(e,t,n,r,i),commit:()=>a.needsUpdate=!0}}var Ve={...D.blob,color:`coral`,shade:`coral.dark`,selfLit:0,gloss:0,rim:.55,glyph:`none`},He=e=>1+2.7*(e-1)**3+1.7*(e-1)**2;function Ue(){let e=new i;e.name=`copper-lattice`;let t=P(),n=t.length,r=E({kind:Ve,count:n-1,radius:1,instanceColors:!0,halo:!1}),a=E({kind:Ve,count:1,radius:1,instanceColors:!0,halo:!1});r.name=`copper-atoms`,a.name=`copper-hero-atom`;let o=Be(n);e.add(r,a,o.mesh);let s=new Float32Array(n),c=new Float32Array(n),l=new Float32Array(n),u=new Float32Array(n),d=!1,f=t.map(e=>e.p.clone()),p=b(`coral`),m=b(`bg.indigo`).lerp(b(`coral.dark`),.45),h=b(`orange`),g=b(`coral`).lerp(b(`white`),.35),_=p.clone(),v={group:e,sites:t,atoms:r,hero:a,haze:o,reveal:n,tremble:.05,heat:0,edge:0,color:p,fade:1,heroShrink:0,others:1,recede:1,hazeAmount:1,selected:-1,heroSite:0,touch:e=>c[e]=1,kick(e,t,r){e<0||e>=n||(l[e]=Math.max(l[e],t),u[e]=Math.max(u[e],r),d=!0)},siteAt(e){let r=-1,i=1.25;for(let a=0;a<n&&t[a].plane===0;a++){let t=f[a].distanceTo(e);t<i&&s[a]>.5&&(i=t,r=a)}return r},positionOf:(e,t)=>t.copy(f[e]),presence:e=>s[e],update(i,y){let b=v.tremble*(1+3.8*v.heat),x=t[v.heroSite]?.plane===0?v.heroSite:0,S=t[x].p;for(let e=0;e<n;e++){let n=t[e];s[e]=C(s[e],F(v.reveal-e),10,i);let w=e===v.selected?.5:0;c[e]=C(c[e],w,3.2,i);let T=c[e],E=He(s[e])*(1+.1*T+.08*Math.sin(Math.PI*Math.min(T*1.4,1))),D=5.3+e%7*.37,O=0,k=0;d&&(l[e]=l[e]*Math.exp(-i/.24),u[e]=u[e]*Math.exp(-i/.45),O=u[e],k=l[e]);let A=f[e].set(n.p.x+b*Math.sin(y*D+e*1.7)+O*Math.sin(y*23+e*1.3),n.p.y+b*Math.sin(y*D*1.13+e*2.3)+O*Math.sin(y*19.7+e*2.9),n.p.z+b*Math.sin(y*D*.91+e*.9)),j=v.recede*(1-.72**n.plane);_.copy(p).lerp(m,j).lerp(h,.35*v.heat*(1-j));let N=n.p.y>12.48?v.edge*(.82+.18*Math.sin(y*1.9+e*1.3)):0;N>0&&_.lerp(g,.45*N),k>.002&&_.lerp(h,Math.min(1.15*k,1));let P=L(1,.56,j)+.5*c[e]+1*N*(1-j)+.22*k;if(e===x){let t=L(1,M/1,I(0,1,v.heroShrink));a.setPosition(0,A.x,A.y,A.z,Math.max(E,0)*t),a.setInstanceColor(0,_,P+.25*v.heroShrink);let n=(1+2.4*T)*(1-I(0,.5,v.heroShrink));o.set(e,A.x,A.y,A.z,Math.max(E,0)*n);continue}let R=.15+.7*Math.min(Math.hypot(n.p.x-S.x,n.p.y-S.y)/16,1),z=v.others>=1?1:F(v.others*(1+R)-R),B=e>x?e-1:e;r.setPosition(B,A.x,A.y,A.z,Math.max(E,0)*Math.sqrt(z)),r.setInstanceColor(B,_,P),o.set(e,A.x,A.y,A.z,Math.max(E,0)*(1-j)**3*z*(1+2.4*T))}r.commit(),a.commit(),r.fade=a.fade=v.fade,r.visible=v.others>.004,a.visible=v.heroShrink<.995,o.amount=v.hazeAmount*v.fade,o.heat=v.heat,o.commit(),e.visible=v.fade>.004}};return v}var We=`
varying vec2 vP;
varying float vDiag;
void main() {
  // the aspect ratio of the viewport is in the projection matrix; work in units of half the frame height
  float aspect = projectionMatrix[1][1] / projectionMatrix[0][0];
  vP = position.xy * 2.0 * vec2(aspect, 1.0);
  vDiag = length(vec2(aspect, 1.0));
  gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
}`,Ge=`
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
}`;function Ke(){let e=new c({vertexShader:We,fragmentShader:Ge,uniforms:{uColor:{value:b(`cyan`)},uDark:{value:b(`bg.void`)},uOpen:{value:.97},uAmount:{value:1}},transparent:!0,depthTest:!1,depthWrite:!1,blending:1}),t=new o(new l(1,1),e);return t.name=`lens-rim`,t.frustumCulled=!1,t.renderOrder=50,S(t),{mesh:t,get amount(){return e.uniforms.uAmount.value},set amount(n){e.uniforms.uAmount.value=n,t.visible=n>.004},get open(){return e.uniforms.uOpen.value},set open(t){e.uniforms.uOpen.value=t}}}var qe=.9,Je=2.7,Ye=[{y:2.1,z:0},{y:4.6,z:-2.6},{y:6.7,z:0},{y:8.8,z:-2.6},{y:10.9,z:0},{y:13,z:-2.6},{y:15.1,z:0}],Xe=10;function Ze(e){let n=new i;n.name=`plastic-sheath`;let r=[],a=[];Ye.forEach((n,i)=>{let o=null,s=e.range(0,6.28);for(let e=-10;e<=Xe;e++){let c=e*Je+i%3*.7,l=N+n.y+(e%2==0?.42:-.42)+.55*Math.sin(c*.33+s),u=new t(c,l,n.z+.35*Math.sin(c*.21+s*2));r.push({p:u,deep:n.z<-1}),o&&a.push([o,u]),o=u}});let o=E({kind:{...D.blob,color:`violet`,shade:`violet.dark`,selfLit:0,gloss:0,rim:.5,glyph:`none`},count:r.length,radius:qe,instanceColors:!0,halo:!1});o.name=`plastic-atoms`,r.forEach(({p:e,deep:t},n)=>{o.setPosition(n,e.x,e.y,e.z),o.setInstanceColor(n,t?`violet.dark`:`violet`,t?.7:1)}),o.commit();let c=w.toon({color:`violet.dark`}),l=new v(new _(.2,.2,1,10,1,!0),c,a.length);l.name=`plastic-bonds`;let d=new s,f=new u,p=new t(0,1,0),m=new t;a.forEach(([e,n],r)=>{m.subVectors(n,e);let i=m.length();f.setFromUnitVectors(p,m.normalize()),d.compose(e.clone().add(n).multiplyScalar(.5),f,new t(1,i,1)),l.setMatrixAt(r,d)}),l.frustumCulled=!1;let h=r.filter(e=>!e.deep).map(({p:n})=>{let r=e.range(0,6.28),i=new t(Math.cos(r),Math.sin(r)*.8,e.range(.15,.6)).normalize();return{home:n,dir:i,side:new t(-i.y,i.x,0).normalize(),rate:e.range(2.4,4.2),phase:e.range(0,6.28)}}),g=E({kind:{...D.electron,glyph:`none`,intensity:.95,halo:{color:`cyan`,size:3,strength:.4}},count:h.length,radius:A});g.name=`plastic-electrons`;let y=new T({capacity:h.length*2,color:`cyan`,width:.11,intensity:.95,dashStrength:0,base:1,endFade:[0,0],hotCore:0,keepHue:!0}),b=h.map(()=>({points:[new t,new t],brightness:[.35,1]}));n.add(l,o,y,g);let x={group:n,atoms:o,electrons:g,fade:1,update(e){n.visible=x.fade>.004,n.visible&&(h.forEach((t,n)=>{let r=.5*Math.sin(e*t.rate+t.phase),i=1.4+.16*Math.sin(e*t.rate*1.7+t.phase*2),a=b[n].points[1].copy(t.dir).addScaledVector(t.side,r).normalize().multiplyScalar(i).add(t.home);b[n].points[0].copy(a).sub(t.home).setLength(qe*.96).add(t.home),g.setPosition(n,a.x,a.y,a.z)}),g.commit(),y.setLines(b),o.fade=g.fade=c.fade=x.fade,y.visible=x.fade>.5)}};return x}var Qe=2.35,$=[[0,.03],[.7,.62],[1,1]],$e=.064,et=[1.06,1.5];function tt(e){let t=Math.max(e,0);for(let e=1;e<$.length;e++){let[n,r]=$[e],[i,a]=$[e-1];if(t<=n)return a*(r/a)**+((t-i)/(n-i))}return 1}function nt(e){let t=new i;t.name=`copper-world`;let n=new i;n.name=`copper-space`;let r=Ue(),a=ke(e.random.fork(`copper-electrons`),{sites:r.sites,at:_e(r.sites),presence:e=>r.presence(e)}),o=Ie(a),c=pe(e.random.fork(`copper-atom`)),l=Ze(e.random.fork(`plastic`)),d=Le(a),f=ge(),p=Ke(),m=ne();n.add(f.sheets,r.group,l.group,o.group,c.group,d.group),t.add(f.group,m.group,n,p.mesh);let h=new u,g=new s,_={quaternion:h},v=r.sites.length,y=v,b=40,x=!0,S=1,C={group:t,space:n,lattice:r,sim:a,electrons:o,atom:c,plastic:l,gate:d,backdrop:f,core:m,rim:p,depth:1,lamp:0,atoms:1/0,growSeconds:1.1,hero:0,look:{x:0,y:0},marked:-1,heroPosition:e=>n.localToWorld(e.copy(r.sites[r.heroSite].p)),markNearest(e=C.look.x,t=C.look.y){return C.marked=a.nearest(e,t)},toLocal:e=>n.worldToLocal(e),localRay(e,t){return g.copy(n.matrixWorld).invert(),t.origin.copy(e.origin).applyMatrix4(g),t.direction.copy(e.direction).transformDirection(g),t},snap(){x=!0,o.cut()},update(i,s){let u=C.depth,p=u<1?tt(u):Qe**(Math.min(u,2)-1);n.scale.setScalar(p),m.scale=p/$[0][1],m.latticeScale=p,m.eye.copy(e.camera.camera.position).applyMatrix4(g.copy(t.matrixWorld).invert()),m.dots=I(.05,.4,u),m.balls=I(.26,.7,u),m.open=I(.72,.9,u),m.fade=1,m.lamp=C.lamp,m.warmth=.55*I(.02,.34,u),m.update(t.matrixWorld),f.dome=I(.02,.22,u),f.lamp=C.lamp,f.up.set(0,1,0).transformDirection(t.matrixWorld),f.right.set(1,0,0).transformDirection(t.matrixWorld);let w=r.sites[C.hero]?.plane===0?C.hero:0,T=r.sites[w].p;r.heroSite=w;let E=p*I(1,1.45,u);n.position.set(-T.x*E,-T.y*E,0);let D=Math.min(C.atoms,r.sites.length);D!==y&&(y=D,b=Math.max(40,Math.abs(D-v)/Math.max(C.growSeconds,.001)));let O=x?1/0:b*i;v+=Math.min(Math.max(D-v,-O),O),r.reveal=v,r.heroShrink=I(1.05,1.68,u),r.others=1-Math.min(Math.max((u-1.06)/.62,0),1),r.fade=I(.54,.7,u);let k=$e+.9359999999999999*I(et[0],et[1],u);f.veils=u>.7?(1-Math.cbrt(k))/(1-Math.cbrt($e)):0,l.fade=r.others*I(.9,1,u),o.fade=I(.6,.8,u)*(1-I(1.1,1.4,u)),o.marked=a.followed=C.marked,S=x?C.marked>=0?.6:1:S+((C.marked>=0?.6:1)-S)*Math.min(i*4,1),o.crowd=S,c.open=I(1.05,1.25,u),c.outerShown=I(1.25,1.55,u),c.nucleusShown=+(u>=1.65),c.group.position.copy(T),a.piece=Math.min(Math.ceil(v),32),a.centre.x=C.look.x,a.centre.y=Math.min(C.look.y,N-8.2),x=!1,r.update(i,s),c.update(i,s),l.update(s),o.fade>.004&&a.step(i,s),d.update(i),t.getWorldQuaternion(h).invert().multiply(e.camera.camera.quaternion),o.group.visible=o.fade>.004,o.group.visible&&o.update(i,_)}};return C}var rt=.35;function it(e,n){let r=new t(...n.axis).normalize(),i=new t(...n.view).normalize().negate(),a=new t().crossVectors(i,r).normalize();r.crossVectors(a,i);let o=n.coreRadius/V;return e.quaternion.setFromRotationMatrix(new s().makeBasis(r,a,i)),e.scale.setScalar(o),e.position.set(...n.point).addScaledVector(i,-(rt-V)*o),e.updateMatrixWorld(!0),o}function at(e,n){let r=Math.min(Math.max(e,0),1),i=b(`sky`).lerp(b(`white`),.6),a=b(`yellow.light`).lerp(b(`white`),.45),o=(e,r,i)=>{let a=new t(e,r,i).normalize();return n&&a.transformDirection(n.matrixWorld),a.toArray()},s=-.3+.55*r;return{sunDir:o(s,.9,.4),keyColor:i.lerp(a,r),keyIntensity:.8+.2*r,fillSky:new d(.3,.3,.66).lerp(new d(.5,.4,.62),r),fillGround:new d(.2,.15,.48),fillIntensity:.92,rimColor:r>.5?`yellow.light`:`sky`,rimIntensity:.35+.7*r,rimDir:o(s*.8,.75,-.6),bokeh:0,motes:0,fogDensity:0}}function ot(e,t=1){let n=e<.5;return{dofAperture:n?.12:5,dofRange:.45*t,dofMaxBlur:20,dofReference:2.2*6*t,bloomIntensity:1,aoIntensity:n?0:.3,aoRadius:.35*t,vignette:.55}}export{de as a,ae as c,O as d,k as f,nt as i,N as l,ot as n,re as o,it as r,ie as s,at as t,A as u};