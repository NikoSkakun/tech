import{Mt as e,Q as t,Z as n,d as r,u as i,wt as a,yt as o}from"./three-DhiLhOnT.js";import{l as s}from"./palette-zCOC_7DC.js";import"./api-CJ5w4BMj.js";import{a as c}from"./tween-BITsWGMJ.js";import{E as l,H as u}from"./hud-cV7_vmJo.js";import"./style-jXl5L-Nv.js";import{H as d}from"./stage-9s0cNMOH.js";var f=`
attribute vec2 aKV;      // share along the arc (0…1), v across
uniform vec2 uView;      // canvas size, CSS px
uniform vec3 uCircle;    // centre (px, y down) and inner radius (px)
uniform float uT;
uniform float uHalf;
uniform float uExt;      // the geometry reaches this far past the band's ends (outline, rounding)
varying vec2 vArc;
void main() {
  // laid out here from uniforms set just before the draw: the band never lags the frame it sits on
  float s = (aKV.x * 2.0 - 1.0) * (uHalf + uExt);
  float a = s / uCircle.z;
  float rr = uCircle.z + aKV.y * uT;
  vec2 p = uCircle.xy + rr * vec2(sin(a), cos(a));
  vArc = vec2(s, aKV.y);
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
}`,p=`
uniform float uHalf;     // half the arc length, px
uniform float uT;        // band thickness, px
uniform float uAmount;   // 0…1 presence (reveal: the band grows from its middle)
uniform float uHot;      // 0…1 hover / drag
uniform float uFocus;    // 0…1 keyboard focus outline
uniform float uRim;      // 0…1 the cyan rim line at the lens edge
uniform float uTurn;     // knurl scroll, px
uniform float uMarker;   // s of the current value, px
uniform float uMarks[4];
uniform float uMarkCount;
uniform vec3 uMetal;
uniform vec3 uLight;
uniform vec3 uDark;
uniform vec3 uCyan;
uniform vec3 uYellow;
uniform vec3 uPrint;
varying vec2 vArc;

float knurl(float s, float y, float pitch) {
  // two diagonal families of grooves → pyramids; each face lit by where it points
  float a = fract((s + y) / pitch) - 0.5;
  float b = fract((s - y) / pitch) - 0.5;
  float face = abs(a) > abs(b) ? (a > 0.0 ? 0.78 : 1.16) : (b > 0.0 ? 0.9 : 1.04);
  float groove = 1.0 - smoothstep(0.36, 0.5, max(abs(a), abs(b)));
  return face * mix(0.72, 1.0, groove);
}

void main() {
  float s = vArc.x;
  float v = vArc.y;
  float px = max(fwidth(s), 1e-3);
  float y = v * uT;                          // px across the band from the lens edge
  float half_ = uHalf * uAmount;
  // the band: a stadium from -half_ … half_ along, 0 … uT across (rounded ends)
  float qx = max(abs(s) - (half_ - 0.5 * uT), 0.0);
  float d = length(vec2(qx, y - 0.5 * uT)) - 0.5 * uT;
  float band = 1.0 - smoothstep(-0.8 * px, 0.8 * px, d);

  // across-profile lighting: the inner side faces up toward the room light, the outer edge rolls away
  float u = clamp(v, 0.0, 1.0);
  float lit = mix(1.08, 0.7, smoothstep(0.15, 1.0, u));
  lit = floor(lit * 4.0 + 0.5) / 4.0 * 0.35 + lit * 0.65;   // a soft toon step
  vec3 col = uMetal * lit;
  // the grip: the outer 55 % knurled, scrolling with the value
  float grip = smoothstep(0.4, 0.46, u) * (1.0 - smoothstep(0.92, 0.97, u));
  float pitch = max(uT * 0.34, 5.0);
  float kn = knurl(s + uTurn, y, pitch);
  col = mix(col, col * kn, grip * smoothstep(1.2, 2.4, pitch / px));
  // printed floor marks on the smooth inner lip
  float print = 0.0;
  for (int i = 0; i < 4; i++) {
    if (float(i) >= uMarkCount) break;
    float m = 1.0 - smoothstep(0.7, 1.5, abs(s - uMarks[i]) / max(px, 0.5));
    print = max(print, m * smoothstep(0.08, 0.14, u) * (1.0 - smoothstep(0.4, 0.46, u)));
  }
  col = mix(col, uPrint, print * 0.9);
  // edges: a bright lip where the band meets the lens, a dark one outside; hover lights both in cyan
  float edgeIn = 1.0 - smoothstep(0.0, 2.2 * px, y);
  float edgeOut = smoothstep(uT - 2.2 * px, uT, y);
  col = mix(col, uLight, edgeIn * 0.5);
  col = mix(col, uDark, edgeOut * 0.6);
  col += uCyan * (0.14 + 0.5 * (edgeIn + edgeOut)) * uHot;
  // the rim: a thin cyan line along the lens edge, with a soft glow into the lens
  float rimLine = (1.0 - smoothstep(1.0 * px, 2.4 * px, abs(y - 0.6 * px))) * step(abs(s), half_);
  col = mix(col, uCyan * 1.15, rimLine * uRim);
  float a = band;

  // the index: a yellow notch across the band at the value and the marker ◆ poking into the lens
  float notch = (1.0 - smoothstep(1.0, 2.0, abs(s - uMarker) / max(px, 0.5))) * band;
  col = mix(col, uYellow, notch * 0.95);
  float mw = 0.34 * uT;
  float mh = 0.42 * uT;
  float md = abs(s - uMarker) / mw + abs(y + 0.36 * uT) / mh;
  float marker = 1.0 - smoothstep(1.0 - 1.2 * px / mw, 1.0, md);
  float outline = 1.0 - smoothstep(1.0 + 0.6 * px / mw, 1.0 + 2.0 * px / mw, md);
  col = mix(col, uDark, (outline - marker) * (1.0 - band));
  col = mix(col, uYellow * mix(0.95, 1.25, 1.0 - clamp(md, 0.0, 1.0)), marker);
  a = max(a, outline * step(0.001, uAmount));

  // keyboard focus: a yellow outline around the band
  float ring = (1.0 - smoothstep(1.0 * px, 2.2 * px, abs(d - 3.0 * px))) * uFocus;
  col = mix(col, uYellow, ring);
  a = max(a, ring);

  a *= smoothstep(0.0, 0.25, uAmount);
  if (a < 0.003) discard;
  gl_FragColor = vec4(col, a);
}`,m=(e,t,n)=>Math.min(Math.max(e,t),n),h=(e,t,n)=>{let r=m((n-e)/(t-e),0,1);return r*r*(3-2*r)},g=3,_=1.15;function v(e){return m(e*.04,22,40)}function ee(e,t){let n=v(t.height),r=1.15*t.height,i=e===null||!Number.isFinite(e.r)||e.r+g>=r,a=i?r:e.r+g,o=i?1:h(.55*r,r,e.r),s=t.floor-n-a,c=e===null?1/0:e.cy,l=Math.min(c,s),u=i?1:h(0,.12*t.height,c-s),d=Math.min(a*_,.42*(t.right-t.left),.34*t.height);return{cx:m(i?t.freeX:e.cx+(t.freeX-e.cx)*o,t.left+d+n,Math.max(t.right-d-n,t.left+d+n)),cy:l,r:a,t:n,half:d,pinned:u}}function y(e,t,n,r={x:0,y:0}){let i=t/e.r,a=e.r+n*e.t;return r.x=e.cx+a*Math.sin(i),r.y=e.cy+a*Math.cos(i),r}function te(e,t,n){return Math.atan2(t-e.cx,n-e.cy)*e.r}var b=e=>.75*e.t;function x(e,t,n,r){let i=m((t-n)/(r-n),0,1),a=b(e);return-e.half+a+i*2*(e.half-a)}function S(e,t,n){return(n-t)/Math.max(2*(e.half-b(e)),1)}var C=72,w=24,T=[-.9,0,1,1.3],E=44,ne=.002,D=.1,O=.5,re=5,ie=9,ae=14,k=31,A=(e,t,n)=>Math.min(Math.max(e,t),n),j=(e,t,n,r)=>t+(e-t)*Math.exp(-n*r),M=new e,N=new e;function P(e,t,n,r){let i=1/0,a=-1/0,o=-1/0;for(let s=0;s<24;s++){let c=s/24*Math.PI*2;if(M.set(Math.cos(c)*d.radius,Math.sin(c)*d.radius,0),e.group.localToWorld(N.copy(M)),N.applyMatrix4(t.matrixWorldInverse),N.z>-1e-4)return null;N.applyMatrix4(t.projectionMatrix);let l=(N.x+1)/2*n,u=(1-N.y)/2*r;i=Math.min(i,l),a=Math.max(a,l),o=Math.max(o,u)}let s=(a-i)/2;return{cx:(i+a)/2,cy:o-s,r:s}}function F(e,t){let n=[];for(let r=0;r<e-1;r++)for(let e=0;e<t;e++){let i=r*(t+1)+e,a=i+t+1;n.push(i,a,i+1,i+1,a,a+1)}return n}function oe(){let e=new r,t=T.length*73,n=new Float32Array(t*2),a=0;for(let e of T)for(let t=0;t<=C;t++)n[a++]=t/C,n[a++]=e;return e.setAttribute(`aKV`,new i(n,2)),e.setAttribute(`position`,new i(new Float32Array(t*3),3)),e.setIndex(F(T.length,C)),e}var se=.115;function I(a,d){let{min:m,max:h}=d,g=s(`steel`).lerp(s(`slate`),.3),_={uView:{value:[1,1]},uCircle:{value:new e(0,0,100)},uT:{value:20},uHalf:{value:100},uExt:{value:12},uAmount:{value:0},uHot:{value:0},uFocus:{value:0},uRim:{value:0},uTurn:{value:0},uMarker:{value:0},uMarks:{value:[,,,,].fill(0)},uMarkCount:{value:0},uMetal:{value:g},uLight:{value:s(`white`)},uDark:{value:s(`ink`)},uCyan:{value:s(`cyan`)},uYellow:{value:s(`yellow`)},uPrint:{value:s(`white`)}},v=new o({vertexShader:f,fragmentShader:p,uniforms:_,transparent:!0,depthTest:!1,depthWrite:!1}),b=new n(oe(),v);b.name=`lens:focus-ring`,b.frustumCulled=!1,b.renderOrder=60,b.visible=!1,c(b),a.root.add(b);let C=new r;C.setAttribute(`position`,new i(new Float32Array(150),3)),C.setIndex(F(2,w));let T=new n(C,new t({side:2}));T.name=`lens:focus-ring-hit`,T.frustumCulled=!1,T.layers.set(k),T.visible=!1,a.root.add(T);let M=0,N=0,I=!1,L=!1,R=!1,z=0,B=null,ce=()=>{let e=a.viewport.width,t=a.viewport.height,n=a.camera.camera,r=n.insets,i=n.freeCenter({x:.5,y:.5});return{width:e,height:t,floor:t*(1-Math.max(r.bottom,se))-8,left:e*r.left,right:e*(1-r.right),freeX:e*i.x}},V=e=>{let t=ce();return ee(P(d.lens,e,t.width,t.height),t)},le=(e,t)=>{let n=.75*e.t,r=A((t+e.half-n)/Math.max(2*(e.half-n),1),0,1);return m+r*(h-m)},H=e=>{d.touched?.(),d.travelTo(A(e,m,h))},U=e=>H(d.target()+e);b.onBeforeRender=(e,t,n)=>{let r=V(n);_.uView.value=[a.viewport.width,a.viewport.height],_.uCircle.value.set(r.cx,r.cy,r.r),_.uT.value=r.t,_.uHalf.value=r.half,_.uExt.value=.7*r.t,_.uRim.value=r.pinned;let i=x(r,d.value(),m,h);_.uMarker.value=i,_.uTurn.value=-i;let o=d.marks();_.uMarkCount.value=Math.min(o.length,4),o.slice(0,4).forEach((e,t)=>_.uMarks.value[t]=x(r,e.value,m,h))},a.input.register(T,{tooltip:()=>d.label,cursor:`grab`,enabled:()=>d.shown()&&M>.5,hover:e=>I=e,dragStart:()=>{L=!0,z=d.value(),d.touched?.()},drag:e=>{if(!B)return;let t=Math.atan2(e.x-B.cx,e.y-B.cy),n=e.dx*Math.cos(t)-e.dy*Math.sin(t);z=A(z+n*S(B,m,h),m,h),d.scrub(z)},dragEnd:()=>L=!1,click:e=>{B&&H(le(B,te(B,e.x,e.y)))},wheel:e=>(U(-e*ne),!0)});let{h:W,setStyle:G}=l,K=u(a,`${d.name}-layer`),q=K?W(`div`,{role:`slider`,tabindex:`0`,"aria-label":d.label,"aria-valuemin":String(m),"aria-valuemax":String(h),"data-ui":d.name,"data-keys":``,hidden:!0}):null;K&&q&&(Object.assign(q.style,{width:`${E}px`,height:`${E}px`,borderRadius:`50%`,outline:`none`,pointerEvents:`none`}),q.addEventListener(`focus`,()=>R=!0),q.addEventListener(`blur`,()=>R=!1),q.addEventListener(`keydown`,e=>{let t=d.target(),n={ArrowRight:t+D,ArrowUp:t+D,ArrowLeft:t-D,ArrowDown:t-D,PageUp:t+O,PageDown:t-O,Home:m,End:h}[e.code];n!==void 0&&(e.preventDefault(),H(n))}),K.append(q));let J=[],Y=``,ue=e=>{let t=e.map(e=>`${e.value}:${e.label}`).join(`|`);if(K&&t!==Y){Y=t;for(let e of J)e.remove();J=e.map((e,t)=>{let n=W(`button.chip`,{type:`button`,tabindex:`-1`,"data-ui":`${d.name}:${t}`},e.label);return n.addEventListener(`click`,()=>H(e.value)),Object.assign(n.style,{position:`absolute`,transform:`translate(-50%, -100%)`,transition:`none`}),K.append(n),n})}},X={x:0,y:0},Z=new e,de=e=>{let t=a.camera.camera,n=Math.max(0,(E/e.t-1.9)/2),r=[-.9-n,1+n],i=C.getAttribute(`position`),o=0;for(let n of r)for(let r=0;r<=w;r++)y(e,(-1+2*r/w)*(e.half+.4*e.t),n,X),Z.set(X.x/a.viewport.width*2-1,1-X.y/a.viewport.height*2,.5),Z.unproject(t),a.root.worldToLocal(Z),i.setXYZ(o++,Z.x,Z.y,Z.z);i.needsUpdate=!0,C.computeBoundingSphere()},Q={shown:!1,amount:0,dragging:!1,focused:!1,layout:null,marker:null,ends:null,marks:[]},$=NaN;return{get dragging(){return L},nudge:U,pointOf(e){return B?{...y(B,x(B,e,m,h),.5)}:null},state:()=>Q,update(e){let t=d.shown();t||(L=!1),M=j(M,+!!t,t?re:ie,e),t&&M>.995&&(M=1),!t&&M<.004&&(M=0),N=j(N,I||L?1:0,ae,e),_.uAmount.value=M,_.uHot.value=N,_.uFocus.value=R&&t?1:0,b.visible=M>0,T.visible=t&&M>.5;let n=a.camera.camera;n.updateMatrixWorld(),B=M>0?V(n):null,B&&T.visible&&de(B);let r=d.marks();ue(r);let i=d.value();q&&(q.hidden=!t,i!==$&&($=i,q.setAttribute(`aria-valuenow`,i.toFixed(2)),q.setAttribute(`aria-valuetext`,d.valueText(i))));let o=B;if(o){let e=y(o,x(o,i,m,h),-.36);q&&G(q,`transform`,`translate(${e.x-E/2}px, ${e.y-E/2}px)`),J.forEach((e,t)=>{let n=r[t];if(!n)return;let i=y(o,x(o,n.value,m,h),-1.05);G(e,`left`,`${i.x.toFixed(1)}px`),G(e,`top`,`${i.y.toFixed(1)}px`),G(e,`opacity`,String(Math.max(0,(M-.3)/.7)))})}for(let e of J)e.hidden=!(o&&M>.3);Q={shown:t,amount:M,dragging:L,focused:R,layout:o,marker:o?{...y(o,x(o,i,m,h),.5)}:null,ends:o?[{...y(o,-o.half,.5)},{...y(o,o.half,.5)}]:null,marks:o?r.map(e=>({...y(o,x(o,e.value,m,h),.5),label:e.label})):[]}}}}var L=.7,R=31;function z(e,r){let i=new n(new a(4e3,16,8),new t({side:1}));i.name=`lens-mode:space`,i.layers.set(R),i.frustumCulled=!1,e.root.add(i);let o=!1,s={dragStart:()=>{r.active()&&(o=!0)},drag:t=>{o&&r.sway.hold(t.totalX,t.totalY,e.viewport.height)},dragEnd:()=>{o&&(o=!1,r.sway.release())},wheel:e=>r.active()?(r.ring.nudge(-e*.002),!0):!1};e.input.register(i,{cursor:`grab`,enabled:r.active,...s});let c=e.renderer.domElement,l=new Map,u=0,d=()=>{let[e,t]=[...l.values()];return e&&t?Math.hypot(e.x-t.x,e.y-t.y):0},f=e=>{e.pointerType===`touch`&&(l.set(e.pointerId,{x:e.clientX,y:e.clientY}),u=l.size===2?d():0)},p=e=>{let t=l.get(e.pointerId);if(!t||(t.x=e.clientX,t.y=e.clientY,l.size!==2||u<=0))return;let n=d();n>0&&r.active()&&r.ring.nudge(Math.log(n/u)*L),u=n},m=e=>{l.delete(e.pointerId),u=l.size===2?d():0};return c.addEventListener(`pointerdown`,f),c.addEventListener(`pointermove`,p),c.addEventListener(`pointerup`,m),c.addEventListener(`pointercancel`,m),e.onDispose(()=>{c.removeEventListener(`pointerdown`,f),c.removeEventListener(`pointermove`,p),c.removeEventListener(`pointerup`,m),c.removeEventListener(`pointercancel`,m)}),{space:s,get swaying(){return o},update(){e.root.worldToLocal(i.position.copy(e.camera.camera.position)),i.updateMatrixWorld()}}}export{I as n,z as t};