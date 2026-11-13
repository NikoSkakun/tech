import{t as e}from"./rolldown-runtime-DK3Fl9T5.js";import{Ct as t,E as n,F as r,G as i,H as a,K as o,L as s,M as c,N as l,O as u,Q as d,St as f,U as p,Z as m,_t as h,c as g,d as _,et as ee,f as te,g as ne,gt as re,i as ie,l as ae,lt as v,m as oe,mt as se,nt as ce,p as y,pt as b,s as le,tt as ue,v as de,xt as x}from"./three-C4KRfW3Y.js";import{c as S,l as fe,o as C}from"./palette-BnC5IwH6.js";import{J as w,z as pe}from"./index-BpPtQQ1w.js";import{t as T}from"./style-B_T8DQns.js";import{a as E,c as me,i as he,o as ge,r as _e,s as D,t as ve}from"./plugin-7yGnqG9l.js";function ye(e,t,n,r,i=1){let a=()=>r(Math.min(n,e.quality.count(t,i)));return a(),e.quality.onChange(a)}function be(e,t,n=1){return Math.max(e.quality.count(t,n),t,n)}function xe(e,t=new y){let n=Math.min(Math.max(2900/Math.max(e,1),2.5),9);if(e<380)return{color:S(`violet.light`,t),band:`uv`,waves:n};if(e>750)return{color:S(`red.dark`,t),band:`ir`,waves:n};let r=0,i=0,a=0;e<440?(r=(440-e)/60,a=1):e<490?(i=(e-440)/50,a=1):e<510?(i=1,a=(510-e)/20):e<580?(r=(e-510)/70,i=1):e<645?(r=1,i=(645-e)/65):r=1,e<420&&(r=Math.max(r,.45));let o=.8;return t.setRGB(r**o,i**o,a**o,`srgb`),{color:t,band:`visible`,waves:n}}function Se(e){return 1239.841984/e}var O=new f,k=new f,A=new f;function Ce(e,t,n,r){if(n<=0)return r.copy(t);let i=1-e.next()*(1-Math.cos(n)),a=Math.sqrt(Math.max(0,1-i*i)),o=e.next()*Math.PI*2;return O.set(Math.abs(t.y)<.99?0:1,+(Math.abs(t.y)<.99),0).cross(t).normalize(),k.crossVectors(t,O),r.copy(t).multiplyScalar(i).addScaledVector(O,a*Math.cos(o)).addScaledVector(k,a*Math.sin(o))}function j(e){if(!e?.axis)return null;let t=new f(...e.axis).normalize(),n=e.spread??0;return(e,r)=>void Ce(e,t,n,r)}function we(e,t){let[n,r,i]=e.onSphere();t.set(n,r,i)}function Te(e=[0,0,0],t){let n=j(t)??we;return(t,r,i)=>{r.set(e[0],e[1],e[2]),n(t,i)}}function Ee(e,t={}){let n=j(t),r=t.center??[0,0,0];return(i,a,o)=>{let[s,c,l]=i.onSphere(),u=t.surface?e:e*Math.cbrt(i.next());a.set(r[0]+s*u,r[1]+c*u,r[2]+l*u),n?n(i,o):o.set(s,c,l)}}function M(e,t={}){let n=j(t)??we,r=t.center??[0,0,0];return(t,i,a)=>{i.set(r[0]+t.signed(e[0]/2),r[1]+t.signed(e[1]/2),r[2]+t.signed(e[2]/2)),n(t,a)}}function De(e,t={}){let n=new f(...t.axis??[0,1,0]).normalize(),r=new f(Math.abs(n.y)<.99?0:1,+(Math.abs(n.y)<.99),0).cross(n).normalize(),i=new f().crossVectors(n,r),a=t.inner??0,o=t.center??[0,0,0],s=t.spread??0;return(t,c,l)=>{let u=Math.sqrt(a*a+t.next()*(e*e-a*a)),d=t.next()*Math.PI*2;c.set(o[0],o[1],o[2]).addScaledVector(r,u*Math.cos(d)).addScaledVector(i,u*Math.sin(d)),Ce(t,n,s,l)}}function Oe(e,t={}){let n=e.getAttribute(`position`),r=e.getIndex(),i=(r?r.count:n.count)/3,a=(e,i,a)=>{let o=r?r.getX(e*3+i):e*3+i;return a.fromBufferAttribute(n,o),t.matrix?a.applyMatrix4(t.matrix):a},o=new Float32Array(i),s=0;for(let e=0;e<i;e++)a(e,0,O),a(e,1,k),a(e,2,A),s+=k.sub(O).cross(A.sub(O)).length()*.5,o[e]=s;let c=j(t);return(e,t,n)=>{let r=e.next()*s,l=0,u=i-1;for(;l<u;){let e=l+u>>1;o[e]<r?l=e+1:u=e}a(l,0,O),a(l,1,k),a(l,2,A);let d=e.next(),f=e.next();d+f>1&&(d=1-d,f=1-f),t.copy(O).addScaledVector(k.sub(O),d).addScaledVector(A.sub(O),f),c?c(e,n):n.crossVectors(k,A).normalize()}}function ke(e,t={}){let n=j(t),r=t.radius??0;return(t,i,a)=>{let o=t.next();if(e.getPointAt(o,i),e.getTangentAt(o,O),r>0){let[e,n,a]=t.onSphere();k.set(e,n,a).cross(O),k.lengthSq()>1e-8&&i.addScaledVector(k.normalize(),r*Math.sqrt(t.next()))}n?n(t,a):a.copy(O)}}var N=`
#ifndef saturate
  #define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#ifndef PI
  #define PI 3.141592653589793
#endif
#ifndef FX_KEEP_HUE_FN
#define FX_KEEP_HUE_FN
// Same pre-compensation as K.glow({ keepHue }) (M1): the display transform bleeds a pixel of peak p > 1 toward
// white by w = 1 − exp(−0.7·(p − 1)); writing c' = (c/p − p·w) / (1 − w) makes it land on the palette hue at full
// brightness. The dominant channel keeps the peak (bloom). The peak is capped at maxPeak (≤ 1.8, above which no hue
// survives). Thin lines need a low cap (≈ 1.3): strongly negative channels of a 2-px line get mixed with its
// neighbours by bloom / FXAA and the compensation then overshoots (amber turned red-orange at 1.8).
vec3 fxKeepHue( vec3 c, float maxPeak ) {
  float p = max( c.r, max( c.g, c.b ) );
  if ( p <= 1.0 ) return c;
  c *= min( p, maxPeak ) / p;
  p = min( p, maxPeak );
  float w = 1.0 - exp( -0.7 * ( p - 1.0 ) );
  vec3 t = c / p;
  vec3 k = max( ( t - p * w ) / max( 1.0 - w, 1e-3 ), -p );
  return mix( k, vec3( p ), step( 0.999, t ) );
}
#endif
`,P=`
float fxHash11( float p ) {
  p = fract( p * 0.1031 );
  p *= p + 33.33;
  p *= p + p;
  return fract( p );
}
float fxHash21( vec2 p ) {
  vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
  p3 += dot( p3, p3.yzx + 33.33 );
  return fract( ( p3.x + p3.y ) * p3.z );
}
vec3 fxHash33( vec3 p3 ) {
  p3 = fract( p3 * vec3( 0.1031, 0.1030, 0.0973 ) );
  p3 += dot( p3, p3.yxz + 33.33 );
  return fract( ( p3.xxy + p3.yxx ) * p3.zyx );
}
float fxNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( fxHash21( i ), fxHash21( i + vec2( 1.0, 0.0 ) ), f.x ),
              mix( fxHash21( i + vec2( 0.0, 1.0 ) ), fxHash21( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
float fxFbm( vec2 p ) {
  float a = 0.5;
  float s = 0.0;
  for ( int i = 0; i < 3; i++ ) {
    s += a * fxNoise( p );
    p = p * 2.03 + 11.7;
    a *= 0.5;
  }
  return s;
}
`,Ae=`
#ifdef USE_FOG
  varying float vFogDepth;
#endif
`,je=`
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
#endif
`,Me=`
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
  float fxFogFactor() {
    #ifdef FOG_EXP2
      return 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
    #else
      return smoothstep( fogNear, fogFar, vFogDepth );
    #endif
  }
#else
  float fxFogFactor() { return 0.0; }
#endif
`,F=`
float fxObjectScale() {
  return length( modelMatrix[ 0 ].xyz );
}
`;function Ne(e){let t=new l;return t.setAttribute(`position`,new g(new Float32Array([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0]),3)),t.setAttribute(`uv`,new g(new Float32Array([0,0,1,0,1,1,0,1]),2)),t.setIndex([0,1,2,0,2,3]),t.instanceCount=e,t.boundingSphere=new b(new f,1/0),t}function Pe(e,t){let n=new l,r=e+1,i=new Float32Array(r*2*3),a=[];for(let t=0;t<r;t++){let n=t/e;if(i.set([n,-.5,0,n,.5,0],t*6),t<e){let e=t*2;a.push(e,e+2,e+1,e+1,e+2,e+3)}}return n.setAttribute(`position`,new g(i,3)),n.setIndex(a),n.instanceCount=t,n.boundingSphere=new b(new f,1/0),n}function I(e,t,n,r){let i=new c(n,r);return e.setAttribute(t,i),i}var Fe=`
attribute vec4 aPosBirth;
attribute vec4 aVelLife;
attribute vec4 aSeed;
uniform float uKTime;
uniform float uLoop;
uniform vec2 uGate;
uniform float uRate;
uniform vec3 uGravity;
uniform vec3 uWind;
uniform float uDrag;
uniform vec3 uTurb;
uniform vec4 uSize;
uniform vec4 uCurve;
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec4 uLook;
varying vec2 vUv;
varying vec4 vColor;
varying vec2 vSeed;
${Ae}
${P}
${F}
void main() {
  float life = max( aVelLife.w, 1e-3 );
  float cyc = ( uKTime - aPosBirth.w ) / life;
  float cycle = floor( cyc );
  float a01 = uLoop > 0.5 ? cyc - cycle : cyc;
  float alive = step( 0.0, cyc ) * ( uLoop > 0.5 ? 1.0 : step( cyc, 1.0 ) );
  float age = a01 * life;
  // gate: a looping particle is visible only if its current life began while the emitter was switched on,
  // so switching off lets living particles finish their flight instead of popping
  float bornAt = uKTime - age;
  float gate = step( uGate.x, bornAt ) * ( uGate.y < uGate.x ? 1.0 : 1.0 - step( uGate.y, bornAt ) );
  alive *= mix( 1.0, gate, uLoop );
  alive *= smoothstep( aSeed.w - 0.06, aSeed.w + 0.06, uRate * 1.12 - 0.06 );

  vec3 rnd = fxHash33( vec3( aSeed.xy * 97.0, cycle + 3.0 ) ) - 0.5;
  vec3 p0 = aPosBirth.xyz + rnd * ( 2.0 * uCurve.w * uLoop );
  vec3 v0 = aVelLife.xyz;
  vec3 p;
  vec3 vel;
  if ( uDrag > 1e-3 ) {
    vec3 vInf = uWind + uGravity / uDrag;
    float e = exp( - uDrag * age );
    p = p0 + vInf * age + ( v0 - vInf ) * ( 1.0 - e ) / uDrag;
    vel = vInf + ( v0 - vInf ) * e;
  } else {
    p = p0 + v0 * age + 0.5 * uGravity * age * age;
    vel = v0 + uGravity * age;
  }
  if ( uTurb.x > 0.0 ) {
    float ph = dot( p0, vec3( uTurb.y ) );
    vec3 w = vec3(
      sin( age * uTurb.z * ( 0.7 + aSeed.x ) + aSeed.y * 6.2832 + ph ),
      cos( age * uTurb.z * ( 0.9 + aSeed.z ) + aSeed.x * 6.2832 + ph * 1.3 ),
      sin( age * uTurb.z * ( 1.1 + aSeed.y ) + aSeed.z * 6.2832 + ph * 0.7 ) );
    p += w * ( uTurb.x * smoothstep( 0.0, 0.35, a01 ) );
  }

  float mid = uCurve.x;
  float k = a01 < mid ? a01 / max( mid, 1e-3 ) : ( a01 - mid ) / max( 1.0 - mid, 1e-3 );
  float size = a01 < mid ? mix( uSize.x, uSize.y, k ) : mix( uSize.y, uSize.z, k );
  size *= ( 1.0 + ( aSeed.z - 0.5 ) * 2.0 * uSize.w ) * fxObjectScale() * alive;
  vec3 color = a01 < mid ? mix( uColor0, uColor1, k ) : mix( uColor1, uColor2, k );
  float alpha = smoothstep( 0.0, max( uCurve.y, 1e-3 ), a01 ) * ( 1.0 - smoothstep( 1.0 - uCurve.z, 1.0, a01 ) );
  vColor = vec4( color, alpha * alive );
  vSeed = aSeed.xy;
  vUv = uv;

  vec4 mvPosition = modelViewMatrix * vec4( p, 1.0 );
  vec2 corner = position.xy;
  #ifdef FX_STRETCH
    vec3 vView = ( modelViewMatrix * vec4( vel, 0.0 ) ).xyz;
    float sp = length( vView.xy );
    vec2 dir = sp > 1e-5 ? vView.xy / sp : vec2( 0.0, 1.0 );
    float along = size + uLook.z * length( vView );
    mvPosition.xy += dir * ( corner.y * along ) + vec2( dir.y, - dir.x ) * ( corner.x * size );
  #else
    float ang = aSeed.x * 6.2832 + uLook.w * age * ( aSeed.y - 0.5 ) * 2.0;
    float cs = cos( ang );
    float sn = sin( ang );
    mvPosition.xy += vec2( corner.x * cs - corner.y * sn, corner.x * sn + corner.y * cs ) * size;
  #endif
  gl_Position = projectionMatrix * mvPosition;
  ${je}
}
`,Ie=`
precision highp float;
uniform float uKTime;
uniform vec4 uLook;
uniform vec2 uOut; // intensity, opacity
varying vec2 vUv;
varying vec4 vColor;
varying vec2 vSeed;
${N}
${Me}
${P}
void main() {
  vec2 q = vUv * 2.0 - 1.0;
  float d = length( q );
  vec3 rgb = vColor.rgb;
  float a = 0.0;
  #if defined( FX_SPRITE_SOFT )
    float g = saturate( 1.0 - d );
    a = g * g;
    rgb *= 1.0 + 1.5 * g * g * g;
  #elif defined( FX_SPRITE_DISC )
    float aa = fwidth( d ) * 1.5;
    a = 1.0 - smoothstep( 0.9 - aa, 0.9, d );
    rgb *= mix( 0.86, 1.0, smoothstep( 0.2, -0.5, q.y - q.x * 0.3 ) );
    rgb = mix( rgb, vec3( 1.0 ), 0.75 * ( 1.0 - smoothstep( 0.1, 0.2, length( q - vec2( -0.3, 0.34 ) ) ) ) );
  #elif defined( FX_SPRITE_PUFF )
    // lumpy silhouette: the radius wobbles with the angle (fixed per particle), edge kept soft
    float ang = atan( q.y, q.x );
    float lump = 0.82 + 0.1 * sin( ang * 3.0 + vSeed.x * 6.2832 ) + 0.06 * sin( ang * 5.0 + vSeed.y * 6.2832 );
    a = 1.0 - smoothstep( lump - 0.22, lump, d );
    // two-tone cel shading: lighter crown, tinted belly (never grey)
    float crown = smoothstep( -0.25, 0.3, q.y + 0.25 * sin( q.x * 2.4 + vSeed.x * 6.2832 ) );
    rgb *= mix( 0.8, 1.0, crown );
  #elif defined( FX_SPRITE_SPARK )
    float w = saturate( 1.0 - abs( q.x ) );
    a = w * w * smoothstep( -1.0, -0.2, q.y ) * smoothstep( 1.0, 0.7, q.y ) * mix( 0.25, 1.0, vUv.y );
    rgb *= 1.0 + 2.0 * w * w * vUv.y;
  #elif defined( FX_SPRITE_DROP )
    // teardrop: round head (top = flight direction), tapering tail
    float r = mix( 0.28, 0.85, smoothstep( -1.0, 0.45, q.y ) ) * ( 1.0 - smoothstep( 0.45, 1.0, q.y ) * 0.35 );
    float sd = abs( q.x ) - r * sqrt( saturate( 1.0 - q.y * q.y ) );
    float aa = fwidth( sd ) * 1.5;
    a = 1.0 - smoothstep( - aa, aa, sd );
    rgb = mix( rgb, vec3( 1.0 ), 0.7 * ( 1.0 - smoothstep( 0.1, 0.22, length( q - vec2( -0.22, 0.35 ) ) ) ) );
  #elif defined( FX_SPRITE_BUBBLE )
    float aa = fwidth( d ) * 1.5;
    float rim = smoothstep( 0.7 - aa, 0.78, d ) * ( 1.0 - smoothstep( 0.92 - aa, 0.92, d ) );
    float fill = ( 1.0 - smoothstep( 0.9 - aa, 0.9, d ) ) * 0.16;
    float spot = 1.0 - smoothstep( 0.1, 0.2, length( q - vec2( -0.34, 0.36 ) ) );
    a = saturate( rim * 0.9 + fill + spot * 0.9 );
    rgb = mix( rgb, vec3( 1.0 ), saturate( spot + rim * 0.35 ) );
  #elif defined( FX_SPRITE_RING )
    float aa = fwidth( d ) * 1.5;
    a = smoothstep( 0.74 - aa, 0.8, d ) * ( 1.0 - smoothstep( 0.92, 0.98 + aa, d ) );
  #endif
  a *= vColor.a * uOut.y;
  if ( a < 0.003 ) discard;
  rgb *= uOut.x;
  float fogF = fxFogFactor();
  #ifdef FX_ADDITIVE
    gl_FragColor = vec4( rgb * a * ( 1.0 - fogF ), 0.0 );
  #else
    #ifdef USE_FOG
      rgb = mix( rgb, fogColor, fogF );
    #endif
    gl_FragColor = vec4( rgb * a, a );
  #endif
}
`;function Le(e,t){return e===void 0?[t,t]:typeof e==`number`?[e,e]:e}function Re(e,t){return e===void 0?[t,t,t]:typeof e==`number`?[e,e,e]:e.length===2?[e[0],(e[0]+e[1])/2,e[1]]:[e[0],e[1],e[2]]}function ze(e){if(e===void 0)return[S(`white`),S(`white`),S(`white`)];if(!Array.isArray(e))return[S(e),S(e),S(e)];let t=e;return t.length===2?[S(t[0]),S(t[0]).lerp(S(t[1]),.5),S(t[1])]:[S(t[0]),S(t[1]),S(t[2])]}var L=new f,R=new f,z=new f,Be=new f,Ve=new f,B=class extends p{capacity;rng;emitter;life;speed;posBirth;velLife;seeds;unfollow;looping;cursor=0;on=!0;constructor(e,n){let r=n.sprite??`soft`,i=n.loop??!0,a=(n.blend??(r===`soft`||r===`spark`||r===`ring`?`add`:`normal`))===`add`,o=n.stretch??(r===`spark`||r===`drop`?.05:0),s=n.exactCount?n.count:be(e,n.count),c=Ne(s),[l,u,d]=ze(n.color),p=Re(n.size,.1),m={uLoop:{value:+!!i},uGate:{value:new x(-1e9,-2e9)},uRate:{value:1},uGravity:{value:new f(...n.gravity??[0,0,0])},uWind:{value:new f(...n.wind??[0,0,0])},uDrag:{value:n.drag??0},uTurb:{value:new f(n.turbulence?.amplitude??0,n.turbulence?.frequency??1,n.turbulence?.speed??1)},uSize:{value:new t(p[0],p[1],p[2],n.sizeJitter??.3)},uCurve:{value:new t(n.mid??.5,n.fadeIn??.1,n.fadeOut??.35,n.reseed??0)},uColor0:{value:l},uColor1:{value:u},uColor2:{value:d},uLook:{value:new t(0,0,o,n.spin??0)},uOut:{value:new x(n.intensity??1,n.opacity??1)}},g=new v({name:`fx.particles.${r}`,uniforms:h.merge([ie.fog,m]),vertexShader:Fe,fragmentShader:Ie,defines:{[`FX_SPRITE_${r.toUpperCase()}`]:``,...a?{FX_ADDITIVE:``}:{},...o>0?{FX_STRETCH:``}:{}},transparent:!0,depthWrite:!1,depthTest:n.depthTest??!0,blending:a?2:1,premultipliedAlpha:!0,fog:n.fog??!a});g.uniforms.uKTime=w.uKTime,super(c,g),this.name=`particles:${r}`,this.frustumCulled=!1,this.raycast=()=>void 0,this.renderOrder=n.renderOrder??0,this.capacity=s,this.looping=i,this.rng=e.random.fork(n.seed??`particles`),this.emitter=n.emitter??Te(),this.life=Le(n.life,2),this.speed=Le(n.speed,1),this.posBirth=I(c,`aPosBirth`,new Float32Array(s*4),4),this.velLife=I(c,`aVelLife`,new Float32Array(s*4),4),this.seeds=I(c,`aSeed`,new Float32Array(s*4),4);let _=this.rng;for(let e=0;e<s;e++)if(this.seeds.setXYZW(e,_.next(),_.next(),_.next(),_.next()),i){this.emitter(_,L,R);let t=_.range(this.life[0],this.life[1]),n=_.range(this.speed[0],this.speed[1]);this.posBirth.setXYZW(e,L.x,L.y,L.z,-_.next()*t),this.velLife.setXYZW(e,R.x*n,R.y*n,R.z*n,t)}else this.posBirth.setXYZW(e,0,0,0,-1e9),this.velLife.setXYZW(e,0,0,0,1);this.unfollow=n.exactCount?()=>void 0:ye(e,n.count,s,e=>c.instanceCount=e)}emit(e,t={}){let n=Math.min(Math.max(1,Math.round(e)),this.geometry.instanceCount),r=E(),i=Le(t.life,0),a=Le(t.speed,0),o=t.direction!==void 0;o&&(z.set(...t.direction).normalize(),Be.set(Math.abs(z.y)<.99?0:1,+(Math.abs(z.y)<.99),0).cross(z).normalize(),Ve.crossVectors(z,Be));let s=t.spread??Math.PI,c=this.rng,l=this.geometry.instanceCount;for(let e=0;e<n;e++){let e=this.cursor;if(this.cursor=(this.cursor+1)%l,this.emitter(c,L,R),t.position&&L.set(...t.position),o){let e=1-c.next()*(1-Math.cos(s)),t=Math.sqrt(Math.max(0,1-e*e)),n=c.next()*Math.PI*2;R.copy(z).multiplyScalar(e).addScaledVector(Be,t*Math.cos(n)).addScaledVector(Ve,t*Math.sin(n))}let n=t.speed===void 0?c.range(this.speed[0],this.speed[1]):c.range(a[0],a[1]),u=t.life===void 0?c.range(this.life[0],this.life[1]):c.range(i[0],i[1]),d=t.inherit??[0,0,0];this.posBirth.setXYZW(e,L.x,L.y,L.z,r),this.velLife.setXYZW(e,R.x*n+d[0],R.y*n+d[1],R.z*n+d[2],u)}this.posBirth.needsUpdate=!0,this.velLife.needsUpdate=!0}reset(){if(!this.looping){for(let e=0;e<this.capacity;e++)this.posBirth.setW(e,-1e9);this.posBirth.needsUpdate=!0}}setEmitting(e,t=!1){let n=this.material.uniforms.uGate.value;if(t)e?n.set(-1e9,-2e9):n.set(-2e9,-1e9);else if(e!==this.on){let t=E();e?n.set(t,t-1):n.y=Math.max(t,n.x)}this.on=e}get emitting(){return this.on}get rate(){return this.material.uniforms.uRate.value}set rate(e){this.material.uniforms.uRate.value=e}get intensity(){return this.material.uniforms.uOut.value.x}set intensity(e){this.material.uniforms.uOut.value.x=e}get fade(){return this.material.uniforms.uOut.value.y}set fade(e){this.material.uniforms.uOut.value.y=e}get wind(){return this.material.uniforms.uWind.value}get gravity(){return this.material.uniforms.uGravity.value}setColor(e){let[t,n,r]=ze(e);return this.material.uniforms.uColor0.value.copy(t),this.material.uniforms.uColor1.value.copy(n),this.material.uniforms.uColor2.value.copy(r),this}setSize(e){let t=Re(e,.1),n=this.material.uniforms.uSize.value;return n.set(t[0],t[1],t[2],n.w),this}dispose(){this.unfollow()}};function He(e,t){return new B(e,t)}var Ue={electron:{color:`cyan`,shade:`cyan.dark`,selfLit:1,intensity:1.12,gloss:0,rim:0,glyph:`minus`,glyphColor:`bg.indigo`,glyphSize:.36,shimmer:1,hollow:!1,halo:{color:`cyan`,size:3.2,strength:.6}},proton:{color:`coral`,shade:`coral`,selfLit:.12,intensity:1,gloss:.7,rim:1.3,glyph:`plus`,glyphColor:`white`,glyphSize:.4,shimmer:0,hollow:!1},neutron:{color:`mist`,shade:`steel`,selfLit:.06,intensity:1,gloss:.7,rim:1.1,glyph:`none`,glyphColor:`white`,glyphSize:.4,shimmer:0,hollow:!1},ion:{color:`lime`,shade:`lime`,selfLit:.22,intensity:1,gloss:.6,rim:1.2,glyph:`plus`,glyphColor:`bg.indigo`,glyphSize:.4,shimmer:.25,hollow:!1,halo:{color:`lime`,size:2.2,strength:.28}},quarkUp:{color:`amber`,shade:`orange`,selfLit:.55,intensity:1.15,gloss:.8,rim:1,glyph:`none`,glyphColor:`white`,glyphSize:.4,shimmer:.6,hollow:!1,halo:{color:`amber`,size:2.6,strength:.75,cycle:!0}},quarkDown:{color:`violet`,shade:`violet.dark`,selfLit:.55,intensity:1.2,gloss:.8,rim:1,glyph:`none`,glyphColor:`white`,glyphSize:.4,shimmer:.6,hollow:!1,halo:{color:`violet`,size:2.6,strength:.75,cycle:!0}},hole:{color:`coral`,shade:`coral.dark`,selfLit:1,intensity:1.3,gloss:0,rim:0,glyph:`plus`,glyphColor:`coral.light`,glyphSize:.3,shimmer:.8,hollow:!0,halo:{color:`coral`,size:2.4,strength:.3}},blob:{color:`sky`,shade:`blue`,selfLit:.1,intensity:1,gloss:.8,rim:1,glyph:`none`,glyphColor:`white`,glyphSize:.4,shimmer:0,hollow:!1},pulse:{color:`yellow`,shade:`amber`,selfLit:1,intensity:1.7,gloss:0,rim:0,glyph:`none`,glyphColor:`white`,glyphSize:.4,shimmer:.5,hollow:!1,halo:{color:`yellow`,size:3.2,strength:.8}}};function We(){return{pars:`
      attribute vec4 aInst; // xyz centre, w scale
      attribute float aSeed;
    `,main:`
      center = aInst.xyz;
      scale = aInst.w;
      seed = aSeed;
    `,uniforms:{},attributes(e,t){let n=new Float32Array(t*4),r=new Float32Array(t);for(let e=0;e<t;e++){n[e*4+3]=1;let t=Math.sin((e+1)*12.9898)*43758.5453;r[e]=t-Math.floor(t)}I(e,`aInst`,n,4),I(e,`aSeed`,r,1)}}}function Ge(e){return`
uniform float uKTime;
uniform float uRadius;
uniform float uQuad;
varying vec2 vUv;
varying vec3 vCenter;
varying float vRadius;
varying float vSeed;
${Ae}
${P}
${F}
${e.pars}
#ifdef FX_ORB_TINT
  attribute vec4 aTint; // per-instance body colour (linear rgb) + brightness
  varying vec3 vOrbColor;
  varying float vOrbBright;
#endif
void main() {
  vec3 center;
  float scale;
  float seed;
  ${e.main}
  #ifdef FX_ORB_TINT
    vOrbColor = aTint.rgb;
    vOrbBright = aTint.w;
  #endif
  vec4 mvPosition = modelViewMatrix * vec4( center, 1.0 );
  float R = uRadius * scale * fxObjectScale();
  vCenter = mvPosition.xyz;
  vRadius = R;
  vSeed = seed;
  vUv = position.xy * 2.0 * uQuad;
  mvPosition.xy += vUv * R;
  gl_Position = projectionMatrix * mvPosition;
  ${je}
}
`}var Ke=`
uniform mat4 projectionMatrix;
uniform float uKTime;
uniform vec3 uKRimColor;
uniform vec3 uKRimDir;
uniform vec3 uColor;
uniform vec3 uShade;
#ifdef FX_ORB_TINT
  // per-instance colours (M3): every later use of uColor / uShade reads the instance's colour; the shade keeps
  // the style's shade / colour brightness ratio
  uniform float uShadeK;
  varying vec3 vOrbColor;
  varying float vOrbBright;
  #define uColor vOrbColor
  #define uShade ( vOrbColor * uShadeK )
#endif
uniform vec3 uGlyphColor;
uniform vec4 uStyle;  // selfLit, gloss, glyph (0 none, 1 plus, 2 minus), shimmer
uniform vec4 uStyle2; // hollow, intensity, rim, glyph size
uniform float uFade;
varying vec2 vUv;
varying vec3 vCenter;
varying float vRadius;
varying float vSeed;
#include <common>
#include <lights_pars_begin>
${Me}
${P}

float orbLuma( vec3 c ) { return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }
float orbIGN( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }
float orbBox( vec2 p, vec2 b, float r ) {
  vec2 q = abs( p ) - b + r;
  return length( max( q, 0.0 ) ) + min( max( q.x, q.y ), 0.0 ) - r;
}

void main() {
  float r2 = dot( vUv, vUv );
  float r = sqrt( r2 );
  float px = fwidth( r ); // 1 / (orb radius in pixels)
  float cover = 1.0 - smoothstep( 1.0 - 1.5 * px, 1.0, r );
  if ( cover <= 0.0 ) discard;
  // screen-door dissolve, same convention as the K materials' fade
  if ( uFade < 0.999 && uFade <= orbIGN( gl_FragCoord.xy + fract( uKTime ) * 37.0 ) * 0.998 + 0.001 ) discard;

  float hollow = uStyle2.x;
  float nz = sqrt( max( 1.0 - r2, 0.0 ) );
  vec3 n = vec3( vUv, nz );
  float ang = atan( vUv.y, vUv.x );
  float t = uKTime;

  /* ---- lit part: K.toon model with the scene's real rig ---- */
  vec3 viewPos = vCenter + vec3( vUv * vRadius, nz * vRadius );
  vec3 viewDir = normalize( - viewPos );
  vec3 base = mix( uShade, uColor, smoothstep( -0.45, 0.4, n.y ) );
  vec3 key = vec3( 0.0 );
  vec3 fill = ambientLightColor;
  float hi = 0.0;
  float spec = 0.0;
  #if NUM_DIR_LIGHTS > 0
    for ( int i = 0; i < NUM_DIR_LIGHTS; i++ ) {
      vec3 L = directionalLights[ i ].direction;
      vec3 lc = directionalLights[ i ].color;
      float ndl = dot( n, L );
      float band = smoothstep( -0.1, 0.14, ndl );
      key += lc * band;
      hi += smoothstep( 0.68, 0.92, ndl ) * min( orbLuma( lc ), 1.0 );
      float ndh = saturate( dot( n, normalize( L + viewDir ) ) );
      spec += smoothstep( 0.44, 0.56, pow( ndh, 90.0 ) ) * min( orbLuma( lc ), 1.0 ) * band;
    }
  #endif
  #if NUM_POINT_LIGHTS > 0
    for ( int i = 0; i < NUM_POINT_LIGHTS; i++ ) {
      vec3 lv = pointLights[ i ].position - viewPos;
      float dist = length( lv );
      vec3 lc = pointLights[ i ].color * getDistanceAttenuation( dist, pointLights[ i ].distance, pointLights[ i ].decay );
      key += lc * smoothstep( -0.1, 0.14, dot( n, lv / dist ) );
    }
  #endif
  #if NUM_HEMI_LIGHTS > 0
    for ( int i = 0; i < NUM_HEMI_LIGHTS; i++ ) fill += getHemisphereLightIrradiance( hemisphereLights[ i ], n );
  #endif
  vec3 light = fill + key - fill * min( key, vec3( 1.0 ) );
  vec3 lit = base * light;
  lit = mix( lit, mix( base, vec3( 1.0 ), 0.3 ) * min( light, vec3( 1.0 ) ), saturate( hi ) * 0.55 );
  lit = mix( lit, mix( base, vec3( 1.0 ), 0.72 ), saturate( spec ) * uStyle.y );
  float fres = 1.0 - saturate( dot( n, viewDir ) );
  vec3 rimDir = normalize( ( viewMatrix * vec4( uKRimDir, 0.0 ) ).xyz );
  lit += uKRimColor * ( smoothstep( 0.5, 0.74, fres ) * saturate( dot( n, rimDir ) * 0.7 + 0.5 ) * uStyle2.z );
  lit = min( lit, vec3( 1.0 ) );

  /* ---- self-lit part: a marble of light — deeper limb, light heart, white glint, flowing shell ---- */
  float flow = fxNoise( vUv * 2.6 + vec2( t * 0.35, - t * 0.27 ) + vSeed * 31.0 );
  float breathe = 1.0 + 0.07 * uStyle.w * sin( t * 4.3 + vSeed * 61.0 );
  vec3 orb = mix( uShade * 1.05, uColor, smoothstep( 0.12, 0.5, nz ) );
  orb = mix( orb, mix( uColor, vec3( 1.0 ), 0.38 ), smoothstep( 0.62, 0.98, nz + ( flow - 0.5 ) * 0.35 * uStyle.w ) );
  float glint = 1.0 - smoothstep( 0.13, 0.24, length( vUv - vec2( -0.38, 0.42 ) ) );
  glint += 0.6 * ( 1.0 - smoothstep( 0.04, 0.09, length( vUv - vec2( -0.62, 0.12 ) ) ) );
  orb = mix( orb, vec3( 1.25 ), saturate( glint ) * 0.92 );
  // shell: a thin bright band hugging the silhouette whose gaps drift round — the orb never sits still
  float shell = smoothstep( 0.8, 0.9, r ) * ( 1.0 - smoothstep( 0.94, 1.0, r ) );
  float gaps = 0.5 + 0.5 * sin( ang * 3.0 + t * 1.9 + vSeed * 40.0 ) * sin( ang * 2.0 - t * 1.3 + vSeed * 17.0 );
  orb += mix( uColor, vec3( 1.0 ), 0.5 ) * ( shell * gaps * 0.9 * uStyle.w );
  orb *= uStyle2.y * breathe;

  vec3 color = mix( lit, orb, uStyle.x );
  // lit orbs with a little self-light keep a gentle inner warmth in the shade
  color = max( color, uColor * uStyle.x * 0.5 );

  /* ---- hollow ring (hole) ---- */
  if ( hollow > 0.5 ) {
    float ring = smoothstep( 0.64 - 1.5 * px, 0.64, r );
    float dash = smoothstep( -0.25, 0.1, sin( ang * 7.0 + t * 1.2 + vSeed * 20.0 ) );
    float inner = 0.2 * ( 1.0 - ring );
    cover *= max( ring * mix( 0.45, 1.0, dash ), inner );
    color = mix( uShade * 0.6, uColor * uStyle2.y * breathe, ring );
    nz = 0.0;
  }

  /* ---- sign sticker, fades out when the orb is only a few pixels big ---- */
  if ( uStyle.z > 0.5 ) {
    float gs = uStyle2.w;
    float bar = orbBox( vUv, vec2( gs, gs * 0.27 ), gs * 0.12 );
    if ( uStyle.z < 1.5 ) bar = min( bar, orbBox( vUv, vec2( gs * 0.27, gs ), gs * 0.12 ) );
    float mask = ( 1.0 - smoothstep( - px, px, bar ) ) * smoothstep( 0.25, 0.11, px );
    color = mix( color, uGlyphColor, mask );
    cover = max( cover, mask * step( 0.5, hollow ) );
  }

  if ( cover < 0.02 ) discard;
  #ifdef USE_FOG
    color = mix( color, fogColor, fxFogFactor() );
  #endif
  vec4 clip = projectionMatrix * vec4( vCenter.xy + vUv * vRadius, vCenter.z + nz * vRadius, 1.0 );
  gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
  #ifdef FX_ORB_TINT
    color *= vOrbBright;
  #endif
  gl_FragColor = vec4( color, cover );
}
`,qe=`
precision highp float;
uniform float uKTime;
uniform vec3 uHaloColor;
#ifdef FX_ORB_TINT
  varying vec3 vOrbColor;
  varying float vOrbBright;
  #ifndef FX_ORB_TINT_KEEP_HALO
    #define uHaloColor vOrbColor
  #endif
#endif
uniform vec4 uHalo; // size (radii), strength, cycle, glow multiplier
uniform float uFade;
varying vec2 vUv;
varying float vSeed;
${N}
${Me}
void main() {
  float r = length( vUv );
  float size = uHalo.x;
  if ( r > size ) discard;
  float t = uKTime;
  float ang = atan( vUv.y, vUv.x );
  // tight bright corona + wide faint veil, both reaching zero at the quad's edge
  float edge = saturate( ( r - 0.9 ) / ( size - 0.9 ) );
  float corona = exp( - edge * edge * 26.0 );
  float veil = ( 1.0 - edge ) * ( 1.0 - edge ) * 0.22;
  float rays = 1.0 + 0.22 * sin( ang * 5.0 + t * 1.1 + vSeed * 30.0 ) * sin( ang * 3.0 - t * 0.7 + vSeed * 11.0 );
  float twinkle = 1.0 + 0.1 * sin( t * 3.1 + vSeed * 53.0 );
  float glow = ( corona * rays + veil ) * smoothstep( 0.82, 1.0, r ) * uHalo.y * uHalo.w * twinkle * uFade;
  vec3 color = uHaloColor;
  if ( uHalo.z > 0.5 ) {
    // colour charge: the hue wanders between three tints, each quark with its own phase
    float ph = t * 0.9 + vSeed * 6.2832;
    vec3 w = max( vec3( sin( ph ), sin( ph + 2.0944 ), sin( ph + 4.1888 ) ), 0.0 );
    color = mix( color, ( vec3( 1.0, 0.37, 0.36 ) * w.x + vec3( 0.48, 0.89, 0.42 ) * w.y + vec3( 0.24, 0.48, 1.0 ) * w.z ) / max( w.x + w.y + w.z, 1e-3 ), 0.7 );
  }
  #ifdef FX_ORB_TINT
    glow *= vOrbBright;
  #endif
  gl_FragColor = vec4( color * glow * ( 1.0 - fxFogFactor() ), 0.0 );
}
`,Je={none:0,plus:1,minus:2},Ye=new b,Xe=new y,Ze=new f,Qe=class extends p{capacity;haloMesh;style;motionUniforms;inst;constructor(e){let n={...typeof e.kind==`string`?Ue[e.kind]:e.kind};e.color!==void 0&&(n.color=e.color,e.shade===void 0&&typeof e.kind==`string`&&e.kind!==`neutron`&&(n.shade=n.selfLit>.9?S(e.color).multiplyScalar(.55):e.color),n.halo&&!n.halo.cycle&&(n.halo={...n.halo,color:e.color})),e.shade!==void 0&&(n.shade=e.shade),e.glyph!==void 0&&(n.glyph=e.glyph);let r=Math.max(1,e.count??1),i=e.motion??We(),a=Ne(r);i.attributes(a,r);let o=e.instanceColors?{FX_ORB_TINT:``}:{};if(e.instanceColors){let e=S(n.color),t=new Float32Array(r*4);for(let n=0;n<r;n++)t.set([e.r,e.g,e.b,1],n*4);I(a,`aTint`,t,4)}let s=e=>e.r*.2126+e.g*.7152+e.b*.0722,c={uRadius:{value:e.radius??.1},uFade:{value:1},...i.uniforms},l=new v({name:`fx.orb`,uniforms:h.merge([ie.lights,ie.fog,{uQuad:{value:1.02},uColor:{value:S(n.color)},uShade:{value:S(n.shade)},uGlyphColor:{value:S(n.glyphColor)},uStyle:{value:new t(n.selfLit,n.gloss,Je[n.glyph],n.shimmer)},uStyle2:{value:new t(+!!n.hollow,n.intensity,n.rim,n.glyphSize)},uShadeK:{value:s(S(n.shade))/Math.max(s(S(n.color)),.001)}}]),vertexShader:Ge(i),fragmentShader:Ke,defines:{...i.defines,...o},lights:!0,fog:e.fog??!0,alphaToCoverage:!0});if(Object.assign(l.uniforms,c,{uKTime:w.uKTime,uKRimColor:w.uKRimColor,uKRimDir:w.uKRimDir}),super(a,l),this.name=e.name??`orbs:${typeof e.kind==`string`?e.kind:`custom`}`,this.frustumCulled=!1,this.capacity=r,this.style=n,this.motionUniforms=i.uniforms,this.inst=a.getAttribute(`aInst`)??null,n.halo&&(e.halo??!0)){let r=new v({name:`fx.orb.halo`,uniforms:h.merge([ie.fog,{uQuad:{value:n.halo.size},uHaloColor:{value:S(n.halo.color)},uHalo:{value:new t(n.halo.size,n.halo.strength,+!!n.halo.cycle,1)}}]),vertexShader:Ge(i),fragmentShader:qe,defines:{...i.defines,...o,...n.halo.cycle&&e.instanceColors?{FX_ORB_TINT_KEEP_HALO:``}:{}},transparent:!0,depthWrite:!1,blending:2,premultipliedAlpha:!0,fog:e.fog??!0});Object.assign(r.uniforms,c,{uKTime:w.uKTime}),this.haloMesh=new p(a,r),this.haloMesh.name=`${this.name}:halo`,this.haloMesh.frustumCulled=!1,this.haloMesh.raycast=()=>void 0,this.add(this.haloMesh)}else this.haloMesh=null}get instances(){return this.geometry.instanceCount}set instances(e){this.geometry.instanceCount=Math.min(Math.max(0,Math.round(e)),this.capacity)}get radius(){return this.material.uniforms.uRadius.value}set radius(e){this.material.uniforms.uRadius.value=e}get fade(){return this.material.uniforms.uFade.value}set fade(e){this.material.uniforms.uFade.value=e}get intensity(){return this.material.uniforms.uStyle2.value.y}set intensity(e){this.material.uniforms.uStyle2.value.y=e}get glow(){return this.haloMesh?this.haloMesh.material.uniforms.uHalo.value.w:0}set glow(e){this.haloMesh&&(this.haloMesh.material.uniforms.uHalo.value.w=e)}get color(){return this.material.uniforms.uColor.value}setColor(e,t){S(e,this.material.uniforms.uColor.value);let n=this.material.uniforms.uShade.value;return t===void 0?this.style.selfLit>.9?S(e,n).multiplyScalar(.55):S(e,n):S(t,n),this.haloMesh&&!this.style.halo?.cycle&&S(e,this.haloMesh.material.uniforms.uHaloColor.value),this}setPosition(e,t,n,r,i=1){this.inst?.setXYZW(e,t,n,r,i)}setScale(e,t){this.inst?.setW(e,t)}setInstanceColor(e,t,n=1){let r=this.geometry.getAttribute(`aTint`);if(!r)throw Error(`Orbs.setInstanceColor: create the orbs with { instanceColors: true }`);let i=S(t,Xe);r.setXYZW(e,i.r,i.g,i.b,n)}commit(){this.inst&&(this.inst.needsUpdate=!0);let e=this.geometry.getAttribute(`aTint`);e&&(e.needsUpdate=!0)}raycast(e,t){if(!this.inst)return;let n=this.matrixWorld.getMaxScaleOnAxis();for(let r=0;r<this.geometry.instanceCount;r++){let i=this.inst.getW(r);if(i<=0||(Ye.center.set(this.inst.getX(r),this.inst.getY(r),this.inst.getZ(r)).applyMatrix4(this.matrixWorld),Ye.radius=this.radius*i*n,!e.ray.intersectSphere(Ye,Ze)))continue;let a=e.ray.origin.distanceTo(Ze);a<e.near||a>e.far||t.push({distance:a,point:Ze.clone(),object:this,instanceId:r})}}};function V(e){return new Qe(e)}var $e=new y(1,1,1);function H(e,t=.7){return e.clone().lerp($e,t)}var et=`
attribute vec3 aTangent;
attribute vec4 aLine; // x = arc length (units), y = 0…1 along its own line, z = brightness, w = side ∓1
uniform vec4 uRibbon; // half width, quad scale, min pixel half width, viewport height (px)
varying vec4 vLine;
varying float vWidthScale;
void main() {
  vec3 C = ( modelViewMatrix * vec4( position, 1.0 ) ).xyz;
  vec3 T = normalize( ( modelViewMatrix * vec4( aTangent, 0.0 ) ).xyz );
  float mitre = length( aTangent ); // 1, or the mitre length of a mitred joint (RibbonOptions.mitre)
  vec3 side = cross( T, normalize( - C ) );
  float sl = length( side );
  vec3 S = sl > 1e-4 ? side / sl : vec3( 0.0, 1.0, 0.0 );
  float os = length( modelMatrix[ 0 ].xyz );
  float halfW = uRibbon.x * os;
  // never thinner than a few pixels: distant lines stay continuous instead of crawling
  float pxPerUnit = 0.5 * uRibbon.w * projectionMatrix[ 1 ][ 1 ] / max( - C.z, 1e-3 );
  float minW = uRibbon.z / max( pxPerUnit, 1e-6 );
  float w = max( halfW, minW );
  vWidthScale = halfW / w; // dim lines that were widened, so their energy stays the same
  vec3 P = C + S * ( aLine.w * w * mitre * uRibbon.y );
  vLine = aLine;
  gl_Position = projectionMatrix * vec4( P, 1.0 );
}
`,tt=`
precision highp float;
uniform vec3 uColor;
uniform vec3 uCore;
uniform vec4 uDash;  // repeat (dashes per unit), phase, strength 0…1, chevron slant
uniform vec4 uOut;   // intensity, fade, reveal 0…1, base brightness between dashes
uniform vec3 uEnds;  // fade length at line start / end (fractions of the line), core whitening 0…1
varying vec4 vLine;
varying float vWidthScale;
${N}
void main() {
  if ( vLine.y > uOut.z ) discard;
  float a = 1.0 - abs( vLine.w );
  // the quad is wider than the line (uRibbon.y): crisp core inside, soft glow outside
  float core = smoothstep( 0.55, 0.72, a );
  float glow = a * a * 0.35;
  // chevrons: the dash phase lags toward the edges, so every dash is an arrowhead pointing along +u
  float ph = fract( vLine.x * uDash.x - uDash.y + abs( vLine.w ) * uDash.w );
  float dash = smoothstep( 0.0, 0.08, ph ) * smoothstep( 0.62, 0.38, ph );
  float bright = mix( 1.0, uOut.w + ( 1.0 - uOut.w ) * dash * 1.45, uDash.z );
  float ends = smoothstep( 0.0, max( uEnds.x, 1e-4 ), vLine.y ) * smoothstep( 1.0, 1.0 - max( uEnds.y, 1e-4 ), vLine.y );
  // growing tip while the line is being revealed
  float tip = uOut.z < 0.999 ? 1.0 + 1.5 * smoothstep( uOut.z - 0.06, uOut.z, vLine.y ) : 1.0;
  vec3 c = mix( uColor, uCore, core * uEnds.z * bright ) * ( core + glow );
  vec3 rgb = c * ( bright * ends * tip * vLine.z * vWidthScale * uOut.x * uOut.y );
  #if defined( FX_RIBBON_NORMAL )
    // alpha-blended paint (premultiplied): coverage from the crisp core plus a little of the glow; dashes and
    // end fades thin it out instead of darkening it, so the colour stays the palette colour on any backdrop
    float dashCover = mix( 1.0, uOut.w + ( 1.0 - uOut.w ) * dash, uDash.z );
    float alpha = saturate( core + glow * 0.6 ) * dashCover * ends * min( tip, 1.0 ) * vLine.z * vWidthScale * uOut.y;
    vec3 paint = mix( uColor, uCore, core * uEnds.z ) * uOut.x;
    gl_FragColor = vec4( paint * alpha, saturate( alpha ) );
  #elif defined( FX_RIBBON_KEEP_HUE )
    // premultiplied "over": the crisp core hides what is behind it in proportion to its own brightness, so the
    // backdrop does not tint it (amber over indigo read as peach); the soft glow around it stays additive
    float cover = core * saturate( max( rgb.r, max( rgb.g, rgb.b ) ) ) * 0.9;
    gl_FragColor = vec4( fxKeepHue( rgb, 1.3 ), cover );
  #else
    gl_FragColor = vec4( rgb, 0.0 );
  #endif
}
`,U=new f,W=new f,nt=new f,rt=new x,G=class extends p{capacity;dashSpeed;mitre;pos;tan;line;index;constructor(e){let n=e.capacity,r=new ae,i=S(e.color??`white`),a=new v({name:`fx.ribbon`,uniforms:{uRibbon:{value:new t((e.width??.03)/2,3,(e.minPixels??1.4)/2,1080)},uColor:{value:i},uCore:{value:H(i,.7)},uDash:{value:new t(e.dashRepeat??1.2,0,e.dashStrength??.75,.22)},uOut:{value:new t(e.intensity??1.15,1,1,e.base??.4)},uEnds:{value:new f(e.endFade?.[0]??.04,e.endFade?.[1]??.08,e.hotCore??(e.keepHue?0:.1))}},defines:{...e.keepHue?{FX_RIBBON_KEEP_HUE:``}:{},...e.blend===`normal`?{FX_RIBBON_NORMAL:``}:{}},vertexShader:et,fragmentShader:tt,transparent:!0,depthWrite:!1,depthTest:e.depthTest??!0,blending:e.keepHue||e.blend===`normal`?1:2,premultipliedAlpha:!0,side:2});super(r,a),this.name=`ribbon-lines`,this.frustumCulled=!1,this.raycast=()=>void 0,this.capacity=n,this.dashSpeed=e.dashSpeed??.6,this.mitre=e.mitre??!1,this.pos=new g(new Float32Array(n*2*3),3),this.tan=new g(new Float32Array(n*2*3),3),this.line=new g(new Float32Array(n*2*4),4),this.index=new g(new Uint32Array(n*6),1),r.setAttribute(`position`,this.pos),r.setAttribute(`aTangent`,this.tan),r.setAttribute(`aLine`,this.line),r.setIndex(this.index),r.setDrawRange(0,0),r.boundingSphere=new b(new f,1/0),D(this,(e,t)=>{let n=a.uniforms.uDash.value;n.y=(n.y+this.dashSpeed*n.x*t)%1024})}setLines(e){let t=0,n=0;for(let r of e){let e=r.points.length,i=e+ +!!r.closed;if(e<2||t+i>this.capacity)continue;let a=0;for(let t=1;t<i;t++)a+=r.points[t%e].distanceTo(r.points[t-1]);let o=0;for(let s=0;s<i;s++){let c=r.points[s%e],l=r.points[r.closed?(s-1+e)%e:Math.max(s-1,0)],u=r.points[r.closed?(s+1)%e:Math.min(s+1,e-1)];s>0&&(o+=c.distanceTo(r.points[s-1])),U.subVectors(u,l).normalize(),this.mitre&&this.mitreTangent(l,c,u);let d=typeof r.brightness==`number`?r.brightness:r.brightness?.[s%e]??1,f=r.closed?.5:a>0?o/a:0;for(let e=0;e<2;e++){let n=(t+s)*2+e;this.pos.setXYZ(n,c.x,c.y,c.z),this.tan.setXYZ(n,U.x,U.y,U.z),this.line.setXYZW(n,o,f,d,e===0?-1:1)}if(s<i-1){let e=(t+s)*2;this.index.set([e,e+2,e+1,e+1,e+2,e+3],n),n+=6}}t+=i}this.pos.needsUpdate=this.tan.needsUpdate=this.line.needsUpdate=this.index.needsUpdate=!0,this.geometry.setDrawRange(0,n)}mitreTangent(e,t,n){W.subVectors(t,e),nt.subVectors(n,t),W.lengthSq()<1e-12||nt.lengthSq()<1e-12||(W.normalize(),U.copy(nt.normalize()).add(W),U.lengthSq()<1e-8?U.copy(W):U.normalize().multiplyScalar(1/Math.max(U.dot(W),1/3)))}onBeforeRender(e){let t=e.getRenderTarget();this.material.uniforms.uRibbon.value.w=t?t.height:e.getDrawingBufferSize(rt).y}get color(){return this.material.uniforms.uColor.value}setColor(e){let t=S(e,this.color);return this.material.uniforms.uCore.value.copy(H(t,.7)),this}get intensity(){return this.material.uniforms.uOut.value.x}set intensity(e){this.material.uniforms.uOut.value.x=e}get fade(){return this.material.uniforms.uOut.value.y}set fade(e){this.material.uniforms.uOut.value.y=e}get reveal(){return this.material.uniforms.uOut.value.z}set reveal(e){this.material.uniforms.uOut.value.z=e}set width(e){this.material.uniforms.uRibbon.value.x=e/2}},it=new f,at=class extends G{target;history=[];brightness=[];max;interval;since=0;offStep;constructor(e,t={}){let n=t.points??48;super({capacity:n+2,color:t.color??C.electron,width:t.width??.04,intensity:t.intensity??1.4,dashStrength:0,endFade:[0,.02]}),this.target=e,this.name=`trail`,this.max=n,this.interval=(t.duration??.8)/n,this.offStep=ge(e=>{this.parent&&me(this)?this.sample(e):this.history.length=0}),D(this,(e,t)=>{he()||this.sample(t);let n=this.history.length;if(n<2)this.setLines([]);else{for(let e=0;e<n;e++)this.brightness[e]=(1-e/(this.max-1))**2;this.brightness.length=n,this.setLines([{points:this.history,brightness:this.brightness}])}})}sample(e){e>this.interval*12&&(this.history.length=0),this.since+=e,this.target.updateWorldMatrix(!0,!1),this.target.getWorldPosition(it),this.parent&&(this.parent.updateWorldMatrix(!0,!1),this.parent.worldToLocal(it));let t=this.history[0];!t||this.since>=this.interval?(this.since=0,this.history.unshift(it.clone()),this.history.length>this.max&&this.history.pop()):t.copy(it)}dispose(){this.offStep()}reset(){this.history.length=0}};function ot(e,t={}){return new at(e,t)}var st=`
  attribute float aAge;
  uniform float uKTime, uPixel, uSize, uLife, uFade, uSpread, uSwirl;
  varying float vAlpha;
  varying float vFresh;
  float hash( float n ) { return fract( sin( n * 12.9898 ) * 43758.5453 ); }
  void main() {
    float id = float( gl_VertexID );
    float seed = hash( id );
    vec3 p = position * uSpread;
    // slow differential swirl around Y keeps a static cloud alive
    float a = uKTime * uSwirl * ( 0.5 + seed );
    float c = cos( a ), s = sin( a );
    p = vec3( p.x * c - p.z * s, p.y, p.x * s + p.z * c );
    vec4 mv = modelViewMatrix * vec4( p, 1.0 );
    gl_Position = projectionMatrix * mv;
    float life = clamp( 1.0 - aAge / uLife, 0.0, 1.0 );
    vFresh = 1.0 - smoothstep( 0.0, 0.35, aAge );
    float twinkle = 0.7 + 0.3 * sin( uKTime * ( 1.3 + seed * 2.0 ) + seed * 40.0 );
    // dithered dissolve for stage fades: dots vanish one by one
    float keep = step( hash( id + 3.7 ), uFade * 1.001 );
    vAlpha = life * twinkle * keep;
    float size = uSize * ( 0.75 + 0.5 * seed ) * ( 1.0 + 0.9 * vFresh );
    gl_PointSize = vAlpha > 0.0 ? max( size * uPixel / max( -mv.z, 1e-3 ), 1.5 ) : 0.0;
  }
`,ct=`
  uniform vec3 uColor, uFlash;
  uniform float uIntensity;
  varying float vAlpha;
  varying float vFresh;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r2 = dot( d, d ) * 4.0;
    if ( r2 > 1.0 ) discard;
    float soft = exp( -r2 * 3.2 ) - 0.04;
    vec3 color = mix( uColor, uFlash, vFresh * 0.8 );
    gl_FragColor = vec4( color * soft * vAlpha * uIntensity * ( 1.0 + vFresh ), 0.0 );
  }
`,lt=new x,ut=class extends ee{capacity;positionAttr;ageAttr;constructor(e){let t=new ae,n=new g(new Float32Array(e.capacity*3),3),r=new g(new Float32Array(e.capacity),1);t.setAttribute(`position`,n),t.setAttribute(`aAge`,r),t.setDrawRange(0,0);let i=new v({name:`fx.cloud`,uniforms:{uKTime:w.uKTime,uPixel:{value:600},uSize:{value:e.size??.12},uLife:{value:e.lifetime??6},uFade:{value:1},uSpread:{value:1},uSwirl:{value:0},uIntensity:{value:e.intensity??.9},uColor:{value:S(e.color??`cyan`)},uFlash:{value:S(e.flash??`white`)}},vertexShader:st,fragmentShader:ct,transparent:!0,depthWrite:!1,blending:2,premultipliedAlpha:!0});super(t,i),this.name=`cloud`,this.capacity=e.capacity,this.frustumCulled=!1,this.positionAttr=n,this.ageAttr=r,this.raycast=()=>void 0,this.onBeforeRender=(e,t,n)=>{let r=e.getRenderTarget(),a=r?r.height:e.getDrawingBufferSize(lt).y;i.uniforms.uPixel.value=.5*a*n.projectionMatrix.elements[5]}}setPoints(e,t=e.length/3){let n=Math.min(t,this.capacity);this.positionAttr.array.set(e.subarray(0,n*3)),this.ageAttr.array.fill(1,0,n),this.positionAttr.needsUpdate=!0,this.ageAttr.needsUpdate=!0,this.geometry.setDrawRange(0,n),this.material.uniforms.uLife.value=1e9}sync(e,t){let n=Math.min(t.length,this.capacity);this.positionAttr.array.set(e.subarray(0,n*3));let r=this.ageAttr.array;for(let e=0;e<n;e++)r[e]=Number.isFinite(t[e])?t[e]:1e9;this.positionAttr.needsUpdate=!0,this.ageAttr.needsUpdate=!0,this.geometry.setDrawRange(0,n)}uniform(e){return this.material.uniforms[e]}get fade(){return this.uniform(`uFade`).value}set fade(e){this.uniform(`uFade`).value=e}get intensity(){return this.uniform(`uIntensity`).value}set intensity(e){this.uniform(`uIntensity`).value=e}get spread(){return this.uniform(`uSpread`).value}set spread(e){this.uniform(`uSpread`).value=e}get swirl(){return this.uniform(`uSwirl`).value}set swirl(e){this.uniform(`uSwirl`).value=e}get dotSize(){return this.uniform(`uSize`).value}set dotSize(e){this.uniform(`uSize`).value=e}get color(){return this.material.uniforms.uColor.value}get flash(){return this.material.uniforms.uFlash.value}fill(e,t){let n=Math.min(e,this.capacity),r=new Float32Array(n*3),i=[0,0,0];for(let e=0;e<n;e++)t(e,i),r.set(i,e*3);this.setPoints(r,n)}dispose(){this.geometry.dispose(),this.material.dispose()}};function dt(e){return new ut(e)}function ft(e,n,r){return{pars:`
      attribute vec4 aInst; // xyz home position in box coordinates 0…1, w scale
      attribute vec4 aVel;  // xyz wander frequencies, w seed
      uniform vec3 uBox;
      uniform vec4 uGas;    // xyz drift displacement (units), w thermal phase
      uniform float uWander;
    `,main:`
      float tau = uGas.w;
      vec3 f = aVel.xyz;
      float s0 = aVel.w * 6.2832;
      // bounded wandering: two incommensurate sines per axis read as random thermal jitter, never wrap
      vec3 wob = vec3(
        sin( tau * f.x + s0 ) + 0.55 * sin( tau * f.y * 2.3 + s0 * 3.1 ),
        sin( tau * f.y + s0 * 1.7 ) + 0.55 * sin( tau * f.z * 2.1 + s0 * 2.3 ),
        sin( tau * f.z + s0 * 2.9 ) + 0.55 * sin( tau * f.x * 1.9 + s0 * 1.3 ) ) * ( uWander / 1.55 );
      vec3 q = fract( aInst.xyz + ( uGas.xyz + wob ) / uBox );
      // particles carried through a wall by the drift shrink out and grow back in on the other side
      vec3 edge = smoothstep( 0.0, 0.05, q ) * smoothstep( 1.0, 0.95, q );
      center = ( q - 0.5 ) * uBox;
      scale = aInst.w * edge.x * edge.y * edge.z;
      seed = aVel.w;
    `,uniforms:{uBox:{value:new f(...n)},uGas:{value:new t(0,0,0,0)},uWander:{value:r}},attributes(t,n){let r=new Float32Array(n*4),i=new Float32Array(n*4);for(let t=0;t<n;t++)r.set([e.next(),e.next(),e.next(),1],t*4),i.set([e.range(1.2,3.2),e.range(1.2,3.2),e.range(1.2,3.2),e.next()],t*4);I(t,`aInst`,r,4),I(t,`aVel`,i,4)}}}var pt=class extends Qe{thermal;drift;unfollow;constructor(e,t){let n=t.exactCount?t.count:be(e,t.count),r=t.wander??Math.min(...t.box)*.12;super({...t,count:n,motion:ft(e.random.fork(t.seed??`gas`),t.box,r),name:t.name??`gas`}),this.thermal=t.thermal??1,this.drift=new f(...t.drift??[0,0,0]),this.unfollow=t.exactCount?()=>void 0:ye(e,t.count,n,e=>this.instances=e);let i=this.motionUniforms.uGas.value,a=this.motionUniforms.uBox.value;D(this,(e,t)=>{i.w+=t*this.thermal,i.x=(i.x+this.drift.x*t)%a.x,i.y=(i.y+this.drift.y*t)%a.y,i.z=(i.z+this.drift.z*t)%a.z})}get wander(){return this.motionUniforms.uWander.value}set wander(e){this.motionUniforms.uWander.value=e}dispose(){this.unfollow()}};function mt(e,t){return new pt(e,t)}var ht=`
attribute vec4 aOrigin; // xyz origin, w phase 0…1
attribute vec4 aDir;    // xyz unit direction, w scale
uniform float uKTime;
uniform vec4 uShape; // length, amplitude, half thickness, waves
uniform vec4 uAnim;  // carrier angular speed, travel distance, stream phase (cycles), unused
varying vec2 vRib;
varying float vEnv;
${F}
void main() {
  float s = position.x;
  float os = fxObjectScale() * aDir.w;
  float travel = uAnim.y;
  float u = fract( aOrigin.w + uAnim.z );
  vec3 c = aOrigin.xyz + aDir.xyz * ( travel > 0.0 ? u * travel : 0.0 );
  float streamFade = travel > 0.0 ? smoothstep( 0.0, 0.1, u ) * smoothstep( 1.0, 0.86, u ) : 1.0;
  vec3 C = ( modelViewMatrix * vec4( c, 1.0 ) ).xyz;
  vec3 D = normalize( ( modelViewMatrix * vec4( aDir.xyz, 0.0 ) ).xyz );
  vec3 side = cross( D, normalize( - C ) );
  float sl = length( side );
  vec3 S = sl > 1e-4 ? side / sl : vec3( 0.0, 1.0, 0.0 );
  float len = uShape.x * os;
  float x = s - 0.5;
  const float SIGMA2 = 0.19 * 0.19;
  float env = exp( - x * x / ( 2.0 * SIGMA2 ) );
  float k = 6.2832 * uShape.w;
  float ph = k * s - uKTime * uAnim.x - aOrigin.w * 40.0;
  float amp = uShape.y * os;
  float w = sin( ph ) * amp * env;
  // slope of the centre line → offset along its normal keeps the ribbon equally thick on steep flanks
  float dw = ( cos( ph ) * k - sin( ph ) * x / SIGMA2 ) * env * amp / len;
  vec2 nrm = normalize( vec2( - dw, 1.0 ) );
  float off = position.y * 2.0 * uShape.z * os * 3.2 * ( 0.35 + 0.65 * env );
  vec3 P = C + D * ( x * len + nrm.x * off ) + S * ( w + nrm.y * off );
  vRib = vec2( s, position.y * 2.0 );
  vEnv = env * streamFade * step( 1e-4, aDir.w );
  gl_Position = projectionMatrix * vec4( P, 1.0 );
}
`,gt=`
precision highp float;
uniform vec3 uColor;
uniform vec3 uCore;
uniform vec4 uOut; // intensity, fade
varying vec2 vRib;
varying float vEnv;
${N}
void main() {
  float a = 1.0 - abs( vRib.y );
  // the quad is 3.2× the line thickness: a crisp core in the middle, a soft glow around it
  float core = smoothstep( 0.62, 0.78, a );
  float glow = a * a * 0.4;
  #ifdef FX_PHOTON_KEEP_HUE
    vec3 c = uColor * ( core + glow ) * ( vEnv * uOut.x * uOut.y );
    // premultiplied "over": the core hides the backdrop in proportion to its brightness (the glow stays additive)
    gl_FragColor = vec4( fxKeepHue( c, 1.3 ), core * saturate( max( c.r, max( c.g, c.b ) ) ) * 0.9 );
  #else
    vec3 c = mix( uColor, uCore, core * 0.8 ) * ( core + glow );
    gl_FragColor = vec4( c * ( vEnv * uOut.x * uOut.y ), 0.0 );
  #endif
}
`,_t=class extends p{capacity;speed;origin;dir;constructor(e={}){let n=Math.max(1,e.count??1),r=Pe(56,n),i=e.wavelength===void 0?null:xe(e.wavelength),a=e.color===void 0?i?.color??S(C.photon):S(e.color),o=i&&i.band!==`visible`?.6:1,s=e.keepHue??i!==null,c=new v({name:`fx.photon`,uniforms:{uKTime:w.uKTime,uShape:{value:new t(e.length??1.6,e.amplitude??.13,(e.width??.05)/2,e.waves??i?.waves??5)},uAnim:{value:new t(14,e.travel??0,0,0)},uColor:{value:a},uCore:{value:H(a,.5)},uOut:{value:new t((e.intensity??1.7)*o,1,0,0)}},vertexShader:ht,fragmentShader:gt,defines:s?{FX_PHOTON_KEEP_HUE:``}:{},transparent:!0,depthWrite:!1,blending:s?1:2,premultipliedAlpha:!0,side:2});super(r,c),this.name=e.name??`photons`,this.frustumCulled=!1,this.raycast=()=>void 0,this.capacity=n,this.speed=e.speed??3,this.origin=I(r,`aOrigin`,new Float32Array(n*4),4),this.dir=I(r,`aDir`,new Float32Array(n*4),4);for(let e=0;e<n;e++)this.origin.setXYZW(e,0,0,0,e*.61803%1),this.dir.setXYZW(e,1,0,0,1);D(this,(e,t)=>{let n=c.uniforms.uAnim.value;n.y>0&&(n.z=(n.z+this.speed*t/n.y)%1024)})}setPhoton(e,t,n,r,i=1){let a=Math.hypot(n[0],n[1],n[2])||1;this.origin.setXYZW(e,t[0],t[1],t[2],r??this.origin.getW(e)),this.dir.setXYZW(e,n[0]/a,n[1]/a,n[2]/a,i)}commit(){this.origin.needsUpdate=!0,this.dir.needsUpdate=!0}setWavelength(e){let t=xe(e);return this.setColor(t.color),this.material.uniforms.uShape.value.w=t.waves,this}setColor(e){let t=S(e,this.material.uniforms.uColor.value);return this.material.uniforms.uCore.value.copy(H(t,.5)),this}get travel(){return this.material.uniforms.uAnim.value.y}set travel(e){this.material.uniforms.uAnim.value.y=e}get intensity(){return this.material.uniforms.uOut.value.x}set intensity(e){this.material.uniforms.uOut.value.x=e}get fade(){return this.material.uniforms.uOut.value.y}set fade(e){this.material.uniforms.uOut.value.y=e}};function vt(e={}){return new _t({...e,count:1})}function yt(e){return new _t(e)}var bt=`
attribute vec4 aA; // xyz end A, w seed
attribute vec4 aB; // xyz end B, w strength (0 hides)
uniform float uKTime;
uniform vec4 uSpring; // turns, amplitude, half thickness, rest length
varying vec3 vRib; // s, across, front (−1 behind … +1 in front)
varying float vSeed;
varying float vStrength;
${F}
void main() {
  float s = position.x;
  float os = fxObjectScale();
  vec3 A = ( modelViewMatrix * vec4( aA.xyz, 1.0 ) ).xyz;
  vec3 B = ( modelViewMatrix * vec4( aB.xyz, 1.0 ) ).xyz;
  vec3 AB = B - A;
  float len = max( length( AB ), 1e-4 );
  vec3 D = AB / len;
  vec3 C = mix( A, B, s );
  vec3 side = cross( D, normalize( - C ) );
  float sl = length( side );
  vec3 S = sl > 1e-4 ? side / sl : vec3( 0.0, 1.0, 0.0 );
  float seed = aA.w;
  float t = uKTime;
  // a stretched spring keeps its turns and gets slimmer; a compressed one bulges
  float tension = clamp( uSpring.w * os / len, 0.3, 1.5 );
  float jitter = 1.0 + 0.16 * sin( t * 9.0 + seed * 40.0 ) + 0.08 * sin( t * 14.3 + seed * 17.0 );
  float taper = pow( sin( 3.14159 * s ), 0.6 );
  float amp = uSpring.y * os * tension * jitter * taper;
  float k = 6.2832 * uSpring.x;
  float ph = k * s + 0.5 * sin( t * 6.0 + seed * 23.0 ) - t * 1.7;
  float w = sin( ph ) * amp;
  float front = cos( ph );
  float dw = cos( ph ) * k * amp / len;
  vec2 nrm = normalize( vec2( - dw, 1.0 ) );
  float off = position.y * 2.0 * uSpring.z * os * 2.6 * mix( 0.75, 1.15, front * 0.5 + 0.5 );
  vec3 P = C + D * ( nrm.x * off ) + S * ( w + nrm.y * off );
  P.z += front * amp * 0.5; // the front strand really is nearer: it wins the depth test against orbs
  vRib = vec3( s, position.y * 2.0, front );
  vSeed = seed;
  vStrength = aB.w;
  gl_Position = projectionMatrix * vec4( P, 1.0 );
}
`,xt=`
precision highp float;
uniform float uKTime;
uniform vec3 uColor;
uniform vec3 uCore;
uniform vec4 uOut; // intensity, fade
varying vec3 vRib;
varying float vSeed;
varying float vStrength;
${N}
void main() {
  float a = 1.0 - abs( vRib.y );
  float core = smoothstep( 0.55, 0.75, a );
  float glow = a * a * 0.4;
  float depthCue = mix( 0.4, 1.0, vRib.z * 0.5 + 0.5 );
  // virtual gluons: bright beads running from end to end
  float bead = pow( max( sin( 6.2832 * ( vRib.x * 1.5 - uKTime * 0.9 + vSeed ) ), 0.0 ), 14.0 );
  vec3 c = mix( uColor, uCore, saturate( core * 0.7 + bead ) ) * ( core + glow ) * ( depthCue + bead * 1.6 );
  gl_FragColor = vec4( c * ( uOut.x * uOut.y * vStrength ), 0.0 );
}
`,St=class extends p{capacity;a;b;constructor(e={}){let n=Math.max(1,e.count??1),r=Pe(96,n),i=S(e.color??C.gluon),a=new v({name:`fx.gluon`,uniforms:{uKTime:w.uKTime,uSpring:{value:new t(e.turns??7,e.amplitude??.1,(e.width??.035)/2,e.restLength??1)},uColor:{value:i},uCore:{value:H(i,.45)},uOut:{value:new t(e.intensity??1.25,1,0,0)}},vertexShader:bt,fragmentShader:xt,transparent:!0,depthWrite:!1,blending:2,premultipliedAlpha:!0,side:2});super(r,a),this.name=e.name??`gluons`,this.frustumCulled=!1,this.raycast=()=>void 0,this.capacity=n,this.a=I(r,`aA`,new Float32Array(n*4),4),this.b=I(r,`aB`,new Float32Array(n*4),4);for(let e=0;e<n;e++)this.a.setXYZW(e,-.5,0,0,e*.7548%1),this.b.setXYZW(e,.5,0,0,1)}setEnds(e,t,n,r=1){this.a.setXYZ(e,t[0],t[1],t[2]),this.b.setXYZW(e,n[0],n[1],n[2],r)}commit(){this.a.needsUpdate=!0,this.b.needsUpdate=!0}get color(){return this.material.uniforms.uColor.value}get intensity(){return this.material.uniforms.uOut.value.x}set intensity(e){this.material.uniforms.uOut.value.x=e}get fade(){return this.material.uniforms.uOut.value.y}set fade(e){this.material.uniforms.uOut.value.y=e}};function Ct(e={}){return new St(e)}function wt(e={}){return V({kind:`electron`,radius:.17,...e})}function Tt(e={}){return V({kind:`proton`,radius:.5,...e})}function Et(e={}){return V({kind:`neutron`,radius:.5,...e})}function Dt(e={}){let{sign:t,...n}=e;return V({kind:`ion`,radius:.3,glyph:t,...n})}function Ot(e,t={}){return V({kind:e===`up`?`quarkUp`:`quarkDown`,radius:.22,...t})}function kt(e={}){return V({kind:`hole`,radius:.17,...e})}function At(e,t){if(Array.isArray(e)){let n=e.map(e=>e.clone());return t&&n.length>1&&n[0].distanceTo(n[n.length-1])>1e-6&&n.push(n[0].clone()),n}let n=e.getPoints(400);return t&&n[0].distanceTo(n[n.length-1])>1e-6&&n.push(n[0].clone()),n}function jt(e,t=256,n=!1){let r=At(e,n);if(r.length<2)throw Error(`bakePath: a path needs at least two points`);let i=new Float64Array(r.length);for(let e=1;e<r.length;e++)i[e]=i[e-1]+r[e].distanceTo(r[e-1]);let a=i[r.length-1],o=new Float32Array(t*3),s=n?t:t-1,c=0;for(let e=0;e<t;e++){let t=e/s*a;for(;c<r.length-2&&i[c+1]<t;)c++;let n=i[c+1]-i[c],l=n>1e-9?(t-i[c])/n:0,u=r[c],d=r[c+1];o[e*3]=u.x+(d.x-u.x)*l,o[e*3+1]=u.y+(d.y-u.y)*l,o[e*3+2]=u.z+(d.z-u.z)*l}return{points:o,samples:t,length:a,closed:n}}function Mt(e,t,n=new f){let r=e.samples,i;i=e.closed?(t-Math.floor(t))*r:Math.min(Math.max(t,0),1)*(r-1);let a=Math.min(Math.floor(i),r-1),o=i-a,s=e.closed?(a+1)%r:Math.min(a+1,r-1),c=e.points;return n.set(c[a*3]+(c[s*3]-c[a*3])*o,c[a*3+1]+(c[s*3+1]-c[a*3+1])*o,c[a*3+2]+(c[s*3+2]-c[a*3+2])*o)}var Nt=new f,Pt=new f;function Ft(e,t,n=new f){let r=.5/e.samples;return Mt(e,t+r,Nt),Mt(e,t-r,Pt),n.subVectors(Nt,Pt),n.lengthSq()>1e-12?n.normalize():n.set(1,0,0)}function It(e){let t=[];for(let n of e)for(let e of At(n,!1)){let n=t[t.length-1];(!n||n.distanceTo(e)>1e-6)&&t.push(e)}return t}var Lt=class{paths;samples;texture;params;paramData;constructor(e,t=256){if(e.length===0)throw Error(`PathSet: at least one path is required`);this.samples=t,this.paths=e.map(e=>jt(e.path,t,e.closed??!1));let n=this.paths.length,r=new Float32Array(t*n*4);this.paths.forEach((e,n)=>{for(let i=0;i<t;i++){let a=(n*t+i)*4;r[a]=e.points[i*3],r[a+1]=e.points[i*3+1],r[a+2]=e.points[i*3+2],r[a+3]=1}}),this.texture=Rt(r,t,n),this.paramData=new Float32Array(n*4),this.paths.forEach((e,t)=>{this.paramData[t*4+1]=1,this.paramData[t*4+3]=+!!e.closed}),this.params=Rt(this.paramData,1,n)}get count(){return this.paths.length}setPath(e,t,n=this.paths[e].closed){if(e<0||e>=this.paths.length)throw Error(`PathSet: no path row ${e}`);let r=jt(t,this.samples,n);this.paths[e]=r;let i=this.texture.image.data;for(let t=0;t<this.samples;t++){let n=(e*this.samples+t)*4;i[n]=r.points[t*3],i[n+1]=r.points[t*3+1],i[n+2]=r.points[t*3+2]}this.texture.needsUpdate=!0,this.paramData[e*4+3]=+!!r.closed,this.params.needsUpdate=!0}getPhase(e){return this.paramData[e*4]}setPhase(e,t){this.paramData[e*4]=t-Math.floor(t/64)*64,this.params.needsUpdate=!0}setDensity(e,t){this.paramData[e*4+1]=t,this.params.needsUpdate=!0}getDensity(e){return this.paramData[e*4+1]}setOffset(e,t){this.paramData[e*4+2]=t,this.params.needsUpdate=!0}dispose(){this.texture.dispose(),this.params.dispose()}};function Rt(e,t,r){let a=new de(e,t,r,ce,n);return a.minFilter=i,a.magFilter=i,a.generateMipmaps=!1,a.needsUpdate=!0,a}var zt=`
uniform sampler2D tPath;
uniform sampler2D tPathParams;
uniform float uPathSamples;
vec3 fxPathPoint( float row, float u, float closed ) {
  float n = uPathSamples;
  float x = closed > 0.5 ? fract( u ) * n : clamp( u, 0.0, 1.0 ) * ( n - 1.0 );
  float i0 = min( floor( x ), n - 1.0 );
  float i1 = closed > 0.5 ? mod( i0 + 1.0, n ) : min( i0 + 1.0, n - 1.0 );
  vec3 a = texelFetch( tPath, ivec2( int( i0 ), int( row ) ), 0 ).xyz;
  vec3 b = texelFetch( tPath, ivec2( int( i1 ), int( row ) ), 0 ).xyz;
  return mix( a, b, x - i0 );
}
`;function Bt(e,n,r){return{pars:`
      attribute vec4 aInst;
      attribute float aSeed;
      uniform vec4 uFlow; // spread radius, wobble amplitude, bidirectional, end fade
      ${zt}
    `,main:`
      vec4 pp = texelFetch( tPathParams, ivec2( 0, int( aInst.x ) ), 0 );
      float closed = pp.w;
      float dirSign = ( uFlow.z > 0.5 && aSeed > 0.5 ) ? -1.0 : 1.0;
      float u = fract( aInst.y + dirSign * pp.x ) + pp.z;
      float ends = 1.0;
      if ( closed < 0.5 ) {
        // an AC swing must not carry a particle out of an open path: wrap, then fade at both ends
        u = fract( u );
        ends = smoothstep( 0.0, uFlow.w, u ) * smoothstep( 1.0, 1.0 - uFlow.w, u );
      }
      vec3 p = fxPathPoint( aInst.x, u, closed );
      vec3 tangent = fxPathPoint( aInst.x, u + 1.0 / uPathSamples, closed ) - fxPathPoint( aInst.x, u - 1.0 / uPathSamples, closed );
      tangent = length( tangent ) > 1e-6 ? normalize( tangent ) : vec3( 1.0, 0.0, 0.0 );
      // a fixed skew reference avoids a frame flip on axis-aligned paths
      vec3 nrm = normalize( cross( tangent, vec3( 0.31, 0.89, 0.33 ) ) );
      vec3 bin = cross( tangent, nrm );
      float tw = uKTime * ( 1.6 + aSeed * 2.4 ) + aSeed * 40.0;
      vec2 lat = aInst.zw * uFlow.x + vec2( sin( tw ), cos( tw * 1.31 ) ) * uFlow.y;
      center = p + nrm * lat.x + bin * lat.y + tangent * ( sin( tw * 0.77 ) * uFlow.y );
      float dens = smoothstep( aSeed - 0.03, aSeed + 0.03, pp.y * 1.06 - 0.03 );
      scale = ends * dens;
      seed = aSeed;
    `,uniforms:{tPath:{value:e.texture},tPathParams:{value:e.params},uPathSamples:{value:e.samples},uFlow:{value:new t(r.spread,r.wobble,+!!r.bidirectional,r.endFade)}},attributes(e,t){let i=new Float32Array(t*4),a=new Float32Array(t),o=[],s=0;for(let e of r.weights)o.push(s+=e);let c=Array(r.weights.length).fill(0);for(let e=0;e<t;e++){let l=(e+.5)/t*s,u=o.findIndex(e=>l<=e);u<0&&(u=o.length-1);let d=c[u]++,f=Math.max(1,Math.round(t*r.weights[u]/s)),p=n.next()*Math.PI*2,m=Math.sqrt(n.next()),h=d*.61803398875%1+n.signed(.25/f);i.set([u,(h+1)%1,Math.cos(p)*m,Math.sin(p)*m],e*4),a[e]=n.next()}I(e,`aInst`,i,4),I(e,`aSeed`,a,1)}}}function Vt(e){return Array.isArray(e)&&e.length>0&&typeof e[0].path==`object`}var Ht=class extends Qe{pathSet;speed;ac;pathSpeed;acPhase=0;unfollow;constructor(e,t){let n=Vt(t.paths)?t.paths:[{path:t.paths,closed:t.closed}],r=new Lt(n,t.samples??256),i=n.map((e,t)=>e.weight??r.paths[t].length),a=t.exactCount?t.count:be(e,t.count);super({...t,count:a,name:t.name??`flow`,motion:Bt(r,e.random.fork(t.seed??`flow`),{spread:t.spread??0,wobble:t.wobble??0,bidirectional:t.bidirectional??!1,endFade:t.endFade??.06,weights:i})}),this.pathSet=r,this.speed=t.speed??1,this.ac={amplitude:t.ac?.amplitude??0,frequency:t.ac?.frequency??1},this.pathSpeed=n.map(()=>1),this.unfollow=t.exactCount?()=>void 0:ye(e,t.count,a,e=>this.instances=e),D(this,(e,t)=>{this.acPhase=(this.acPhase+t*this.ac.frequency*Math.PI*2)%(Math.PI*2);let n=Math.sin(this.acPhase)*this.ac.amplitude;for(let e=0;e<r.count;e++){let i=r.paths[e].length;r.setPhase(e,r.getPhase(e)+this.speed*this.pathSpeed[e]*t/i),r.setOffset(e,n/i)}})}get density(){return this.pathSet.getDensity(0)}set density(e){for(let t=0;t<this.pathSet.count;t++)this.pathSet.setDensity(t,e)}setPaths(e){let t=Vt(e)?e:[{path:e}];if(t.length!==this.pathSet.count)throw Error(`Flow.setPaths: expected ${this.pathSet.count} path(s), got ${t.length}`);t.forEach((e,t)=>this.pathSet.setPath(t,e.path,e.closed??this.pathSet.paths[t].closed))}setPath(e,t,n){this.pathSet.setPath(e,t,n)}setPathDensity(e,t){this.pathSet.setDensity(e,t)}setPathSpeed(e,t){this.pathSpeed[e]=t}get spread(){return this.motionUniforms.uFlow.value.x}set spread(e){this.motionUniforms.uFlow.value.x=e}get wobble(){return this.motionUniforms.uFlow.value.y}set wobble(e){this.motionUniforms.uFlow.value.y=e}dispose(){this.unfollow(),this.pathSet.dispose()}};function Ut(e,t){return new Ht(e,t)}var Wt=new f,Gt=new f,Kt=new ue,qt=new ue,Jt=new f,Yt=new a,Xt=new f(1,0,0),Zt=class extends r{speed;density=1;path;phase=0;constructor(e,t){super(t.geometry,t.material,t.count),this.name=`mesh-flow`,this.frustumCulled=!1,this.castShadow=t.castShadow??!0,this.receiveShadow=!0,this.speed=t.speed??1,this.path=jt(t.path,256,t.closed??!1);let n=e.random.fork(t.seed??`mesh-flow`),r=t.scale??[1,1],i=t.jitter??0,a=Array.from({length:t.count},(e,a)=>({offset:(a+n.signed(.3))/t.count,scale:n.range(r[0],r[1]),side:new f(n.signed(i),n.signed(i*.4),n.signed(i)),axis:new f(...n.onSphere()),spin:n.range(.5,1),seed:n.next()})),o=t.align??!0,s=t.tumble??0,c=t.endFade??.05;D(this,(e,t)=>{this.phase=(this.phase+this.speed*t/this.path.length)%1,a.forEach((t,n)=>{let r=t.offset+this.phase;r-=Math.floor(r),Mt(this.path,r,Wt).add(t.side),Kt.identity(),o&&Kt.setFromUnitVectors(Xt,Ft(this.path,r,Gt)),s>0&&Kt.multiply(qt.setFromAxisAngle(t.axis,e*s*t.spin+t.seed*6.28));let i=t.seed<=this.density?t.scale:0;this.path.closed||(i*=Math.min(1,r/c,(1-r)/c)),this.setMatrixAt(n,Yt.compose(Wt,Kt,Jt.setScalar(Math.max(i,1e-5))))}),this.instanceMatrix.needsUpdate=!0})}};function Qt(e,t){return new Zt(e,t)}function $t(e){return(Array.isArray(e)?e.map(e=>e.clone()):e.getPoints(200)).reverse()}function en(e,t){if(t.length===0)throw Error(`flowNetwork: at least one route is required`);let n=t.reduce((e,t)=>e+Math.max(t.weight,0),0)||1,r=t.map(t=>({path:It(t.via.map(t=>{let n=t.startsWith(`-`),r=e[n?t.slice(1):t];if(!r)throw Error(`flowNetwork: unknown edge '${t}'`);return n?$t(r):r})),closed:t.closed??!1,weight:Math.max(t.weight,0)/n}));return{paths:r,weights:r.map(e=>e.weight)}}function tn(e){let t=e.reduce((e,t)=>e+Math.max(t,0),0);return e.map(n=>t>0?Math.max(n,0)/t:1/e.length)}function nn(e,t){if(t<=1e-9||e<=1e-9)return 1/0;let n=e*e/(8*t);for(let r=0;r<24;r++){let r=e/(2*n),i=n*(Math.cosh(r)-1)-t,a=Math.cosh(r)-1-r*Math.sinh(r),o=n-i/a;if(!Number.isFinite(o)||o<=0)break;if(Math.abs(o-n)<1e-10*n){n=o;break}n=o}return n}function rn(e,t){let n=nn(e,t);return Number.isFinite(n)?2*n*Math.sinh(e/(2*n)):e}function an(e,t,n,r=24){let i=t.x-e.x,a=t.z-e.z,o=Math.hypot(i,a),s=t.y-e.y,c=[],l=nn(o,n);if(!Number.isFinite(l)||o<1e-9){for(let n=0;n<=r;n++)c.push(e.clone().lerp(t,n/r));return c}let u=o/2-l*Math.asinh(s/(2*l*Math.sinh(o/(2*l)))),d=e.y-l*Math.cosh(-u/l);for(let t=0;t<=r;t++){let n=t/r,s=n*o;c.push(new f(e.x+i*n,d+l*Math.cosh((s-u)/l),e.z+a*n))}return c[r].copy(t),c}function on(e,t={},n=0){let r=e.getLength(),i=Math.max(8,Math.ceil(r*(t.detail??6))),a=new re(e,i,t.radius??.03,t.radialSegments??10,!1),o=a.getAttribute(`uv`);for(let e=0;e<o.count;e++)o.setX(e,o.getX(e)*r+n);return a}function sn(e,t=!1){return new _([...e],t,`centripetal`)}function cn(e,t={}){let n=Array.isArray(e)?sn(e):e,r=t.repeat??.8,i=T.energy({color:t.color??`ink`,pulseColor:t.pulseColor??C.current,repeat:r,speed:(t.speed??1.5)*r,length:t.length??.45,intensity:t.intensity??3.2,power:t.power??1}),a=new p(on(n,t,(t.phase??0)/r),i);return a.name=`wire`,a.castShadow=t.castShadow??!0,a.receiveShadow=!0,a.wireLength=n.getLength(),a}function ln(e,t,n,r={}){return cn(sn(an(e,t,n,20)),{detail:3,...r})}function un(e,t,n={}){let r=new u;r.name=`wire-bundle`;let i=n.colors??[C.phaseL1,C.phaseL2,C.phaseL3],a=Math.min(e.length,t.length),o=n.repeat??.8,s=Array.from({length:a},(r,o)=>ln(e[o],t[o],n.sag??0,{...n,pulseColor:i[o%i.length],phase:o/a}));return r.add(...s),r.wires=s,r.setPower=e=>s.forEach(t=>t.material.power=e),r.setSpeed=e=>s.forEach(t=>t.material.speed=e*o),r}var dn=`
uniform vec3 uFrom;
uniform vec3 uTo;
uniform vec4 uBeam; // half core width, reach 0…1, unused, unused
varying vec2 vRib;
varying float vLen;
void main() {
  vec3 A = ( modelViewMatrix * vec4( uFrom, 1.0 ) ).xyz;
  vec3 B = ( modelViewMatrix * vec4( mix( uFrom, uTo, uBeam.y ), 1.0 ) ).xyz;
  vec3 D = B - A;
  float len = max( length( D ), 1e-5 );
  vec3 C = mix( A, B, position.x );
  vec3 side = cross( D / len, normalize( - C ) );
  float sl = length( side );
  vec3 S = sl > 1e-4 ? side / sl : vec3( 0.0, 1.0, 0.0 );
  float os = length( modelMatrix[ 0 ].xyz );
  vec3 P = C + S * ( position.y * 2.0 * uBeam.x * os * 4.0 );
  vRib = vec2( position.x, position.y * 2.0 );
  vLen = len;
  gl_Position = projectionMatrix * vec4( P, 1.0 );
}
`,fn=`
precision highp float;
uniform float uKTime;
uniform vec3 uColor;
uniform vec3 uCore;
uniform vec4 uOut; // intensity, fade, ripple speed, ripple strength
varying vec2 vRib;
varying float vLen;
${N}
void main() {
  float a = 1.0 - abs( vRib.y );
  float core = smoothstep( 0.68, 0.8, a );
  float glow = a * a * 0.4;
  float d = vRib.x * vLen;
  float ripple = 1.0 + uOut.w * ( sin( d * 5.0 - uKTime * uOut.z * 5.0 ) * 0.6 + sin( d * 1.7 - uKTime * uOut.z * 1.9 ) * 0.4 );
  // soft start and end caps
  float caps = smoothstep( 0.0, 0.03, vRib.x ) * smoothstep( 1.0, 0.985, vRib.x );
  vec3 c = mix( uColor, uCore, core ) * ( core + glow ) * ripple;
  gl_FragColor = vec4( c * ( caps * uOut.x * uOut.y ), 0.0 );
}
`,pn=class extends p{constructor(e={}){let n=S(e.color??C.photon),r=new v({name:`fx.beam`,uniforms:{uKTime:w.uKTime,uFrom:{value:new f(...e.from??[0,0,0])},uTo:{value:new f(...e.to??[1,0,0])},uBeam:{value:new t((e.width??.05)/2,1,0,0)},uColor:{value:n},uCore:{value:H(n,.8)},uOut:{value:new t(e.intensity??2.2,1,e.speed??6,e.ripple??.35)}},vertexShader:dn,fragmentShader:fn,transparent:!0,depthWrite:!1,blending:2,premultipliedAlpha:!0,side:2});super(Pe(1,1),r),this.name=`beam`,this.frustumCulled=!1,this.raycast=()=>void 0}get from(){return this.material.uniforms.uFrom.value}get to(){return this.material.uniforms.uTo.value}get color(){return this.material.uniforms.uColor.value}get reach(){return this.material.uniforms.uBeam.value.y}set reach(e){this.material.uniforms.uBeam.value.y=e}get intensity(){return this.material.uniforms.uOut.value.x}set intensity(e){this.material.uniforms.uOut.value.x=e}get fade(){return this.material.uniforms.uOut.value.y}set fade(e){this.material.uniforms.uOut.value.y=e}};function mn(e={}){return new pn(e)}var K=new f,hn=new f,gn=1e-4;function _n(e){return(t,n)=>{n.set(0,0,0);for(let r of e){K.subVectors(t,r.position);let e=Math.max(K.lengthSq(),gn);n.addScaledVector(K,r.q/(e*Math.sqrt(e)))}return n}}function vn(e,t=.05){return n=>{let r=0;for(let i of e)r+=i.q/Math.max(n.distanceTo(i.position),t);return r}}function yn(e,t,n=1){return _n([{position:e,q:n},{position:t,q:-n}])}function bn(e,t){return(n,r)=>{K.subVectors(n,e);let i=Math.max(K.length(),.01);return K.divideScalar(i),r.copy(K).multiplyScalar(3*t.dot(K)).sub(t).divideScalar(i*i*i)}}function xn(e,t,n=1){let r=t.clone().normalize();return(t,i)=>{K.subVectors(t,e),K.addScaledVector(r,-K.dot(r));let a=Math.max(K.lengthSq(),gn);return i.crossVectors(r,K).multiplyScalar(n/a)}}function Sn(e,t,n,r=1,i=32){let a=t.clone().normalize(),o=new f(Math.abs(a.y)<.99?0:1,+(Math.abs(a.y)<.99),0).cross(a).normalize(),s=new f().crossVectors(a,o),c=[],l=[];for(let t=0;t<i;t++){let r=(t+.5)/i*Math.PI*2;c.push(e.clone().addScaledVector(o,Math.cos(r)*n).addScaledVector(s,Math.sin(r)*n));let a=2*Math.PI*n/i;l.push(o.clone().multiplyScalar(-Math.sin(r)*a).addScaledVector(s,Math.cos(r)*a))}return(e,t)=>{t.set(0,0,0);for(let n=0;n<i;n++){K.subVectors(e,c[n]);let i=Math.max(K.lengthSq(),gn);t.addScaledVector(hn.crossVectors(l[n],K),r/(i*Math.sqrt(i)))}return t}}function Cn(e,t,n,r,i=1,a=9){let o=t.clone().normalize();return Tn(...Array.from({length:a},(t,s)=>Sn(e.clone().addScaledVector(o,((s+.5)/a-.5)*r),o,n,i/a,20)))}function wn(e){return(t,n)=>n.copy(e)}function Tn(...e){let t=new f;return(n,r)=>{r.set(0,0,0);for(let i of e)i(n,t),r.add(t);return r}}var q=new f,En=new f,Dn=new f,On=new f,kn=new f;function J(e,t,n,r){e(t,r);let i=r.length();return i>0&&r.multiplyScalar(n/i),i}function An(e,t,n,r){let i=r.step??.05,a=r.maxLength??20,o=r.minField??1e-6,s=r.detectLoop??!0,c=[t.clone()],l=[J(e,t,n,q)],u=t.clone(),d=0,f=!1,p=Math.ceil(a/i);for(let a=0;a<p;a++){let a=J(e,u,n,q);if(a<o||(J(e,kn.copy(u).addScaledVector(q,i/2),n,En),J(e,kn.copy(u).addScaledVector(En,i/2),n,Dn),J(e,kn.copy(u).addScaledVector(Dn,i),n,On),u.addScaledVector(q,i/6).addScaledVector(En,i/3).addScaledVector(Dn,i/3).addScaledVector(On,i/6),d+=i,c.push(u.clone()),l.push(a),r.bounds&&u.distanceTo(r.bounds.center)>r.bounds.radius)||r.stops?.some(e=>u.distanceTo(e.position)<e.radius))break;if(s&&d>i*8&&u.distanceTo(t)<i*.75){f=!0,c.pop(),l.pop();break}}return{points:c,magnitude:l,closed:f,length:d}}function jn(e,t,n={}){let r=An(e,t,n.backward?-1:1,n);if(!n.bothWays||r.closed)return r;let i=An(e,t,n.backward?1:-1,n);return{points:[...i.points.slice(1).reverse(),...r.points],magnitude:[...i.magnitude.slice(1).reverse(),...r.magnitude],closed:!1,length:r.length+i.length}}function Mn(e,t,n={}){return t.map(t=>jn(e,t,n))}function Nn(e,t,n){let r=Math.PI*(3-Math.sqrt(5));return Array.from({length:n},(i,a)=>{let o=1-(a+.5)/n*2,s=Math.sqrt(1-o*o);return new f(Math.cos(a*r)*s,o,Math.sin(a*r)*s).multiplyScalar(t).add(e)})}function Pn(e,t,n,r,i=0){let a=t.clone().normalize(),o=new f(Math.abs(a.y)<.99?0:1,+(Math.abs(a.y)<.99),0).cross(a).normalize(),s=new f().crossVectors(a,o);return Array.from({length:r},(t,a)=>{let c=i+a/r*Math.PI*2;return e.clone().addScaledVector(o,Math.cos(c)*n).addScaledVector(s,Math.sin(c)*n)})}function Fn(e,t,n){return Array.from({length:n},(r,i)=>e.clone().lerp(t,n===1?.5:i/(n-1)))}function In(e,t,n,r){return t<=0||r<=n?1:e.magnitude.map(e=>{let i=(Math.log(Math.max(e,1e-9))-n)/(r-n);return 1-t+t*(.25+.95*Math.min(Math.max(i,0),1))})}var Ln=class extends G{lines=[];field;seeds;trace;contrast;constructor(e){let t=Mn(e.field,e.seeds,e.trace),n=t.reduce((e,t)=>e+t.points.length+1,0);super({...e,capacity:e.capacity??Math.ceil(n*1.5)+64,color:e.color??(e.kind===`B`?C.fieldB:C.fieldE),keepHue:e.keepHue??!0}),this.name=`field-lines:${e.kind??`E`}`,this.field=e.field,this.seeds=e.seeds,this.trace=e.trace??{},this.contrast=e.magnitudeContrast??.5,this.apply(t)}refresh(e,t){e&&(this.field=e),t&&(this.seeds=t),this.apply(Mn(this.field,this.seeds,this.trace))}apply(e){this.lines=e;let t=[];for(let n of e)for(let e=0;e<n.magnitude.length;e+=4)t.push(Math.log(Math.max(n.magnitude[e],1e-9)));t.sort((e,t)=>e-t);let n=t[Math.floor(t.length*.1)]??0,r=t[Math.floor(t.length*.95)]??1;this.setLines(e.map(e=>({points:e.points,closed:e.closed,brightness:In(e,this.contrast,n,r)})))}};function Rn(e){return new Ln(e)}var zn=new f(0,1,0),Bn=new ue,Y=new f,Vn=new f,Hn=new f,Un=new a,Wn=new y,Gn=class extends u{tip=new o;material;shaft;head;headLength;constructor(e={}){super(),this.name=`vector-arrow`;let t=e.radius??.035;this.headLength=e.headLength??.24;let n=e.color??`white`;this.material=T.glow({color:n,whiten:0,keepHue:!0,intensity:e.intensity??1.25,falloff:.8,edge:.75}),this.shaft=new p(new ne(t,t,1,16,1).translate(0,.5,0),this.material),this.head=new p(new oe(e.headRadius??.1,this.headLength,24).translate(0,this.headLength/2,0),this.material),this.add(this.shaft,this.head,this.tip),this.set([0,0,0],[0,1,0])}set(e,t){Array.isArray(e)?this.position.set(e[0],e[1],e[2]):this.position.copy(e),Array.isArray(t)?Y.set(t[0],t[1],t[2]):Y.copy(t);let n=Y.length();if(this.visible=n>1e-4,!this.visible)return this;this.quaternion.setFromUnitVectors(zn,Y.divideScalar(n));let r=Math.min(this.headLength,n*.6),i=r/this.headLength;return this.shaft.scale.set(1,Math.max(n-r,1e-4),1),this.head.position.y=n-r,this.head.scale.setScalar(i),this.tip.position.y=n,this}setColor(e){return this.material.setColor(e),this.material.uniforms.uCore.value.copy(this.material.color),this}};function Kn(e={}){return new Gn(e)}var qn=class extends r{points;base;o;reference;constructor(e,t){let n=[[0,-.5],[.045,-.5],[.045,.12],[.13,.12],[0,.5]].map(([e,t])=>new x(e,t)),r=T.glow({color:`white`,keepHue:!0,intensity:t.intensity??1.2,falloff:.7,edge:.8});super(new s(n,16),r,t.points.length),this.name=`arrow-field`,this.frustumCulled=!1,this.points=t.points,this.o=t,this.base=S(t.color??`amber`),this.reference=t.reference??0,this.sample(e)}sample(e){let t=[],n=this.points.map(n=>{let r=e(n,new f);return t.push(r.length()),r});if(this.reference<=0){let e=[...t].sort((e,t)=>e-t);this.reference=e[Math.floor(e.length*.9)]||1}let r=this.o.length??.5,i=this.o.magnitudeScale??.6;this.points.forEach((e,a)=>{let o=t[a],s=Math.min(o/this.reference,1),c=r*(1-i+i*Math.sqrt(s));o>1e-9&&Bn.setFromUnitVectors(zn,Y.copy(n[a]).divideScalar(o)),this.setMatrixAt(a,Un.compose(Vn.copy(e),Bn,Hn.setScalar(o>1e-9?c:1e-5))),this.setColorAt(a,Wn.copy(this.base).multiplyScalar(.45+.55*Math.sqrt(s)))}),this.instanceMatrix.needsUpdate=!0,this.instanceColor&&(this.instanceColor.needsUpdate=!0)}};function Jn(e,t){return new qn(e,t)}function Yn(e,t,n){let r=[],i=(e,t,n)=>t===1?0:(e/(t-1)-.5)*n;for(let a=0;a<n[0];a++)for(let o=0;o<n[1];o++)for(let s=0;s<n[2];s++)r.push(new f(i(a,n[0],t[0]),i(o,n[1],t[1]),i(s,n[2],t[2])).add(e));return r}var Xn=`
attribute float aPhi;
uniform vec4 uShape; // height, size, unused, unused
varying float vPhi;
varying vec3 vNormal;
varying vec2 vXZ;
void main() {
  // soft saturation: peaks near charges are rounded off instead of being clipped flat
  float h = aPhi / ( 1.0 + abs( aPhi ) * 0.55 ) * 1.55;
  vec3 p = vec3( position.x, h * uShape.x, position.z );
  vPhi = aPhi;
  vXZ = position.xz / uShape.y;
  vNormal = normalize( normalMatrix * normal );
  gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
}
`,Zn=`
precision highp float;
uniform float uKTime;
uniform vec3 uLow;
uniform vec3 uMid;
uniform vec3 uHigh;
uniform vec4 uLook; // contours per unit, opacity, fade, unused
varying float vPhi;
varying vec3 vNormal;
varying vec2 vXZ;
${N}
void main() {
  float t = saturate( vPhi * 0.5 + 0.5 );
  vec3 base = t < 0.5 ? mix( uLow, uMid, t * 2.0 ) : mix( uMid, uHigh, t * 2.0 - 1.0 );
  // two-band cel shading from a fixed view-space key (the sheet is a diagram, not a solid object)
  vec3 n = normalize( gl_FrontFacing ? vNormal : - vNormal );
  float band = smoothstep( 0.1, 0.3, dot( n, normalize( vec3( -0.35, 0.8, 0.5 ) ) ) );
  vec3 color = base * mix( 0.62, 1.0, band );
  // equipotential contours, anti-aliased in screen space; every line breathes slightly outward
  float c = vPhi * uLook.x;
  float w = fwidth( c );
  float line = 1.0 - smoothstep( 0.0, w * 1.6, abs( fract( c - 0.5 ) - 0.5 ) );
  color = mix( color, mix( base, vec3( 1.0 ), 0.75 ) * 1.25, line * 0.85 );
  // round patch with a soft rim
  float r = length( vXZ ) * 2.0;
  float mask = 1.0 - smoothstep( 0.86, 1.0, r );
  if ( mask < 0.01 ) discard;
  gl_FragColor = vec4( color, mask * uLook.y * uLook.z );
}
`,Qn=class extends p{phi;range;heightScale;n;size;constructor(e={}){let n=e.size??6,r=e.resolution??72,i=new d(n,n,r,r).rotateX(-Math.PI/2),a=new v({name:`fx.potential`,uniforms:{uKTime:w.uKTime,uShape:{value:new t(e.height??1.2,n,0,0)},uLow:{value:S(`blue`)},uMid:{value:S(`pink`)},uHigh:{value:S(`coral`)},uLook:{value:new t(e.contours??8,e.opacity??.92,1,0)}},vertexShader:Xn,fragmentShader:Zn,transparent:!0,side:2});super(i,a),this.name=`potential-surface`,this.frustumCulled=!1,this.n=r,this.size=n,this.range=e.range??2,this.heightScale=e.height??1.2,this.phi=new g(new Float32Array((r+1)*(r+1)),1),i.setAttribute(`aPhi`,this.phi)}sample(e){let t=this.n+1,n=this.geometry.getAttribute(`position`),r=this.geometry.getAttribute(`normal`),i=new f;for(let r=0;r<t*t;r++)i.set(n.getX(r),0,n.getZ(r)),this.phi.setX(r,e(i)/this.range);let a=e=>{let t=this.phi.getX(e);return t/(1+Math.abs(t)*.55)*1.55*this.heightScale},o=this.size/this.n;for(let e=0;e<t;e++)for(let n=0;n<t;n++){let s=e*t+n,c=(a(e*t+Math.min(n+1,t-1))-a(e*t+Math.max(n-1,0)))/(2*o),l=(a(Math.min(e+1,t-1)*t+n)-a(Math.max(e-1,0)*t+n))/(2*o);i.set(-c,1,-l).normalize(),r.setXYZ(s,i.x,i.y,i.z)}this.phi.needsUpdate=!0,r.needsUpdate=!0}heightAt(e){let t=e/this.range;return t/(1+Math.abs(t)*.55)*1.55*this.heightScale}get fade(){return this.material.uniforms.uLook.value.z}set fade(e){this.material.uniforms.uLook.value.z=e}get ramp(){let e=this.material.uniforms;return[e.uLow.value,e.uMid.value,e.uHigh.value]}};function $n(e={}){return new Qn(e)}function er(e,t,n){let r=t.resolution??64,i=t.u??new f(1,0,0),a=t.v??new f(0,0,1),o=t.size/r,s=(e,n)=>t.center.clone().addScaledVector(i,(e-r/2)*o).addScaledVector(a,(n-r/2)*o),c=new Float64Array((r+1)*(r+1));for(let t=0;t<=r;t++)for(let n=0;n<=r;n++)c[t*(r+1)+n]=e(s(n,t));let l=(e,t)=>c[t*(r+1)+e],u=[];for(let e of n){let t=new Map,n=new Map,i=(n,r,i,a)=>{let o=`${n},${r},${i},${a}`;if(!t.has(o)){let c=l(n,r),u=l(i,a);t.set(o,s(n,r).lerp(s(i,a),(e-c)/(u-c)))}return o},a=(e,t)=>{(n.get(e)??n.set(e,[]).get(e)).push(t),(n.get(t)??n.set(t,[]).get(t)).push(e)};for(let t=0;t<r;t++)for(let n=0;n<r;n++){let r=[l(n,t)>e,l(n+1,t)>e,l(n+1,t+1)>e,l(n,t+1)>e],o=[];r[0]!==r[1]&&o.push(i(n,t,n+1,t)),r[1]!==r[2]&&o.push(i(n+1,t,n+1,t+1)),r[3]!==r[2]&&o.push(i(n,t+1,n+1,t+1)),r[0]!==r[3]&&o.push(i(n,t,n,t+1)),o.length===2?a(o[0],o[1]):o.length===4&&((l(n,t)+l(n+1,t)+l(n+1,t+1)+l(n,t+1))/4>e===r[0]?(a(o[0],o[1]),a(o[2],o[3])):(a(o[0],o[3]),a(o[1],o[2])))}let o=new Set,c=r=>{let i=[],a=``,s=r,c=!1;for(;s!==void 0&&!o.has(s);){o.add(s),i.push(t.get(s));let e=n.get(s)??[],l=e.find(e=>e!==a&&!o.has(e));l===void 0&&e.includes(r)&&i.length>2&&(c=!0),a=s,s=l}return{level:e,points:i,closed:c}};for(let[e,t]of n)t.length===1&&!o.has(e)&&u.push(c(e));for(let e of n.keys())o.has(e)||u.push(c(e))}return u.filter(e=>e.points.length>2)}function tr(e,t={}){let n=e.reduce((e,t)=>e+t.points.length+1,0),r=new G({width:.02,intensity:1.1,dashStrength:0,color:`pink`,endFade:[.02,.02],...t,capacity:t.capacity??Math.ceil(n*1.6)+64});return r.name=`equipotentials`,r.setLines(e.map(e=>({points:e.points,closed:e.closed}))),r}var nr=`
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`,rr=`
precision highp float;
uniform float uKTime;
uniform vec3 uColor;
uniform vec4 uShape; // half width, half height, disc (1) / rect (0), symbols per unit
uniform vec4 uFlux;  // signed normalised flux −1…1, fade, unused, unused
varying vec2 vP;
${N}
void main() {
  vec2 h = uShape.xy;
  float sd = uShape.z > 0.5 ? length( vP ) - h.x : max( abs( vP.x ) - h.x, abs( vP.y ) - h.y );
  float aa = fwidth( sd );
  float inside = 1.0 - smoothstep( - aa, aa, sd );
  if ( inside < 0.01 ) discard;
  float flux = uFlux.x * ( gl_FrontFacing ? 1.0 : -1.0 );
  float amount = saturate( abs( flux ) );
  // symbol grid
  vec2 g = vP * uShape.w;
  vec2 cell = fract( g ) - 0.5;
  float r = length( cell );
  float w = fwidth( g.x ) * 1.2;
  float ring = 1.0 - smoothstep( 0.0, w, abs( r - 0.3 ) - 0.035 );
  float dotMark = 1.0 - smoothstep( 0.075, 0.075 + w, r );
  float crossMark = 1.0 - smoothstep( 0.0, w, min( abs( cell.x - cell.y ), abs( cell.x + cell.y ) ) * 0.7071 - 0.035 );
  crossMark *= 1.0 - smoothstep( 0.27, 0.27 + w, r );
  float symbol = max( ring, flux > 0.0 ? dotMark : crossMark );
  // symbols pop in from the centre outward as the flux grows; a slow pulse keeps the surface alive
  float pulse = 0.85 + 0.15 * sin( uKTime * 2.0 - length( vP ) * 2.5 );
  float border = 1.0 - smoothstep( 0.0, aa * 2.0 + 0.012, abs( sd + 0.02 ) - 0.012 );
  float fill = 0.08 + 0.3 * amount;
  float ink = symbol * smoothstep( 0.02, 0.25, amount ) * pulse;
  float alpha = saturate( fill + ink * 0.9 + border * 0.8 ) * inside * uFlux.y;
  vec3 color = uColor * ( 0.7 + 1.1 * ink * amount + 0.7 * border );
  gl_FragColor = vec4( color * alpha, alpha );
}
`,ir=new f,ar=class extends p{reference;areaValue;constructor(e={}){let n=e.size??[2,2],r=e.shape===`disc`,i=n[0],a=r?n[0]:n[1],o=new v({name:`fx.flux`,uniforms:{uKTime:w.uKTime,uColor:{value:S(e.color??C.fieldB)},uShape:{value:new t(i/2,a/2,+!!r,e.density??2.2)},uFlux:{value:new t(0,1,0,0)}},vertexShader:nr,fragmentShader:rr,transparent:!0,depthWrite:!1,premultipliedAlpha:!0,side:2});super(new d(i*1.04,a*1.04),o),this.name=`flux-surface`,this.reference=e.reference??1,this.areaValue=r?Math.PI*i*i/4:i*a}get area(){return this.areaValue}setField(e){ir.set(0,0,1).transformDirection(this.matrixWorld);let t=e.dot(ir);return this.flux=t/this.reference,t*this.areaValue}get flux(){return this.material.uniforms.uFlux.value.x}set flux(e){this.material.uniforms.uFlux.value.x=Math.max(-1,Math.min(1,e))}get fade(){return this.material.uniforms.uFlux.value.y}set fade(e){this.material.uniforms.uFlux.value.y=e}get color(){return this.material.uniforms.uColor.value}};function or(e={}){return new ar(e)}var X=new f,sr=new f,cr=new f;function lr(e,t,n,r,i){let a=[e.clone(),t.clone()];X.subVectors(t,e);let o=X.length();X.normalize(),sr.set(Math.abs(X.y)<.99?0:1,+(Math.abs(X.y)<.99),0).cross(X).normalize(),cr.crossVectors(X,sr);let s=o*r;for(let e=0;e<i;e++){let e=[a[0]];for(let t=1;t<a.length;t++){let r=a[t-1].clone().add(a[t]).multiplyScalar(.5),i=n.next()*Math.PI*2,o=n.signed(s);r.addScaledVector(sr,Math.cos(i)*o).addScaledVector(cr,Math.sin(i)*o),e.push(r,a[t])}a=e,s*=.52}return a}var ur=class extends G{from;to;power;o;baseIntensity;strikeAt=-1e9;strikeLife=.35;constructor(e={}){let t=e.detail??5,n=e.branches??2;super({capacity:((1<<t)+2)*(1+n)+8,color:e.color??`sky`,width:e.width??.04,intensity:e.intensity??2.6,dashStrength:0,endFade:[.01,.01],minPixels:2,hotCore:.9}),this.name=`arc`,this.from=new f(...e.from??[0,0,0]),this.to=new f(...e.to??[1,0,0]),this.power=e.continuous??!0?1:0,this.baseIntensity=e.intensity??2.6,this.o={jaggedness:e.jaggedness??.16,branches:n,flickerRate:e.flickerRate??16,detail:t};let r=-1;D(this,e=>{let t=Math.floor(e*this.o.flickerRate),n=(e-this.strikeAt)/this.strikeLife,i=n>=0&&n<1?(1-n)*(1-n):0,a=Math.max(this.power,i);this.intensity=this.baseIntensity*a*(.8+.4*(t*.618%1)),a<=.001||t===r||(r=t,this.rebuild(new pe(t*7919+13)))})}strike(e=.35){this.strikeAt=E(),this.strikeLife=e}rebuild(e){let t=lr(this.from,this.to,e,this.o.jaggedness,this.o.detail),n=[{points:t}],r=this.from.distanceTo(this.to);for(let i=0;i<this.o.branches;i++){let i=t[e.int(Math.floor(t.length*.15),Math.floor(t.length*.75))],a=new f(...e.onSphere()).multiplyScalar(.6).add(X.subVectors(this.to,this.from).normalize()),o=lr(i,i.clone().addScaledVector(a.normalize(),r*e.range(.15,.35)),e,this.o.jaggedness*1.3,Math.max(2,this.o.detail-2));n.push({points:o,brightness:o.map((e,t)=>.55*(1-t/o.length))})}this.setLines(n)}};function dr(e={}){return new ur(e)}var fr=`
uniform vec4 uGlow; // size, billboard, unused, unused
varying vec2 vQ;
void main() {
  vQ = position.xy * 2.0;
  float os = length( modelMatrix[ 0 ].xyz );
  vec4 mv = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
  if ( uGlow.y > 0.5 ) mv.xy += position.xy * uGlow.x * os;
  else mv = modelViewMatrix * vec4( position.xy * uGlow.x, 0.0, 1.0 );
  gl_Position = projectionMatrix * mv;
}
`,pr=`
precision highp float;
uniform float uKTime;
uniform vec3 uColor;
uniform vec4 uAnim; // intensity, fade, amount, speed
uniform float uStart; // flash: fire time
varying vec2 vQ;
${N}
${P}
void main() {
  float r = length( vQ );
  if ( r > 1.0 ) discard;
  float ang = atan( vQ.y, vQ.x );
  float t = uKTime * uAnim.w;
  float g = 0.0;
  vec3 color = uColor;
  #if defined( FX_GLOW_HALO )
    float fall = 1.0 - r;
    g = fall * fall * ( 1.0 + uAnim.z * sin( t * 2.6 ) ) + 0.6 * exp( - r * r * 30.0 );
    color = mix( uColor, vec3( 1.0 ), 0.5 * exp( - r * r * 40.0 ) );
  #elif defined( FX_GLOW_CORONA )
    // streamers: angular noise that crawls and flickers, strongest right at the conductor
    float n = fxNoise( vec2( ang * 3.2, t * 2.3 ) ) * 0.6 + fxNoise( vec2( ang * 9.0 + 4.0, t * 5.1 ) ) * 0.4;
    float reach = 0.35 + 0.65 * n;
    g = smoothstep( reach, 0.05, r ) * ( 0.55 + 0.45 * fxNoise( vec2( t * 9.0, ang * 2.0 ) ) );
    g += 0.5 * exp( - r * r * 26.0 );
    color = mix( uColor, vec3( 1.0 ), 0.6 * exp( - r * r * 20.0 ) );
  #elif defined( FX_GLOW_RINGS )
    // each ring is born at the centre, grows and fades: fract() makes the loop seamless
    float k = max( uAnim.z, 1.0 );
    float ph = fract( r * k - t * 0.5 );
    float w = fwidth( r * k ) * 1.5;
    float line = smoothstep( 0.0, w, ph ) * ( 1.0 - smoothstep( 0.1, 0.1 + w + 0.06, ph ) );
    g = line * ( 1.0 - r ) * smoothstep( 0.0, 0.12, r );
  #elif defined( FX_GLOW_FLASH )
    float age = ( uKTime - uStart ) / max( uAnim.w, 1e-3 );
    if ( age < 0.0 || age > 1.0 ) discard;
    float core = exp( - r * r * mix( 60.0, 6.0, age ) ) * ( 1.0 - age ) * ( 1.0 - age ) * 2.0;
    float ringR = mix( 0.1, 0.92, 1.0 - ( 1.0 - age ) * ( 1.0 - age ) );
    float ring = ( 1.0 - smoothstep( 0.0, 0.07, abs( r - ringR ) ) ) * ( 1.0 - age );
    float rays = 0.6 + 0.4 * sin( ang * 9.0 + uStart * 13.0 ) * sin( ang * 5.0 - uStart * 7.0 );
    g = core * rays + ring * 0.8;
    color = mix( uColor, vec3( 1.0 ), saturate( core ) );
  #endif
  g *= 1.0 - smoothstep( 0.9, 1.0, r );
  gl_FragColor = vec4( color * ( g * uAnim.x * uAnim.y ), 0.0 );
}
`,Z=class extends p{constructor(e,n={}){let r={halo:[.12,1],corona:[0,1],rings:[3,1],flash:[0,.5]}[e],i=new v({name:`fx.glow.${e}`,uniforms:{uKTime:w.uKTime,uColor:{value:S(n.color??`white`)},uGlow:{value:new t(n.size??1,n.billboard??!0?1:0,0,0)},uAnim:{value:new t(n.intensity??1.5,1,n.amount??r[0],n.speed??r[1])},uStart:{value:-1e9}},defines:{[`FX_GLOW_${e.toUpperCase()}`]:``},vertexShader:fr,fragmentShader:pr,transparent:!0,depthWrite:!1,depthTest:n.depthTest??!0,blending:2,premultipliedAlpha:!0,side:2});super(new d(1,1),i),this.name=`glow:${e}`,this.frustumCulled=!1,this.raycast=()=>void 0}fire(){this.material.uniforms.uStart.value=E()}get color(){return this.material.uniforms.uColor.value}get size(){return this.material.uniforms.uGlow.value.x}set size(e){this.material.uniforms.uGlow.value.x=e}get intensity(){return this.material.uniforms.uAnim.value.x}set intensity(e){this.material.uniforms.uAnim.value.x=e}get fade(){return this.material.uniforms.uAnim.value.y}set fade(e){this.material.uniforms.uAnim.value.y=e}},mr=(e={})=>new Z(`halo`,e),hr=(e={})=>new Z(`corona`,{color:`violet.light`,...e}),gr=(e={})=>new Z(`rings`,{color:`cyan`,...e}),_r=(e={})=>new Z(`flash`,{intensity:3,...e});function vr(e){if(e===void 0)return[`white`,`yellow`,`orange`];if(Array.isArray(e))return[e[0],e[1],e[2]];let t=S(e);return[t.clone().lerp(new y(1,1,1),.65),t,t.clone().multiplyScalar(.55)]}var yr=class extends B{constructor(e,t={}){let n=t.size??.035;super(e,{count:t.count??160,loop:!1,sprite:`spark`,color:vr(t.color),mid:.3,size:[n,n*.8,n*.3],life:[.35,.9],speed:[1.5,4.5],gravity:[0,-(t.gravity??5),0],drag:.6,stretch:.06,fadeIn:.02,fadeOut:.5,intensity:t.intensity??3,seed:`sparks`}),this.name=`sparks`}burst(e,t=24,n,r=.9){this.emit(t,{position:e,direction:n,spread:n?r:Math.PI})}};function br(e,t={}){return new yr(e,t)}function xr(e,t={}){let n=new u;n.name=`short-circuit`;let r=_r({size:t.size??2.2,color:t.color??`yellow`,intensity:3.2,speed:.45}),i=br(e);return n.add(r,i),Object.assign(n,{flash:r,sparks:i,fire(e=[0,0,0]){r.position.set(...e),r.fire(),i.burst(e,40)}}),n}function Sr(e={}){let n=e.length??3,r=e.radiusTop??.1,i=e.radiusBottom??.9,a=new ne(r,i,n,40,1,!0).translate(0,-n/2,0),o=new v({name:`fx.light-shaft`,uniforms:{uKTime:w.uKTime,uColor:{value:S(e.color??`yellow.light`)},uShaft:{value:new t(e.intensity??.5,1,n,0)}},vertexShader:`
      varying vec3 vN;
      varying vec3 vView;
      varying vec2 vP;
      void main() {
        vec4 mv = modelViewMatrix * vec4( position, 1.0 );
        vN = normalize( normalMatrix * normal );
        vView = normalize( - mv.xyz );
        vP = vec2( atan( position.z, position.x ), - position.y );
        gl_Position = projectionMatrix * mv;
      }`,fragmentShader:`
      precision highp float;
      uniform float uKTime;
      uniform vec3 uColor;
      uniform vec4 uShaft; // intensity, fade, length
      varying vec3 vN;
      varying vec3 vView;
      varying vec2 vP;
      ${N}
      ${P}
      void main() {
        // soft silhouette: the cone wall is brightest where it faces the viewer and vanishes at the rim
        float facing = abs( dot( normalize( vN ), normalize( vView ) ) );
        float along = vP.y / uShaft.z;
        float streaks = 0.75 + 0.25 * fxNoise( vec2( vP.x * 5.0, uKTime * 0.15 ) );
        float a = facing * facing * ( 1.0 - along ) * ( 1.0 - along ) * smoothstep( 0.0, 0.05, along ) * streaks;
        gl_FragColor = vec4( uColor * ( a * uShaft.x * uShaft.y ), 0.0 );
      }`,transparent:!0,depthWrite:!1,blending:2,premultipliedAlpha:!0,side:2}),s=new p(a,o);return s.name=`light-shaft`,s}function Cr(e,t,n){let r=t.radius??.15,i=(t.height??2)/n.rise;return new B(e,{count:t.count??40,emitter:De(r,{axis:t.axis??[0,1,0],spread:.18}),sprite:`puff`,blend:`normal`,life:[i*.8,i*1.2],speed:[n.rise*1.5,n.rise*2.1],drag:1.1,gravity:[0,n.rise*.9,0],wind:t.wind??[0,0,0],turbulence:{amplitude:r*.9,frequency:.7,speed:1.3},size:[r*1.6,r*n.grow,r*n.grow*1.5],sizeJitter:.35,mid:.35,fadeIn:.08,fadeOut:.55,spin:.4,reseed:r*.4,opacity:t.opacity??.9,...n,color:t.color??n.color})}function wr(e,t={}){let n=Cr(e,t,{rise:.9,grow:4.5,color:[`white`,`white`,`mist`],seed:`steam`});return n.name=`steam`,n}function Tr(e,t={}){let n=Cr(e,t,{rise:1.5,grow:4,color:[`white`,`pink.light`,`pink.light`],seed:`hot-steam`});return n.name=`hot-steam`,n}function Er(e,t={}){let n=Cr(e,t,{rise:.7,grow:5,color:[`slate`,`steel`,`mist`],opacity:t.opacity??.8,seed:`smoke`});return n.name=`smoke`,n}function Dr(e,t={}){let n=t.radius??1,r=Cr(e,{count:70,height:n*5,wind:[n*.25,0,0],...t,radius:n},{rise:n*.45,grow:2.6,color:[`white`,`white`,`mist`],spin:.15,seed:`plume`});return r.name=`plume`,r}function Or(e){return e>.6?[`white`,`pink.light`,`pink.light`]:[`white`,`white`,`mist`]}var kr=`
uniform vec4 uFlame; // height, width, power, seed
varying vec2 vQ;
void main() {
  vec3 base = ( modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
  vec3 up = ( modelViewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz; // carries the object's scale
  vec3 side = normalize( cross( up, - base ) ) * length( up );
  float grow = 0.25 + 0.75 * uFlame.z;
  vec3 P = base + up * ( uv.y * uFlame.x * grow ) + side * ( position.x * uFlame.y * 1.5 * mix( 0.6, 1.0, uFlame.z ) );
  vQ = vec2( position.x * 2.0 * 1.5, uv.y );
  gl_Position = projectionMatrix * vec4( P, 1.0 );
}
`,Ar=`
precision highp float;
uniform float uKTime;
uniform vec3 uOuter;
uniform vec3 uMid;
uniform vec3 uCore;
uniform vec4 uFlame; // height, width, power, seed
uniform vec4 uOut;   // intensity, fade, speed, unused
varying vec2 vQ;
${N}
${P}
// teardrop profile: half-width of the flame at height y (0 base … 1 tip)
float profile( float y ) {
  return pow( saturate( y ) * 1.0, 0.45 ) * pow( saturate( 1.0 - y ), 0.75 ) * 1.75;
}
void main() {
  float t = uKTime * uOut.z + uFlame.w * 17.0;
  float y = vQ.y;
  // licking: the silhouette is pushed sideways by noise that scrolls upward, more strongly near the tip
  float sway = ( fxNoise( vec2( y * 2.6 - t * 2.4, t * 0.6 + uFlame.w ) ) - 0.5 ) * 0.7 * y
             + ( fxNoise( vec2( y * 6.0 - t * 4.2, 3.7 ) ) - 0.5 ) * 0.25 * y;
  float flick = 0.86 + 0.14 * fxNoise( vec2( t * 3.1, 9.0 + uFlame.w ) );
  float x = abs( vQ.x + sway );
  float yy = y / flick;
  float d = x / max( profile( yy ), 1e-3 ) + step( 1.0, yy ) * 4.0;
  float aa = fwidth( d ) * 1.2;
  float outer = 1.0 - smoothstep( 1.0 - aa, 1.0, d );
  // inner layers are smaller flames sitting lower (each with its own tip)
  float dm = x / max( profile( yy * 1.45 ) * 0.62, 1e-3 ) + step( 1.0, yy * 1.45 ) * 4.0;
  float mid = 1.0 - smoothstep( 1.0 - aa * 1.6, 1.0, dm );
  float dc = x / max( profile( yy * 2.3 ) * 0.33, 1e-3 ) + step( 1.0, yy * 2.3 ) * 4.0;
  float core = 1.0 - smoothstep( 1.0 - aa * 2.6, 1.0, dc );
  if ( outer < 0.01 ) discard;
  vec3 color = mix( uOuter, uMid, mid );
  color = mix( color, uCore * 1.3, core );
  // the base of the flame is a little transparent and cooler, as at a burner mouth
  float alpha = outer * mix( 0.75, 1.0, smoothstep( 0.0, 0.25, y ) ) * uOut.y;
  gl_FragColor = vec4( color * ( uOut.x * ( 0.55 + 0.45 * uFlame.z ) ) * alpha, alpha );
}
`,jr=class extends p{constructor(e={}){let n=e.colors??[`orange`,`yellow`,`white`],r=new v({name:`fx.flame`,uniforms:{uKTime:w.uKTime,uOuter:{value:S(n[0])},uMid:{value:S(n[1])},uCore:{value:S(n[2])},uFlame:{value:new t(e.height??1,e.width??.5,e.power??1,e.seed??0)},uOut:{value:new t(e.intensity??1.6,1,e.speed??1,0)}},vertexShader:kr,fragmentShader:Ar,transparent:!0,depthWrite:!1,premultipliedAlpha:!0,side:2});super(new d(1,1),r),this.name=`flame`,this.frustumCulled=!1,this.raycast=()=>void 0}get power(){return this.material.uniforms.uFlame.value.z}set power(e){this.material.uniforms.uFlame.value.z=e,this.visible=e>.005}get intensity(){return this.material.uniforms.uOut.value.x}set intensity(e){this.material.uniforms.uOut.value.x=e}get fade(){return this.material.uniforms.uOut.value.y}set fade(e){this.material.uniforms.uOut.value.y=e}get colors(){let e=this.material.uniforms;return[e.uOuter.value,e.uMid.value,e.uCore.value]}};function Mr(e={}){return new jr(e)}function Nr(e={}){return new jr({colors:[`blue`,`sky`,`white`],width:.32,speed:.7,...e})}var Pr=class extends p{constructor(e={}){let n=new v({name:`fx.heat-shimmer`,uniforms:{uKTime:w.uKTime,uColor:{value:S(e.color??`orange`)},uSize:{value:new t(e.width??1,e.height??1.5,e.lines??5,e.speed??1)},uOut:{value:new t(e.intensity??.8,1,0,0)}},vertexShader:`
        uniform vec4 uSize;
        varying vec2 vQ;
        void main() {
          vec3 base = ( modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
          vec3 up = ( modelViewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz;
          vec3 side = normalize( cross( up, - base ) ) * length( up );
          vQ = vec2( position.x, uv.y );
          gl_Position = projectionMatrix * vec4( base + up * ( uv.y * uSize.y ) + side * ( position.x * uSize.x ), 1.0 );
        }`,fragmentShader:`
        precision highp float;
        uniform float uKTime;
        uniform vec3 uColor;
        uniform vec4 uSize; // width, height, lines, speed
        uniform vec4 uOut;  // intensity, fade
        varying vec2 vQ;
        ${N}
        ${P}
        void main() {
          float t = uKTime * uSize.w;
          float n = uSize.z;
          float col = ( vQ.x + 0.5 ) * n;
          float id = floor( col );
          float h = fxHash11( id + 3.0 );
          // each line is a vertical wave that rises; dashes travel up and fade toward the top
          float wave = sin( vQ.y * ( 7.0 + h * 5.0 ) - t * ( 2.0 + h * 1.5 ) + h * 20.0 ) * 0.22 * smoothstep( 0.0, 0.3, vQ.y );
          float x = fract( col ) - 0.5 - wave;
          float w = fwidth( col ) * 1.2;
          float line = 1.0 - smoothstep( 0.035, 0.035 + w, abs( x ) );
          float dash = smoothstep( 0.15, 0.4, fract( vQ.y * 1.3 - t * ( 0.35 + h * 0.25 ) + h ) ) * smoothstep( 1.0, 0.75, fract( vQ.y * 1.3 - t * ( 0.35 + h * 0.25 ) + h ) );
          float env = smoothstep( 0.0, 0.12, vQ.y ) * ( 1.0 - smoothstep( 0.45, 1.0, vQ.y ) ) * ( 1.0 - smoothstep( 0.3, 0.5, abs( vQ.x ) ) );
          gl_FragColor = vec4( uColor * ( line * dash * env * uOut.x * uOut.y ), 0.0 );
        }`,transparent:!0,depthWrite:!1,blending:2,premultipliedAlpha:!0,side:2});super(new d(1,1),n),this.name=`heat-shimmer`,this.frustumCulled=!1,this.raycast=()=>void 0}get intensity(){return this.material.uniforms.uOut.value.x}set intensity(e){this.material.uniforms.uOut.value.x=e}get fade(){return this.material.uniforms.uOut.value.y}set fade(e){this.material.uniforms.uOut.value.y=e}};function Fr(e={}){return new Pr(e)}function Ir(e,t,n=2.2){let r=Math.min(Math.max(t,0),1);fe(r,e.emissive),e.emissiveIntensity=r*r*n}var Lr=`
precision highp float;
uniform float uKTime;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uFoam;
uniform vec4 uWater; // flow phase (units), white water, opacity, fade
varying vec2 vUvw; // x = distance along (units), y = 0…1 across
varying float vWidth;
${N}
${P}
void main() {
  float across = abs( vUvw.y - 0.5 ) * 2.0; // 0 middle … 1 bank
  float u = vUvw.x - uWater.x;
  vec3 color = mix( uDeep, uShallow, smoothstep( 0.35, 1.0, across ) );
  // streaks: noise stretched along the flow, carried downstream; faster in the middle like a real stream
  float lane = vUvw.y * vWidth * 3.2;
  float s1 = fxNoise( vec2( u * 0.9 - across * 0.4, lane ) );
  float s2 = fxNoise( vec2( u * 2.1 + 5.0, lane * 2.3 + 7.0 ) );
  float streak = smoothstep( 0.62, 0.78, s1 * 0.65 + s2 * 0.35 );
  color = mix( color, mix( color, uFoam, 0.55 ), streak * ( 0.35 + 0.65 * uWater.y ) );
  // foam: a scalloped lip along both banks, and broken white water where the flow is violent
  float lip = smoothstep( 0.86, 0.93, across + ( fxNoise( vec2( u * 1.6, vUvw.y * 9.0 ) ) - 0.5 ) * 0.12 );
  float rapids = smoothstep( 1.0 - uWater.y, 1.02, s1 * 0.6 + fxNoise( vec2( u * 3.0, lane * 0.8 ) ) * 0.5 + uWater.y * 0.45 );
  color = mix( color, uFoam, saturate( lip + rapids * uWater.y ) );
  float alpha = uWater.z * uWater.w * ( 1.0 - smoothstep( 0.97, 1.0, across ) );
  gl_FragColor = vec4( min( color, vec3( 1.0 ) ) * alpha, alpha );
}
`,Rr=class extends p{speed;constructor(e,n={}){let r=n.segments??64,i=typeof n.width==`number`||n.width===void 0?[n.width??1,n.width??1]:n.width,a=(n.up??new f(0,1,0)).clone().normalize(),o=new Float32Array((r+1)*2*3),s=new Float32Array((r+1)*2*3),c=[],l=new f,u=new f,d=new f,p=e.getLength();for(let t=0;t<=r;t++){let n=t/r;e.getPointAt(n,l),e.getTangentAt(n,u),d.crossVectors(u,a),d.lengthSq()<1e-6&&d.set(1,0,0),d.normalize();let f=i[0]+(i[1]-i[0])*n;for(let e=0;e<2;e++){let r=(t*2+e)*3,i=e===0?-.5:.5;o.set([l.x+d.x*f*i,l.y+d.y*f*i,l.z+d.z*f*i],r),s.set([n*p,e,f],r)}t<r&&c.push(t*2,t*2+1,t*2+2,t*2+1,t*2+3,t*2+2)}let m=new ae;m.setAttribute(`position`,new g(o,3)),m.setAttribute(`aUvw`,new g(s,3)),m.setIndex(c);let h=new v({name:`fx.water-strip`,uniforms:{uKTime:w.uKTime,uShallow:{value:S(n.shallow??C.water)},uDeep:{value:S(n.deep??C.cold)},uFoam:{value:S(n.foam??`white`)},uWater:{value:new t(0,n.whiteWater??.25,n.opacity??1,1)}},vertexShader:`
        attribute vec3 aUvw;
        varying vec2 vUvw;
        varying float vWidth;
        void main() {
          vUvw = aUvw.xy;
          vWidth = aUvw.z;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }`,fragmentShader:Lr,transparent:!0,premultipliedAlpha:!0,side:2});super(m,h),this.name=`water-strip`,this.speed=n.speed??1.5,D(this,(e,t)=>{let n=h.uniforms.uWater.value;n.x=(n.x+this.speed*t)%4096})}get whiteWater(){return this.material.uniforms.uWater.value.y}set whiteWater(e){this.material.uniforms.uWater.value.y=e}get fade(){return this.material.uniforms.uWater.value.w}set fade(e){this.material.uniforms.uWater.value.w=e}get shallow(){return this.material.uniforms.uShallow.value}get deep(){return this.material.uniforms.uDeep.value}};function zr(e,t={}){return new Rr(e,t)}var Br=class extends B{constructor(e,t={}){let n=t.size??.07;super(e,{count:t.count??90,loop:!1,sprite:`drop`,blend:`normal`,color:[t.color??`white`,t.color??`sky.light`,t.color??`sky`],size:[n,n,n*.6],life:[.5,.9],speed:[1.4,3.2],gravity:[0,-(t.gravity??7),0],stretch:.035,fadeIn:.02,fadeOut:.3,seed:`splash`}),this.name=`splash`}burst(e,t=18,n=[0,1,0],r=.75){this.emit(t,{position:e,direction:n,spread:r})}};function Vr(e,t={}){return new Br(e,t)}function Hr(e,t={}){let n=t.radius??.5,r=t.size??n*.55,i=new B(e,{count:t.count??26,emitter:De(n,{spread:.9}),sprite:`puff`,blend:`normal`,color:[`white`,`white`,`sky.light`],size:[r*.4,r,r*.8],life:[.7,1.3],speed:[.05,.3],drag:2,turbulence:{amplitude:n*.12,speed:3},fadeIn:.15,fadeOut:.5,spin:1.2,reseed:n*.3,fog:!1,seed:`foam`});return i.name=`foam`,i}function Ur(e,t={}){let n=t.size??[1,1,1],r=t.rise??.6,i=t.radius??.07,a=new B(e,{count:t.count??40,emitter:M([n[0],0,n[2]],{center:[0,-n[1]/2,0],axis:[0,1,0]}),sprite:`bubble`,blend:`normal`,color:t.color??`white`,size:[i*.6,i*1.6,i*2],sizeJitter:.5,life:[n[1]/r*.8,n[1]/r],speed:[r*.85,r*1.15],turbulence:{amplitude:i*1.2,speed:4},fadeIn:.1,fadeOut:.04,opacity:.9,fog:!1,seed:`bubbles`});return a.name=`bubbles`,a}function Wr(e,t={}){let n=t.size??[2,2,2],r=t.speed??4,i=new B(e,{count:t.count??80,emitter:M([n[0],0,n[2]],{center:[0,n[1]/2,0],axis:[0,-1,0]}),sprite:`drop`,blend:`normal`,color:t.color??`sky`,size:t.dropSize??.05,life:n[1]/r,speed:r,stretch:.03,fadeIn:.08,fadeOut:.06,seed:`rain`});return i.name=`rain`,i}function Gr(e={}){let t=gr({size:e.size??1.5,color:e.color??`white`,amount:e.rings??2,intensity:e.intensity??.7,billboard:!1,speed:.8});return t.rotation.x=-Math.PI/2,t.name=`ripples`,t}var Kr=`
#include <common>
#include <clipping_planes_pars_vertex>
varying vec3 vWorld;
void main() {
  #include <begin_vertex>
  #include <project_vertex>
  #include <clipping_planes_vertex>
  vec4 w = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    w = instanceMatrix * w;
  #endif
  vWorld = ( modelMatrix * w ).xyz;
}
`,qr=`
#include <common>
#include <clipping_planes_pars_fragment>
uniform vec3 uCap;
uniform vec3 uCapDark;
uniform vec4 uPlane;  // world plane: xyz normal (toward the removed side), w offset
uniform float uHatch;
varying vec3 vWorld;
void main() {
  #include <clipping_planes_fragment>
  // where the view ray crosses the cutting plane
  vec3 dir = normalize( vWorld - cameraPosition );
  float denom = dot( dir, uPlane.xyz );
  float tHit = abs( denom ) > 1e-5 ? ( uPlane.w - dot( cameraPosition, uPlane.xyz ) ) / denom : 0.0;
  vec3 hit = cameraPosition + dir * tHit;
  vec3 color = uCap;
  if ( uHatch > 0.0 ) {
    // 45° hatch in the plane's own 2D frame
    vec3 n = uPlane.xyz;
    vec3 a = normalize( cross( n, abs( n.y ) < 0.9 ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 ) ) );
    vec3 b = cross( n, a );
    float s = ( dot( hit, a ) + dot( hit, b ) ) * uHatch * 0.7071;
    float w = fwidth( s );
    float line = 1.0 - smoothstep( 0.12, 0.12 + w, abs( fract( s ) - 0.5 ) );
    // far away the hatch would alias: fade it into the average tone
    color = mix( uCap, uCapDark, line * ( 1.0 - smoothstep( 0.25, 0.6, w ) ) * 0.8 );
  }
  gl_FragColor = vec4( color, 1.0 );
}
`,Jr=class{plane=new m;capMaterial;normal=new f;position=0;targets=[];caps=[];on=!0;constructor(e={}){let n=S(e.capColor??`coral.dark`);this.capMaterial=new v({name:`fx.cutaway.cap`,uniforms:{uCap:{value:n},uCapDark:{value:n.clone().lerp(new y(.03,.02,.12),.45)},uPlane:{value:new t(1,0,0,0)},uHatch:{value:e.hatch??9}},vertexShader:Kr,fragmentShader:qr,side:1,clipping:!0,clippingPlanes:[this.plane]}),this.setNormal(...e.normal??[1,0,0]),this.offset=e.offset??0}apply(e,t={}){let n=[];e.traverse(e=>{e.isMesh&&!this.caps.includes(e)&&n.push(e)});for(let e of n){let n=Array.isArray(e.material)?e.material:[e.material];for(let e of n)this.targets.some(t=>t.material===e)||(this.targets.push({material:e,planes:e.clippingPlanes}),e.clippingPlanes=[...e.clippingPlanes??[],this.plane],e.clipShadows=!0);if(t.caps===!1)continue;let i=e,a=i.isInstancedMesh?new r(e.geometry,this.capMaterial,i.count):new p(e.geometry,this.capMaterial);i.isInstancedMesh&&(a.instanceMatrix=i.instanceMatrix),a.name=`cutaway-cap`,a.frustumCulled=e.frustumCulled,e.add(a),this.caps.push(a)}return this}setNormal(e,t,n){return this.normal.set(e,t,n).normalize(),this.sync(),this}get offset(){return this.position}set offset(e){this.position=e,this.sync()}get enabled(){return this.on}set enabled(e){this.on=e,this.sync();for(let t of this.caps)t.visible=e}sync(){this.plane.normal.copy(this.normal).negate(),this.plane.constant=this.on?this.position:1e6,this.capMaterial.uniforms.uPlane.value.set(this.normal.x,this.normal.y,this.normal.z,this.position)}dispose(){for(let e of this.targets)e.material.clippingPlanes=e.planes;for(let e of this.caps)e.removeFromParent();this.capMaterial.dispose()}};function Yr(e={}){return new Jr(e)}var Xr=class{parts;value=0;constructor(e){this.parts=e.map(e=>({object:e.object,home:e.object.position.clone(),axis:new f(...e.axis).normalize(),distance:e.distance,delay:Math.min(Math.max(e.delay??0,0),.9)}))}get amount(){return this.value}set amount(e){this.value=e;for(let t of this.parts){let n=Math.min(Math.max((e-t.delay)/(1-t.delay),0),1);t.object.position.copy(t.home).addScaledVector(t.axis,t.distance*n*n*(3-2*n))}}};function Zr(e){return new Xr(e)}var Qr=class{ghostMaterial;solids=[];ghosts=[];value=0;minFade;constructor(e,t={}){this.ghostMaterial=T.glass({color:t.color??`sky`,opacity:t.opacity??.05,edgeOpacity:t.edgeOpacity??.55,specular:.3}),this.minFade=t.keep??0;let n=[];e.traverse(e=>{e.isMesh&&n.push(e)});for(let e of n){let t=Array.isArray(e.material)?e.material:[e.material];for(let e of t){let t=e;typeof t.fade==`number`&&!this.solids.includes(t)&&this.solids.push(t)}let n=new p(e.geometry,this.ghostMaterial);n.name=`xray-ghost`,n.renderOrder=4,n.visible=!1,e.add(n),this.ghosts.push(n)}}get amount(){return this.value}set amount(e){this.value=e;for(let t of this.solids)t.fade=Math.max(1-e,this.minFade);this.ghostMaterial.fade=e;for(let t of this.ghosts)t.visible=e>.01}};function $r(e,t={}){return new Qr(e,t)}var ei=class{object;amount;home;amplitude;frequency;constructor(e,t={}){this.object=e,this.home=e.position.clone(),this.amplitude=t.reducedMotion?0:t.amplitude??.01,this.frequency=t.frequency??23,this.amount=t.amount??1}update(e,t){let n=this.amplitude*this.amount,r=t*this.frequency;this.object.position.set(this.home.x+n*Math.sin(r*6.283)*.6,this.home.y+n*Math.sin(r*6.283*1.31+1.7),this.home.z+n*Math.sin(r*6.283*.83+4.1)*.6)}};function ti(e,t={}){return new ei(e,t)}var ni=`
precision highp float;
uniform float uKTime;
uniform vec3 uColor;
uniform vec4 uDisc; // inner radius (0…1), blades, blur 0…1, ghost angle
varying vec2 vQ;
${N}
void main() {
  float r = length( vQ );
  if ( r > 1.0 || r < uDisc.x ) discard;
  float ang = atan( vQ.y, vQ.x );
  // ghost blades: soft lobes, wider toward the rim, slowly creeping round
  float lobes = 0.5 + 0.5 * cos( ( ang - uDisc.w ) * uDisc.y );
  float body = 0.3 + 0.22 * lobes * lobes * smoothstep( 0.0, 0.5, r );
  float aa = fwidth( r ) * 1.5;
  float edge = smoothstep( uDisc.x, uDisc.x + aa + 0.02, r ) * ( 1.0 - smoothstep( 1.0 - aa - 0.03, 1.0, r ) );
  float alpha = body * edge * uDisc.z;
  gl_FragColor = vec4( uColor * alpha, alpha );
}
`,ri=class{target;rpm;angle=0;disc=null;axis;o;shown=0;constructor(e,n={}){if(this.target=e,this.o=n,this.axis=n.axis??`z`,this.rpm=n.rpm??0,n.radius&&n.radius>0){let r=new v({name:`fx.spin-blur`,uniforms:{uKTime:w.uKTime,uColor:{value:S(n.color??`mist`)},uDisc:{value:new t((n.innerRadius??0)/n.radius,n.blades??3,0,0)}},vertexShader:`
          varying vec2 vQ;
          void main() {
            vQ = uv * 2.0 - 1.0;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
          }`,fragmentShader:ni,transparent:!0,depthWrite:!1,premultipliedAlpha:!0,side:2}),i=new p(new te(n.radius,64),r);i.name=`spin-blur`,i.visible=!1,i.position.copy(e.position),i.quaternion.copy(e.quaternion),this.axis===`x`?i.rotateY(Math.PI/2):this.axis===`y`&&i.rotateX(-Math.PI/2),(e.parent??e).add(i),this.disc=i}}get blur(){return this.shown}get color(){return this.disc?this.disc.material.uniforms.uColor.value:null}update(e){let t=this.rpm/60*Math.PI*2,n=this.o.blurStart??90,r=this.o.blurFull??400,i=Math.min(Math.max((Math.abs(this.rpm)-n)/(r-n),0),1);this.shown=i*i*(3-2*i);let a=this.o.maxStep??.35,o=t*e,s=this.shown>0?Math.sign(o)*Math.min(Math.abs(o),a+(1-this.shown)*10):o;this.angle+=s,this.target.rotation[this.axis]=this.angle;for(let e of this.o.fade??[])e.fade=1-this.shown;if(this.disc){let t=this.disc.material.uniforms.uDisc.value;t.z=this.shown,t.w+=e*.7*Math.sign(this.rpm||1),this.disc.visible=this.shown>.01}}};function ii(e,t={}){return new ri(e,t)}var ai=class{material;hulls=[];constructor(e,n={}){let r=new v({name:`fx.outline`,uniforms:{uKTime:w.uKTime,uColor:{value:S(n.color??C.affordance)},uLine:{value:new t(n.width??3,n.intensity??1.5,n.pulse??.35,1)},uViewport:{value:new x(1920,1080)}},vertexShader:`
        uniform vec4 uLine; // width px @1080p, intensity, pulse, amount
        uniform vec2 uViewport;
        void main() {
          vec4 clip = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
          vec3 n = normalize( normalMatrix * normal );
          vec2 dir = normalize( ( projectionMatrix * vec4( n, 0.0 ) ).xy + 1e-6 );
          // constant on-screen width: offset in clip space, scaled with the viewport like HUD units
          float px = uLine.x * uViewport.y / 1080.0 * uLine.w;
          clip.xy += dir * ( 2.0 * px / uViewport ) * clip.w;
          gl_Position = clip;
        }`,fragmentShader:`
        precision highp float;
        uniform float uKTime;
        uniform vec3 uColor;
        uniform vec4 uLine;
        void main() {
          float pulse = 1.0 - uLine.z * ( 0.5 + 0.5 * sin( uKTime * 3.2 ) );
          gl_FragColor = vec4( uColor * ( uLine.y * pulse ), 1.0 );
        }`,side:1});this.material=r;let i=[];e.traverse(e=>{let t=e;t.isMesh&&t.geometry.getAttribute(`normal`)&&i.push(t)});for(let e of i){let t=new p(e.geometry,r);t.name=`outline`,t.onBeforeRender=e=>{let t=e.getRenderTarget();t?r.uniforms.uViewport.value.set(t.width,t.height):e.getDrawingBufferSize(r.uniforms.uViewport.value)},e.add(t),this.hulls.push(t)}this.amount=1}get amount(){return this.material.uniforms.uLine.value.w}set amount(e){this.material.uniforms.uLine.value.w=e;for(let t of this.hulls)t.visible=e>.01}get color(){return this.material.uniforms.uColor.value}setSelected(e){return S(e?C.selected:C.affordance,this.color),this}dispose(){for(let e of this.hulls)e.removeFromParent();this.material.dispose()}};function oi(e,t={}){return new ai(e,t)}var Q=Math.PI*2;function si(e=0){return t=>Math.sin(t+e)}function ci(e){return t=>Math.sin(t-e*Q/3)}function li(e=.5){return t=>yi(t/Q)<e?1:-1}function ui(){return e=>{let t=yi(e/Q+.25);return 1-4*Math.abs(t-.5)}}function di(){return e=>2*yi(e/Q)-1}function fi(e=!1){return t=>e?Math.max(Math.sin(t),0):Math.abs(Math.sin(t))}function pi(e,t=[]){return n=>{let r=0;for(let i=0;i<e.length;i++)r+=e[i]*Math.sin((i+1)*n+(t[i]??0));return r}}function mi(e=.8,t=15){let n=ui();return r=>e*Math.sin(r)>=n(r*t)?1:-1}function hi(e,t=2048){let n=0;for(let r=0;r<t;r++){let i=e((r+.5)/t*Q);n+=i*i}return Math.sqrt(n/t)}function gi(e,t=2048){let n=0;for(let r=0;r<t;r++)n+=e((r+.5)/t*Q);return n/t}function _i(e,t,n=4096){let r=[];for(let i=1;i<=t;i++){let t=0,a=0;for(let r=0;r<n;r++){let o=(r+.5)/n*Q,s=e(o);t+=s*Math.cos(i*o),a+=s*Math.sin(i*o)}r.push(2/n*Math.hypot(t,a))}return r}function vi(e){let t=e[0]??0;if(t<=0)return 0;let n=0;for(let t=1;t<e.length;t++)n+=e[t]*e[t];return Math.sqrt(n)/t}function yi(e){return e-Math.floor(e)}var bi=`
precision highp float;
uniform vec3 uFill;
uniform vec3 uAccent;
uniform vec4 uSize; // width, height, corner radius, polar
uniform vec4 uGrid; // divisions x, y, fade, unused
varying vec2 vP;
float roundRect( vec2 p, vec2 h, float r ) {
  vec2 q = abs( p ) - h + r;
  return length( max( q, 0.0 ) ) + min( max( q.x, q.y ), 0.0 ) - r;
}
void main() {
  vec2 h = uSize.xy * 0.5;
  float d = roundRect( vP, h, uSize.z );
  float aa = fwidth( d );
  float inside = 1.0 - smoothstep( - aa, aa, d );
  if ( inside < 0.01 ) discard;
  vec3 color = uFill * mix( 0.8, 1.15, vP.y / uSize.y + 0.5 );
  float line = 0.0;
  float axis = 0.0;
  if ( uSize.w > 0.5 ) {
    // polar grid: 4 circles, 12 spokes
    float R = min( h.x, h.y ) * 0.86;
    float r = length( vP ) / R;
    float wr = fwidth( r * 4.0 );
    line = ( 1.0 - smoothstep( 0.0, wr * 1.5, abs( fract( r * 4.0 + 0.5 ) - 0.5 ) ) ) * step( r, 1.02 );
    float a = atan( vP.y, vP.x ) / 6.2832 * 12.0;
    float wa = fwidth( a );
    line = max( line, ( 1.0 - smoothstep( 0.0, wa * 1.5, abs( fract( a + 0.5 ) - 0.5 ) ) ) * step( r, 1.0 ) * step( 0.06, r ) * 0.6 );
    axis = ( 1.0 - smoothstep( 0.0, wr * 1.5, abs( r - 1.0 ) * 4.0 ) );
  } else {
    vec2 g = ( vP / uSize.xy + 0.5 ) * uGrid.xy;
    vec2 w = fwidth( g ) * 1.5;
    vec2 l = 1.0 - smoothstep( vec2( 0.0 ), w, abs( fract( g + 0.5 ) - 0.5 ) );
    line = max( l.x, l.y );
    vec2 c = 1.0 - smoothstep( vec2( 0.0 ), w * 1.4, abs( g - uGrid.xy * 0.5 ) );
    axis = max( c.x, c.y );
  }
  color += uAccent * ( line * 0.1 + axis * 0.22 );
  float border = smoothstep( - 0.035 - aa, - 0.035 + aa, d );
  color = mix( color, uAccent * 0.9, border * 0.75 );
  gl_FragColor = vec4( color, inside * 0.94 * uGrid.z );
}
`,xi=class extends p{constructor(e){let n=new v({name:`fx.screen`,uniforms:{uFill:{value:S(`bg.deep`)},uAccent:{value:S(e.accent??`cyan`)},uSize:{value:new t(e.width,e.height,e.radius??e.height*.06,+(e.kind===`polar`))},uGrid:{value:new t(e.divisions?.[0]??10,e.divisions?.[1]??6,1,0)}},vertexShader:`
        varying vec2 vP;
        void main() {
          vP = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }`,fragmentShader:bi,transparent:!0});super(new d(e.width,e.height),n),this.name=`screen`}get fade(){return this.material.uniforms.uGrid.value.z}set fade(e){this.material.uniforms.uGrid.value.z=e}};function Si(e){return new xi(e)}var Ci=class extends u{screen;frequency;phase=0;frozen=!1;channels;w;h;cycles;constructor(e={}){super(),this.name=`scope`,this.w=e.width??4,this.h=e.height??2.4,this.cycles=e.cycles??2,this.frequency=e.frequency??.5;let t=e.samples??160;this.screen=Si({width:this.w,height:this.h,accent:e.accent}),this.add(this.screen);let n=e.channels??[C.phaseL1,C.phaseL2,C.phaseL3];this.channels=n.map((n,r)=>{let i=new G({capacity:t+2,color:n,width:e.lineWidth??.035,intensity:1.05,hotCore:0,dashStrength:0,endFade:[.01,.01],minPixels:1.8});return i.position.z=.02+r*.004,i.renderOrder=2+r,this.add(i),{line:i,points:Array.from({length:t},()=>new f),wave:null,amplitude:1,data:new Float32Array(t),dirty:!0}}),D(this,(e,t)=>{this.frozen||(this.phase=(this.phase+t*this.frequency*Math.PI*2)%(Math.PI*2*1024)),this.redraw()})}setWave(e,t,n=1){let r=this.channels[e];r&&(r.wave=t,r.amplitude=n,r.dirty=!0)}setSamples(e,t){let n=this.channels[e];if(!n)return;n.wave=null;let r=n.data.length;for(let e=0;e<r;e++)n.data[e]=t[Math.min(t.length-1,Math.round(e/(r-1)*(t.length-1)))]??0;n.dirty=!0}push(e,t){let n=this.channels[e];n&&(n.wave=null,n.data.copyWithin(0,1),n.data[n.data.length-1]=t,n.dirty=!0)}setChannelIntensity(e,t){let n=this.channels[e];n&&(n.line.intensity=t)}redraw(){let e=this.w*.5*.94,t=this.h*.5*.8;for(let n of this.channels){if(!n.wave&&!n.dirty)continue;let r=n.points.length;for(let i=0;i<r;i++){let a=i/(r-1),o=n.wave?n.wave(this.phase+a*this.cycles*Math.PI*2)*n.amplitude:n.data[i];n.points[i].set((a*2-1)*e,Math.max(-1.15,Math.min(1.15,o))*t,0)}n.line.setLines([{points:n.points}]),n.dirty=!1}}};function wi(e={}){return new Ci(e)}var Ti=new f,$=new f,Ei=class extends u{screen;frequency;angle=0;frozen=!1;items;radius;constructor(e={}){super(),this.name=`phasors`;let t=e.size??2.4;this.radius=t*.5*.86,this.frequency=e.frequency??.5;let n=e.projection??!0;this.screen=Si({width:t*(n?1.22:1),height:t,accent:e.accent,kind:`polar`}),this.screen.position.x=n?t*.11:0,this.add(this.screen);let r=e.phasors??[{color:C.phaseL1,phase:0},{color:C.phaseL2,phase:-2*Math.PI/3},{color:C.phaseL3,phase:-4*Math.PI/3}],i=new se(t*.022,16,12);this.items=r.map((e,r)=>{let a=e.color??`white`,o=Kn({color:a,radius:t*.012,headLength:t*.085,headRadius:t*.034,intensity:1.3});o.position.z=.03+r*.006,this.add(o);let s=null,c=null;return n&&(s=new p(i,T.glow({color:a,intensity:1.8,falloff:.5})),c=new G({capacity:4,color:a,width:t*.008,intensity:.8,dashRepeat:9/t,dashStrength:1,dashSpeed:0,base:0,endFade:[0,0],minPixels:1.2}),c.renderOrder=2,this.add(s,c)),{arrow:o,dot:s,guide:c,amplitude:e.amplitude??1,phase:e.phase??0}}),D(this,(e,t)=>{this.frozen||(this.angle=(this.angle+t*this.frequency*Math.PI*2)%(Math.PI*2*1024)),this.redraw()})}set(e,t,n){let r=this.items[e];r&&(r.amplitude=t,r.phase=n)}value(e){let t=this.items[e];return t?t.amplitude*Math.sin(this.angle+t.phase):0}redraw(){let e=this.radius*1.3;for(let t of this.items){let n=this.angle+t.phase,r=t.amplitude*this.radius,i=t.arrow.position.z;Ti.set(0,0,i),$.set(Math.cos(n)*r,Math.sin(n)*r,0),t.arrow.set(Ti,$),t.dot&&t.guide&&(t.dot.position.set(e,$.y,i),t.guide.setLines([{points:[new f($.x,$.y,i),new f(e,$.y,i)]}]))}}};function Di(e={}){return new Ei(e)}var Oi=class extends G{amplitude;wavelength;speed;constructor(e,t={}){let n=t.samples??160;super({capacity:n+2,color:t.color??C.current,width:t.width??.035,intensity:t.intensity??1.2,hotCore:0,dashStrength:0,endFade:[.03,.03]}),this.name=`wave-on-curve`,this.amplitude=t.amplitude??.2,this.wavelength=t.wavelength??1,this.speed=t.speed??1;let r=e.getLength(),i=t.taper??.1,a=(t.transverse??new f(0,1,0)).clone().normalize(),o=Array.from({length:n},(t,r)=>e.getPointAt(r/(n-1))),s=o.map((t,r)=>{let i=e.getTangentAt(r/(n-1));return a.clone().addScaledVector(i,-a.dot(i)).normalize()}),c=o.map(e=>e.clone()),l=0;D(this,(e,t)=>{l=(l+this.speed*t)%(this.wavelength*4096);for(let e=0;e<n;e++){let t=e/(n-1),a=Math.min(1,t/i,(1-t)/i),u=this.amplitude*a*Math.sin((t*r-l)/this.wavelength*Math.PI*2);c[e].copy(o[e]).addScaledVector(s[e],u)}this.setLines([{points:c}])})}};function ki(e,t={}){return new Oi(e,t)}var Ai=class extends G{frequency;phase=0;wave;constructor(e){super({capacity:1400,color:e.color??C.current,width:e.width??.03,intensity:1.1,hotCore:0,dashStrength:0,endFade:[.02,.02],minPixels:1.6,mitre:!0}),this.name=`pulse-train`,this.wave=e.wave,this.frequency=e.frequency??.25;let t=e.length??4,n=(e.height??.6)/2,r=e.cycles??1,i=1200;D(this,(e,a)=>{this.phase=(this.phase+a*this.frequency*Math.PI*2)%(Math.PI*2);let o=[],s=NaN;for(let e=0;e<=i&&o.length<1390;e++){let a=e/i,c=this.wave(this.phase+a*r*Math.PI*2),l=(a-.5)*t;c===s?e===i&&o.push(new f(l,c*n,0)):(Number.isNaN(s)||o.push(new f(l,s*n,0)),o.push(new f(l,c*n,0)),s=c)}this.setLines([{points:o}])})}};function ji(e){return new Ai(e)}var Mi=class extends r{target;current;constructor(e){let t=e.width??3,n=t/e.count;super(new le(n*.68,1,n*.68).translate(0,.5,0),T.glow({color:`white`,intensity:1.35,falloff:.6,edge:.8}),e.count),this.name=`spectrum-bars`,this.target=new Float32Array(e.count),this.current=new Float32Array(e.count);let r=S(e.color??`sky`),i=S(e.fundamental??`yellow`);for(let t=0;t<e.count;t++)this.setColorAt(t,t===0?i:new y().copy(r));let o=new a,s=e.height??1.5,c=e.response??8;D(this,(r,i)=>{let a=1-Math.exp(-c*Math.min(i,.1));for(let r=0;r<e.count;r++)this.current[r]+=(this.target[r]-this.current[r])*(i>0?a:1),o.makeScale(1,Math.max(this.current[r]*s,.012),1).setPosition((r+.5)*n-t/2,0,0),this.setMatrixAt(r,o);this.instanceMatrix.needsUpdate=!0})}set(e){for(let t=0;t<this.target.length;t++)this.target[t]=Math.max(0,Math.min(1,e[t]??0))}};function Ni(e){return new Mi(e)}var Pi=e({Arc:()=>ur,ArrowField:()=>qn,Beam:()=>pn,Cutaway:()=>Jr,ExplodedView:()=>Xr,FieldLines:()=>Ln,Flame:()=>jr,Flow:()=>Ht,FluxSurface:()=>ar,FxSet:()=>_e,Glow:()=>Z,Gluons:()=>St,HeatShimmer:()=>Pr,MeshFlow:()=>Zt,ORB_STYLES:()=>Ue,OrbGas:()=>pt,Orbs:()=>Qe,Outline:()=>ai,ParticleSystem:()=>B,PathSet:()=>Lt,Phasors:()=>Ei,Photons:()=>_t,PotentialSurface:()=>Qn,ProbabilityCloud:()=>ut,PulseTrain:()=>Ai,RibbonLines:()=>G,Scope:()=>Ci,Screen:()=>xi,Sparks:()=>yr,SpectrumBars:()=>Mi,Spin:()=>ri,Splash:()=>Br,Trail:()=>at,VectorArrow:()=>Gn,Vibration:()=>ei,WaterStrip:()=>Rr,WaveOnCurve:()=>Oi,XRay:()=>Qr,applyHeat:()=>Ir,bakePath:()=>jt,barMagnetField:()=>yn,boltPoints:()=>lr,boxEmitter:()=>M,capacityFor:()=>be,catenaryLength:()=>rn,catenaryParameter:()=>nn,catenaryPoints:()=>an,concatPaths:()=>It,coneDirection:()=>Ce,contourLines:()=>er,createArc:()=>dr,createArrowField:()=>Jn,createBeam:()=>mn,createBubbles:()=>Ur,createBundle:()=>un,createCorona:()=>hr,createCutaway:()=>Yr,createElectron:()=>wt,createEquipotentials:()=>tr,createExplodedView:()=>Zr,createFieldLines:()=>Rn,createFlame:()=>Mr,createFlash:()=>_r,createFlow:()=>Ut,createFluxSurface:()=>or,createFoam:()=>Hr,createGas:()=>mt,createGasFlame:()=>Nr,createGluons:()=>Ct,createHalo:()=>mr,createHeatShimmer:()=>Fr,createHole:()=>kt,createHotSteam:()=>Tr,createIon:()=>Dt,createLightShaft:()=>Sr,createMeshFlow:()=>Qt,createNeutron:()=>Et,createOrbs:()=>V,createOutline:()=>oi,createParticles:()=>He,createPhasors:()=>Di,createPhoton:()=>vt,createPhotons:()=>yt,createPlume:()=>Dr,createPotentialSurface:()=>$n,createProbabilityCloud:()=>dt,createProton:()=>Tt,createPulseRings:()=>gr,createPulseTrain:()=>ji,createQuark:()=>Ot,createRain:()=>Wr,createRipples:()=>Gr,createScope:()=>wi,createScreen:()=>Si,createShortCircuit:()=>xr,createSmoke:()=>Er,createSpan:()=>ln,createSparks:()=>br,createSpectrumBars:()=>Ni,createSpin:()=>ii,createSplash:()=>Vr,createSteam:()=>wr,createTrail:()=>ot,createVectorArrow:()=>Kn,createVibration:()=>ti,createWaterStrip:()=>zr,createWaveOnCurve:()=>ki,createWire:()=>cn,createXRay:()=>$r,currentLoopField:()=>Sn,curveEmitter:()=>ke,curveThrough:()=>sn,dipoleField:()=>bn,discEmitter:()=>De,flowNetwork:()=>en,followQuality:()=>ye,fxTime:()=>E,gridPoints:()=>Yn,harmonics:()=>pi,hotCore:()=>H,mean:()=>gi,onTick:()=>D,photonEnergyEV:()=>Se,plugin:()=>ve,pointChargesField:()=>_n,pointChargesPotential:()=>vn,pointEmitter:()=>Te,rectified:()=>fi,rms:()=>hi,samplePath:()=>Mt,sawtooth:()=>di,seedsOnLine:()=>Fn,seedsOnRing:()=>Pn,seedsOnSphere:()=>Nn,sine:()=>si,solenoidField:()=>Cn,spectrum:()=>_i,sphereEmitter:()=>Ee,splitByConductance:()=>tn,spwm:()=>mi,square:()=>li,straightWireField:()=>xn,streamline:()=>jn,streamlines:()=>Mn,superpose:()=>Tn,surfaceEmitter:()=>Oe,tangentPath:()=>Ft,thd:()=>vi,threePhase:()=>ci,triangle:()=>ui,uniformField:()=>wn,vapourColor:()=>Or,wavelengthToColor:()=>xe,wireGeometry:()=>on});export{_n as $,Dr as A,Oe as At,dr as B,Vr as C,G as Ct,Mr as D,M as Dt,Fr as E,He as Et,br as F,Jn as G,er as H,hr as I,Rn as J,Kn as K,_r as L,wr as M,Sr as N,Nr as O,ke as Ot,xr as P,yn as Q,mr as R,Gr as S,ot as St,Ir as T,V as Tt,tr as U,or as V,$n as W,Nn as X,Fn as Y,jn as Z,$r as _,Ct as _t,Di as a,cn as at,Hr as b,mt as bt,pi as c,en as ct,mi as d,wt as dt,vn as et,ci as f,kt as ft,ti as g,Ot as gt,Zr as h,Tt as ht,ki as i,ln as it,Er as j,xe as jt,Tr as k,Te as kt,si as l,Qt as lt,ii as m,Et as mt,ji as n,mn as nt,wi as o,sn as ot,oi as p,Dt as pt,Yn as q,Ni as r,un as rt,Si as s,on as st,Pi as t,Cn as tt,_i as u,Ut as ut,Yr as v,vt,zr as w,Ue as wt,Wr as x,dt as xt,Ur as y,yt,gr as z};