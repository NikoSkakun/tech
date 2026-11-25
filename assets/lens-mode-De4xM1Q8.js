import{Mt as e,Q as t,Z as n,d as r,u as i,wt as a,yt as o}from"./three-DhiLhOnT.js";import{l as s}from"./palette-zCOC_7DC.js";import"./api-CJ5w4BMj.js";import{a as c}from"./tween-BITsWGMJ.js";import{E as l,H as u}from"./hud-DIvOJSGE.js";import"./style-jXl5L-Nv.js";var d=`
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
}`,f=`
uniform float uHalf;     // half the arc length, px
uniform float uT;        // band thickness, px
uniform float uAmount;   // 0…1 presence (reveal: the band grows from its middle)
uniform float uHot;      // 0…1 hover / drag
uniform float uFocus;    // 0…1 keyboard focus outline
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
  float y = v * uT;                          // px across the band from the inner edge
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
  // edges: a bright lip along the inner edge, a dark one outside; hover lights both in cyan
  float edgeIn = 1.0 - smoothstep(0.0, 2.2 * px, y);
  float edgeOut = smoothstep(uT - 2.2 * px, uT, y);
  col = mix(col, uLight, edgeIn * 0.5);
  col = mix(col, uDark, edgeOut * 0.6);
  col += uCyan * (0.14 + 0.5 * (edgeIn + edgeOut)) * uHot;
  // a thin cyan line along the band's inner edge
  float rimLine = (1.0 - smoothstep(1.0 * px, 2.4 * px, abs(y - 0.6 * px))) * step(abs(s), half_);
  col = mix(col, uCyan * 1.15, rimLine);
  float a = band;

  // the index: a yellow notch across the band at the value and the marker ◆ poking above the band
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
}`,p=(e,t,n)=>Math.min(Math.max(e,t),n),m=1.15;function h(e){return p(e*.04,22,40)}function g(e){let t=h(e.height),n=m*e.height,r=Math.min(n*1.15,.42*(e.right-e.left),.34*e.height),i=e.floor-e.under-t-n;return{cx:p(e.freeX,e.left+r+t,Math.max(e.right-r-t,e.left+r+t)),cy:i,r:n,t,half:r}}function _(e,t,n,r={x:0,y:0}){let i=t/e.r,a=e.r+n*e.t;return r.x=e.cx+a*Math.sin(i),r.y=e.cy+a*Math.cos(i),r}function v(e,t,n){return Math.atan2(t-e.cx,n-e.cy)*e.r}var y=e=>.75*e.t;function b(e,t,n,r){let i=p((t-n)/(r-n),0,1),a=y(e);return-e.half+a+i*2*(e.half-a)}function ee(e,t,n){return(n-t)/Math.max(2*(e.half-y(e)),1)}var x=72,S=24,C=[-.9,0,1,1.3],w=44,te=.002,T=.1,E=.5,ne=5,re=9,ie=14,ae=31,D=(e,t,n)=>Math.min(Math.max(e,t),n),O=(e,t,n,r)=>t+(e-t)*Math.exp(-n*r);function k(e,t){let n=[];for(let r=0;r<e-1;r++)for(let e=0;e<t;e++){let i=r*(t+1)+e,a=i+t+1;n.push(i,a,i+1,i+1,a,a+1)}return n}function oe(){let e=new r,t=C.length*73,n=new Float32Array(t*2),a=0;for(let e of C)for(let t=0;t<=x;t++)n[a++]=t/x,n[a++]=e;return e.setAttribute(`aKV`,new i(n,2)),e.setAttribute(`position`,new i(new Float32Array(t*3),3)),e.setIndex(k(C.length,x)),e}var se=.115,ce=4,le=6;function A(a,p){let{min:m,max:h}=p,y=s(`steel`).lerp(s(`slate`),.3),x={uView:{value:[1,1]},uCircle:{value:new e(0,0,100)},uT:{value:20},uHalf:{value:100},uExt:{value:12},uAmount:{value:0},uHot:{value:0},uFocus:{value:0},uTurn:{value:0},uMarker:{value:0},uMarks:{value:[,,,,].fill(0)},uMarkCount:{value:0},uMetal:{value:y},uLight:{value:s(`white`)},uDark:{value:s(`ink`)},uCyan:{value:s(`cyan`)},uYellow:{value:s(`yellow`)},uPrint:{value:s(`white`)}},C=new o({vertexShader:d,fragmentShader:f,uniforms:x,transparent:!0,depthTest:!1,depthWrite:!1}),A=new n(oe(),C);A.name=`lens:focus-ring`,A.frustumCulled=!1,A.renderOrder=60,A.visible=!1,c(A),a.root.add(A);let j=new r;j.setAttribute(`position`,new i(new Float32Array(150),3)),j.setIndex(k(2,S));let M=new n(j,new t({side:2}));M.name=`lens:focus-ring-hit`,M.frustumCulled=!1,M.layers.set(ae),M.visible=!1,a.root.add(M);let N=0,P=0,F=!1,I=!1,L=!1,R=0,z=null,B=28,V=``,H=()=>{let e=a.viewport.width,t=a.viewport.height,n=a.camera.camera,r=n.insets,i=n.freeCenter({x:.5,y:.5});return{width:e,height:t,floor:t*(1-Math.max(r.bottom,se))-le,under:B+8,left:e*r.left,right:e*(1-r.right),freeX:e*i.x}},ue=(e,t)=>{let n=.75*e.t,r=D((t+e.half-n)/Math.max(2*(e.half-n),1),0,1);return m+r*(h-m)},U=e=>{p.touched?.(),p.travelTo(D(e,m,h))},W=e=>U(p.target()+e);A.onBeforeRender=()=>{let e=z??g(H());x.uView.value=[a.viewport.width,a.viewport.height],x.uCircle.value.set(e.cx,e.cy,e.r),x.uT.value=e.t,x.uHalf.value=e.half,x.uExt.value=.7*e.t;let t=b(e,p.value(),m,h);x.uMarker.value=t,x.uTurn.value=-t;let n=p.marks();x.uMarkCount.value=Math.min(n.length,4),n.slice(0,4).forEach((t,n)=>x.uMarks.value[n]=b(e,t.value,m,h))},a.input.register(M,{tooltip:()=>p.label,cursor:`grab`,enabled:()=>p.shown()&&N>.5,hover:e=>F=e,dragStart:()=>{I=!0,R=p.value(),p.touched?.()},drag:e=>{if(!z)return;let t=v(z,e.x,e.y)-v(z,e.x-e.dx,e.y-e.dy);R=D(R+t*ee(z,m,h),m,h),p.scrub(R)},dragEnd:()=>I=!1,click:e=>{z&&U(ue(z,v(z,e.x,e.y)))},wheel:e=>(W(-e*te),!0)});let{h:G,setStyle:K}=l,q=u(a,`${p.name}-layer`),J=q?G(`div`,{role:`slider`,tabindex:`0`,"aria-label":p.label,"aria-valuemin":String(m),"aria-valuemax":String(h),"data-ui":p.name,"data-keys":``,hidden:!0}):null;q&&J&&(Object.assign(J.style,{width:`${w}px`,height:`${w}px`,borderRadius:`50%`,outline:`none`,pointerEvents:`none`}),J.addEventListener(`focus`,()=>L=!0),J.addEventListener(`blur`,()=>L=!1),J.addEventListener(`keydown`,e=>{let t=p.target(),n={ArrowRight:t+T,ArrowUp:t+T,ArrowLeft:t-T,ArrowDown:t-T,PageUp:t+E,PageDown:t-E,Home:m,End:h}[e.code];n!==void 0&&(e.preventDefault(),U(n))}),q.append(J));let Y=[],X=``,de=e=>{let t=e.map(e=>`${e.value}:${e.label}`).join(`|`);if(q&&t!==X){X=t;for(let e of Y)e.remove();Y=e.map((e,t)=>{let n=G(`button.chip`,{type:`button`,tabindex:`-1`,"data-ui":`${p.name}:${t}`},e.label);return n.addEventListener(`click`,()=>U(e.value)),Object.assign(n.style,{position:`absolute`,transform:`translate(-50%, 0)`,transition:`none`}),q.append(n),n})}},Z={x:0,y:0},Q=new e,fe=e=>{let t=a.camera.camera,n=Math.max(0,(w/e.t-1.9)/2),r=[-.9-n,1+n],i=j.getAttribute(`position`),o=0;for(let n of r)for(let r=0;r<=S;r++)_(e,(-1+2*r/S)*(e.half+.4*e.t),n,Z),Q.set(Z.x/a.viewport.width*2-1,1-Z.y/a.viewport.height*2,.5),Q.unproject(t),a.root.worldToLocal(Q),i.setXYZ(o++,Q.x,Q.y,Q.z);i.needsUpdate=!0,j.computeBoundingSphere()},$={shown:!1,amount:0,dragging:!1,focused:!1,layout:null,marker:null,ends:null,marks:[]},pe=NaN;return{get dragging(){return I},nudge:W,pointOf(e){return z?{..._(z,b(z,e,m,h),.5)}:null},state:()=>$,update(e){let t=p.shown();t||(I=!1),N=O(N,+!!t,t?ne:re,e),t&&N>.995&&(N=1),!t&&N<.004&&(N=0),P=O(P,F||I?1:0,ie,e),x.uAmount.value=N,x.uHot.value=P,x.uFocus.value=L&&t?1:0,A.visible=N>0,M.visible=t&&N>.5,a.camera.camera.updateMatrixWorld(),z=N>0?g(H()):null,z&&M.visible&&fe(z);let n=p.marks();de(n);let r=p.value();J&&(J.hidden=!t,r!==pe&&(pe=r,J.setAttribute(`aria-valuenow`,r.toFixed(2)),J.setAttribute(`aria-valuetext`,p.valueText(r))));let i=z;if(i){let e=_(i,b(i,r,m,h),-.36);J&&K(J,`transform`,`translate(${e.x-w/2}px, ${e.y-w/2}px)`),Y.forEach((e,t)=>{let r=n[t];if(!r)return;let a=_(i,b(i,r.value,m,h),1+ce/i.t);K(e,`left`,`${a.x.toFixed(1)}px`),K(e,`top`,`${a.y.toFixed(1)}px`),K(e,`opacity`,String(Math.max(0,(N-.3)/.7)))})}for(let e of Y)e.hidden=!(i&&N>.3);let o=`${X}@${a.viewport.width}x${a.viewport.height}`,s=Y[0];s&&!s.hidden&&o!==V&&s.offsetHeight>0&&(V=o,B=s.offsetHeight),$={shown:t,amount:N,dragging:I,focused:L,layout:i,marker:i?{..._(i,b(i,r,m,h),.5)}:null,ends:i?[{..._(i,-i.half,.5)},{..._(i,i.half,.5)}]:null,marks:i?n.map(e=>({..._(i,b(i,e.value,m,h),.5),label:e.label})):[]}}}}var j=.7,M=31;function N(e,r){let i=new n(new a(4e3,16,8),new t({side:1}));i.name=`lens-mode:space`,i.layers.set(M),i.frustumCulled=!1,e.root.add(i);let o=!1,s={dragStart:()=>{r.active()&&(o=!0)},drag:t=>{o&&r.sway.hold(t.totalX,t.totalY,e.viewport.height)},dragEnd:()=>{o&&(o=!1,r.sway.release())},wheel:e=>r.active()?(r.ring.nudge(-e*.002),!0):!1};e.input.register(i,{cursor:`grab`,enabled:r.active,...s});let c=e.renderer.domElement,l=new Map,u=0,d=()=>{let[e,t]=[...l.values()];return e&&t?Math.hypot(e.x-t.x,e.y-t.y):0},f=e=>{e.pointerType===`touch`&&(l.set(e.pointerId,{x:e.clientX,y:e.clientY}),u=l.size===2?d():0)},p=e=>{let t=l.get(e.pointerId);if(!t||(t.x=e.clientX,t.y=e.clientY,l.size!==2||u<=0))return;let n=d();n>0&&r.active()&&r.ring.nudge(Math.log(n/u)*j),u=n},m=e=>{l.delete(e.pointerId),u=l.size===2?d():0};return c.addEventListener(`pointerdown`,f),c.addEventListener(`pointermove`,p),c.addEventListener(`pointerup`,m),c.addEventListener(`pointercancel`,m),e.onDispose(()=>{c.removeEventListener(`pointerdown`,f),c.removeEventListener(`pointermove`,p),c.removeEventListener(`pointerup`,m),c.removeEventListener(`pointercancel`,m)}),{space:s,get swaying(){return o},update(){e.root.worldToLocal(i.position.copy(e.camera.camera.position)),i.updateMatrixWorld()}}}export{A as n,N as t};