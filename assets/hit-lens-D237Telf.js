import{N as e,Z as t,h as n,ht as r,vt as i}from"./three-CPWimilo.js";import{l as a}from"./palette-BNfOQQfI.js";import"./style-BfWUdciT.js";var o={from:160*Math.PI/180,to:20*Math.PI/180,inner:.468,outer:.515},s=950,c=.9,l=`
varying vec2 vP;
void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,u=`
uniform float uFill;
uniform float uPulse;
uniform float uShown;
uniform float uLight;
uniform vec3 uTrack;
uniform vec3 uHot;
varying vec2 vP;
const float FROM = ${o.from.toFixed(5)};
const float SPAN = ${(o.from-o.to).toFixed(5)};
void main() {
  // share of the arc from its left end (0) to its right end (1)
  float a = atan(vP.y, vP.x);
  float s = clamp((FROM - a) / SPAN, 0.0, 1.0);
  float r = length(vP);
  float mid = (r - ${o.inner.toFixed(4)}) / ${(o.outer-o.inner).toFixed(4)};
  // rounded ends and soft long edges
  float edge = smoothstep(0.0, 0.18, mid) * smoothstep(1.0, 0.82, mid);
  float w = fwidth(s) * 1.5;
  float on = 1.0 - smoothstep(uFill - w, uFill + w, s);
  vec3 c = mix(uTrack * 0.55, uHot * (1.0 + 0.55 * uPulse), on);
  float alpha = mix(0.55, 1.0, on) * edge * uShown;
  gl_FragColor = vec4(c * mix(0.55, 1.0, uLight), alpha);
}`,d=`
uniform float uFrost;
uniform float uLight;
uniform vec3 uTint;
varying vec2 vP;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
}
void main() {
  float r = length(vP) / ${.39.toFixed(4)};
  // ground glass: a fine grain and a milky veil, a little brighter toward the upper left where the light falls
  float grain = noise(vP * 160.0) * 0.6 + noise(vP * 52.0) * 0.4;
  float sheen = 0.5 + 0.5 * dot(normalize(vP + 1e-4), normalize(vec2(-0.6, 0.8))) * smoothstep(0.2, 1.0, r);
  vec3 c = uTint * (0.5 + 0.14 * grain + 0.16 * sheen) * mix(0.45, 0.85, uLight);
  // denser toward the rim, as ground glass seen at a slant; still a veil, not a lid
  float alpha = uFrost * (0.86 + 0.06 * grain + 0.08 * r * r) * smoothstep(1.0, 0.96, r);
  gl_FragColor = vec4(c, alpha);
}`;function f(){let f=new e;f.name=`hit-lens`;let p=new i({uniforms:{uFill:{value:0},uPulse:{value:0},uShown:{value:0},uLight:{value:1},uTrack:{value:a(`slate`)},uHot:{value:a(`orange`)}},vertexShader:l,fragmentShader:u,transparent:!0,depthWrite:!1}),m=new t(new r(o.inner,o.outer,96,1,o.to,o.from-o.to),p);m.name=`hit-lens:strip`,m.position.z=.012,m.renderOrder=s;let h=new i({uniforms:{uFrost:{value:0},uLight:{value:1},uTint:{value:a(`mist`).lerp(a(`sky`),.25)}},vertexShader:l,fragmentShader:d,transparent:!0,depthWrite:!1}),g=new t(new n(.39,64),h);g.name=`hit-lens:frost`,g.position.z=.04,g.renderOrder=s;let _=new i({uniforms:{uAmount:{value:0},uHot:{value:a(`orange`)}},vertexShader:l,fragmentShader:`
uniform float uAmount;
uniform vec3 uHot;
varying vec2 vP;
void main() {
  float r = length(vP);
  float d = abs(r - ${((o.inner+o.outer)/2).toFixed(4)});
  float a = atan(vP.y, vP.x);
  float inArc = smoothstep(${(o.to-.15).toFixed(4)}, ${o.to.toFixed(4)}, a) * smoothstep(${(o.from+.15).toFixed(4)}, ${o.from.toFixed(4)}, a);
  gl_FragColor = vec4(uHot * exp(-d * d / 0.0012) * inArc * uAmount, 1.0);
}`,transparent:!0,depthWrite:!1,blending:2}),v=new t(new r(o.inner-.08,o.outer+.08,96,1,o.to-.2,o.from-o.to+.4),_);v.name=`hit-lens:glow`,v.position.z=.01,v.renderOrder=s,f.add(v,m,g);let y={group:f,shown:0,fill:0,frost:0,light:1,update(e,t){let n=Math.min(Math.max(y.fill,0),1),r=Math.min(Math.max((n-c)/.09999999999999998,0),1),i=r*(.5+.5*Math.sin(t*5.2)),a=p.uniforms;a.uFill.value=n,a.uPulse.value=i,a.uShown.value=y.shown,a.uLight.value=y.light,m.visible=y.shown>.004,_.uniforms.uAmount.value=y.shown*r*(.35+.4*i),v.visible=m.visible&&r>.002,h.uniforms.uFrost.value=y.frost,h.uniforms.uLight.value=y.light,g.visible=y.frost>.004}};return y}export{f as t};