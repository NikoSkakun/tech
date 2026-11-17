import{At as e,F as t,I as n,M as r,P as i,Tt as a,X as o,Y as s,_t as c,at as l,c as u,d,g as f,h as p,j as m,jt as h,kt as g,o as _,st as v,u as y,w as b,xt as x,z as S}from"./three-K2PiNtFv.js";import{i as C,o as ee}from"./tween-HyA1AdHI.js";import{l as w}from"./palette-OlaaBGg3.js";var T={uKTime:{value:0},uKRimColor:{value:new f(.25,.3,.6)},uKRimDir:{value:new e(-.5,.4,-.75).normalize()},uKLookScale:{value:1}},E=`
uniform float uKTime;
uniform vec3 uKRimColor;
uniform vec3 uKRimDir;
uniform float uKLookScale;
`;function D(e){for(let t of Object.keys(T))e[t]=T[t]}var O={camera:{duration:1.8,ease:`cinematic`},cameraShort:{duration:1.2,ease:`cinematic`},cameraLong:{duration:2.4,ease:`cinematic`},appear:{duration:.5,ease:`back.out`},disappear:{duration:.25,ease:`power2.in`},state:{duration:.7,ease:`power2.inOut`},mood:{duration:2,ease:`sine.inOut`},hover:{duration:.12,ease:`power1.out`},press:{duration:.08,ease:`power1.out`},release:{duration:.4,ease:`spring`},panel:{duration:.35,ease:`power2.out`},transition:{duration:1.35,ease:`power2.inOut`}},k=.055,A={camera:.35,transition:.4,drift:0},j=class e{state;constructor(e=1){this.state=typeof e==`string`?M(e):e>>>0,this.state===0&&(this.state=2654435769)}next(){let e=this.state+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}range(e,t){return e+(t-e)*this.next()}int(e,t){return Math.floor(this.range(e,t+1))}signed(e=1){return(this.next()*2-1)*e}gauss(){return(this.next()+this.next()+this.next()+this.next()-2)*1.7320508}pick(e){return e[Math.floor(this.next()*e.length)]}onSphere(){let e=this.signed(),t=this.range(0,Math.PI*2),n=Math.sqrt(Math.max(0,1-e*e));return[n*Math.cos(t),e,n*Math.sin(t)]}fork(t){return new e((M(t)^Math.floor(this.next()*4294967296))>>>0)}};function M(e){let t=2166136261;for(let n=0;n<e.length;n++)t^=e.charCodeAt(n),t=Math.imul(t,16777619);return t>>>0}var N=(e,t,n)=>w(e).lerp(w(t),n),P={horizon:0,horizonWidth:.4,sunDir:[.45,.78,.44],sunColor:`white`,sunSize:0,sunGlow:0,stars:0,clouds:0,cloudColor:`bg.plum`,cloudColorB:`bg.violet`,silhouettes:0,silhouetteColor:`bg.indigo`,bokeh:0,motes:0,moteColor:`white`,keyColor:new f(1,.985,.95),keyIntensity:1,fillSky:new f(.47,.45,.82),fillGround:new f(.3,.24,.6),fillIntensity:1,rimColor:`violet.light`,rimIntensity:.35,rimDir:[-.55,.35,-.75],shadowStrength:1,fogColor:`bg.deep`,fogDensity:0,floor:0,floorColor:`bg.violet`,gradeTint:`white`,gradeTintAmount:0,harmonyColor:`amber`,harmony:0,accentColor:`yellow`},F={micro:{...P,kind:`space`,top:`bg.deep`,mid:N(`bg.indigo`,`bg.violet`,.45),bottom:`bg.void`,horizon:-.05,horizonWidth:.55,stars:.3,clouds:1,cloudColor:N(`bg.plum`,`magenta`,.18),cloudColorB:N(`bg.violet`,`blue`,.3),bokeh:1,motes:.8,moteColor:N(`sky`,`white`,.5),sunDir:[.5,.7,.5],fillSky:new f(.4,.38,.8),fillGround:new f(.26,.17,.56),rimColor:N(`violet.light`,`cyan`,.35),rimIntensity:.5,fogColor:`bg.deep`,fogDensity:0},studio:{...P,kind:`studio`,top:N(`bg.deep`,`bg.void`,.35),mid:N(`bg.indigo`,`bg.violet`,.3),bottom:N(`bg.deep`,`bg.void`,.5),horizon:-.1,horizonWidth:.5,bokeh:.35,motes:.35,moteColor:N(`violet.light`,`white`,.4),sunDir:[.42,.8,.43],fillSky:new f(.46,.44,.82),fillGround:new f(.3,.23,.62),rimColor:`sky`,rimIntensity:.3,floor:1,floorColor:N(`bg.violet`,`bg.plum`,.85)},day:{...P,kind:`sky`,top:N(`blue`,`bg.violet`,.12),mid:N(`sky`,`white`,.5),bottom:N(`blue`,`sky`,.3),horizon:0,horizonWidth:.3,sunDir:[.48,.74,.47],sunColor:N(`yellow`,`white`,.6),sunSize:.045,sunGlow:.55,clouds:.9,cloudColor:`white`,silhouettes:.8,silhouetteColor:N(`blue`,`violet`,.4),motes:.2,moteColor:`white`,keyColor:new f(1,.99,.96),keyIntensity:1,fillSky:new f(.5,.55,.92),fillGround:new f(.36,.3,.7),rimColor:N(`sky`,`white`,.3),rimIntensity:.3,fogColor:N(`sky`,`white`,.35),fogDensity:.006},golden:{...P,kind:`sky`,top:N(`bg.plum`,`coral`,.35),mid:N(`amber`,`coral`,.35).lerp(w(`white`),.15),bottom:N(`bg.plum`,`coral`,.28),gradeTint:new f(1,.91,.8),gradeTintAmount:.6,harmonyColor:N(`amber`,`coral`,.3),harmony:.52,accentColor:`yellow`,horizon:-.02,horizonWidth:.28,sunDir:[.74,.3,.6],sunColor:N(`amber`,`white`,.35),sunSize:.06,sunGlow:1,clouds:.85,cloudColor:N(`amber`,`white`,.45),silhouettes:.9,silhouetteColor:N(`bg.plum`,`coral`,.4),motes:.3,moteColor:`amber.light`,keyColor:new f(1,.84,.62),keyIntensity:1,fillSky:new f(.5,.42,.8),fillGround:new f(.42,.27,.6),rimColor:`pink`,rimIntensity:.4,fogColor:N(`coral`,`amber`,.4),fogDensity:.007},dusk:{...P,kind:`sky`,top:N(`bg.indigo`,`bg.deep`,.3),mid:N(`coral`,`magenta`,.3).lerp(w(`bg.plum`),.5),bottom:N(`bg.indigo`,`bg.plum`,.35),gradeTint:new f(.97,.88,1),gradeTintAmount:.5,harmonyColor:N(`magenta`,`violet`,.55),harmony:.58,accentColor:`yellow`,horizon:-.03,horizonWidth:.2,sunDir:[.8,.16,.58],sunColor:N(`coral`,`pink`,.4),sunSize:0,sunGlow:.6,stars:.6,clouds:.7,cloudColor:N(`bg.plum`,`magenta`,.5),silhouettes:.9,silhouetteColor:`bg.indigo`,motes:.3,moteColor:`yellow.light`,keyColor:new f(.9,.62,.74),keyIntensity:.6,fillSky:new f(.33,.31,.68),fillGround:new f(.25,.17,.48),rimColor:`magenta`,rimIntensity:.4,shadowStrength:.85,fogColor:N(`bg.violet`,`magenta`,.15),fogDensity:.008},night:{...P,kind:`sky`,top:`bg.void`,mid:N(`bg.indigo`,`bg.violet`,.4),bottom:N(`bg.void`,`bg.deep`,.6),harmonyColor:N(`blue`,`violet`,.4),harmony:.35,accentColor:`yellow`,horizon:-.03,horizonWidth:.3,sunDir:[-.4,.72,.56],sunColor:N(`sky`,`white`,.6),sunSize:.035,sunGlow:.35,stars:1,clouds:.5,cloudColor:`bg.violet`,silhouettes:.85,silhouetteColor:`bg.deep`,motes:.3,moteColor:`lime.light`,keyColor:new f(.6,.7,1),keyIntensity:.5,fillSky:new f(.19,.2,.5),fillGround:new f(.13,.1,.34),rimColor:`blue`,rimIntensity:.5,shadowStrength:.8,fogColor:`bg.deep`,fogDensity:.007}},I=[`top`,`mid`,`bottom`,`sunColor`,`cloudColor`,`cloudColorB`,`silhouetteColor`,`moteColor`,`keyColor`,`fillSky`,`fillGround`,`rimColor`,`fogColor`,`floorColor`,`gradeTint`,`harmonyColor`,`accentColor`],L=[`sunDir`,`rimDir`],R=[`horizon`,`horizonWidth`,`sunSize`,`sunGlow`,`stars`,`clouds`,`silhouettes`,`bokeh`,`motes`,`keyIntensity`,`fillIntensity`,`rimIntensity`,`shadowStrength`,`fogDensity`,`floor`,`gradeTintAmount`,`harmony`];function z(t,n={}){let r={...F[t],...n},i={kind:r.kind};for(let e of I)i[e]=w(r[e]);for(let t of L)i[t]=new e(...r[t]).normalize();for(let e of R)i[e]=r[e];return i}function B(e){return F[e].kind}function V(e,t,n,r){r.kind=t.kind;for(let i of I)r[i].copy(e[i]).lerp(t[i],n);for(let i of L)r[i].copy(e[i]).lerp(t[i],n).normalize();for(let i of R)r[i]=e[i]+(t[i]-e[i])*n;return r}function H(e){let t={kind:e.kind};for(let n of I)t[n]=e[n].clone();for(let n of L)t[n]=e[n].clone();for(let n of R)t[n]=e[n];return t}function U(e={}){return`
#define K_MATERIAL
varying vec3 vViewPosition;
varying vec3 vKObjPos;
varying vec3 vKWorldPos;
${e.uv?`varying vec2 vKUv;`:``}
#include <common>
#include <batching_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <shadowmap_pars_vertex>
#include <clipping_planes_pars_vertex>
${E}
${e.pars??``}
void main() {
  #include <color_vertex>
  #include <batching_vertex>
  #include <beginnormal_vertex>
  #include <begin_vertex>
  ${e.transform??``}
  #include <defaultnormal_vertex>
  #include <normal_vertex>
  vKObjPos = transformed;
  #include <project_vertex>
  #include <clipping_planes_vertex>
  vViewPosition = - mvPosition.xyz;
  vec4 kWorld = vec4( transformed, 1.0 );
  #ifdef USE_BATCHING
    kWorld = batchingMatrix * kWorld;
  #endif
  #ifdef USE_INSTANCING
    kWorld = instanceMatrix * kWorld;
  #endif
  kWorld = modelMatrix * kWorld;
  vKWorldPos = kWorld.xyz;
  ${e.uv?`vKUv = uv;`:``}
  #include <worldpos_vertex>
  #include <shadowmap_vertex>
  #include <fog_vertex>
}
`}var W=`
#define K_MATERIAL
varying vec3 vViewPosition;
varying vec3 vKObjPos;
varying vec3 vKWorldPos;
uniform float opacity;
uniform float uFade;
${E}
#include <common>
#include <color_pars_fragment>
#include <fog_pars_fragment>
#include <clipping_planes_pars_fragment>

// Interleaved gradient noise (Jimenez 2014): cheap, stable screen-space dither pattern.
float kIGN( vec2 p ) {
  return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) );
}

// Screen-door fade: lets any opaque material fade in/out without sorting or blending problems
// (MSAA + the final AA pass turn the dither into a smooth dissolve).
void kFadeDiscard() {
  if ( uFade < 0.999 ) {
    if ( uFade <= kIGN( gl_FragCoord.xy + fract( uKTime ) * 37.0 ) * 0.998 + 0.001 ) discard;
  }
}

float kLuma( vec3 c ) { return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }

// Cheap value noise for stylised surface animation (water glints, hologram grain).
float kHash( vec2 p ) {
  p = fract( p * vec2( 123.34, 456.21 ) );
  p += dot( p, p + 45.32 );
  return fract( p.x * p.y );
}
float kNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( kHash( i ), kHash( i + vec2( 1.0, 0.0 ) ), f.x ),
              mix( kHash( i + vec2( 0.0, 1.0 ) ), kHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
`,G=`
uniform vec4 uBand;
uniform vec2 uMid;
uniform vec3 uRim;
#if defined( K_METAL ) || defined( K_GLOSS )
  uniform vec3 uSpec;
#endif
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <shadowmap_pars_fragment>

struct KMaterial { vec3 diffuseColor; };

float kHighlight = 0.0;
vec3 kSpecular = vec3( 0.0 );

void RE_Direct_K( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in KMaterial material, inout ReflectedLight reflectedLight ) {
  float ndl = dot( geometryNormal, directLight.direction );
  // directLight.color already carries the (soft) shadow term of shadow-casting lights
  float band = smoothstep( uBand.x - uBand.y, uBand.x + uBand.y, ndl );
  #ifdef K_BANDS3
    // second cel edge: a half-tone band between the terminator and uMid.x, so large forms read as
    // shadow / half-tone / light instead of a smooth Lambert ramp
    band *= mix( uMid.y, 1.0, smoothstep( uMid.x - uBand.y, uMid.x + uBand.y, ndl ) );
  #endif
  reflectedLight.directDiffuse += directLight.color * band;
  kHighlight += smoothstep( uBand.z - uBand.y, uBand.z + uBand.y, ndl ) * min( kLuma( directLight.color ), 1.0 );
  #if defined( K_METAL ) || defined( K_GLOSS )
    vec3 halfDir = normalize( directLight.direction + geometryViewDir );
    float ndh = saturate( dot( geometryNormal, halfDir ) );
    float streak = smoothstep( 0.5 - uSpec.z, 0.5 + uSpec.z, pow( ndh, uSpec.x ) );
    kSpecular += directLight.color * streak * uSpec.y * band;
  #endif
}

void RE_IndirectDiffuse_K( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in KMaterial material, inout ReflectedLight reflectedLight ) {
  reflectedLight.indirectDiffuse += irradiance;
}

#define RE_Direct RE_Direct_K
#define RE_IndirectDiffuse RE_IndirectDiffuse_K

// Returns the lit (non-emissive) colour of 'base'. Requires 'normal' from <normal_fragment_begin>.
vec3 kShade( vec3 base, vec3 normal ) {
  KMaterial material;
  material.diffuseColor = base;
  ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
  #include <lights_fragment_begin>
  #include <lights_fragment_end>
  vec3 key = reflectedLight.directDiffuse;
  vec3 fill = reflectedLight.indirectDiffuse;
  vec3 light = fill + key - fill * min( key, vec3( 1.0 ) );
  vec3 color = base * light;
  // highlight band → the '*.light' variant of the base colour (+lightness, −saturation)
  vec3 lighter = mix( base, vec3( 1.0 ), 0.3 );
  color = mix( color, lighter * min( light, vec3( 1.0 ) ), saturate( kHighlight ) * uBand.w );
  #ifdef K_GLOSS
    // glossy toy plastic: one crisp highlight spot, tinted by the base colour (never pure white)
    color = mix( color, mix( base, vec3( 1.0 ), 0.72 ), saturate( kLuma( kSpecular ) ) );
  #endif
  #ifdef K_METAL
    // stylised metal: darker body with a crisp horizon band and a sharp specular streak
    float horizon = smoothstep( 0.18, 0.32, normal.y ) - smoothstep( 0.55, 0.9, normal.y );
    color *= mix( 0.78, 1.08, horizon );
    color += kSpecular;
  #endif
  // coloured rim light on silhouettes facing the rim direction
  float fres = 1.0 - saturate( dot( normal, geometryViewDir ) );
  vec3 rimDir = normalize( ( viewMatrix * vec4( uKRimDir, 0.0 ) ).xyz );
  float rim = smoothstep( uRim.y - uRim.z, uRim.y + uRim.z, fres ) * saturate( dot( normal, rimDir ) * 0.7 + 0.5 );
  color += uKRimColor * ( rim * uRim.x );
  return min( color, vec3( 1.0 ) );
}
`,K=`
float eHash( vec3 p ) {
  p = fract( p * 0.3183099 + vec3( 0.1, 0.2, 0.3 ) );
  p *= 17.0;
  return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
}
float eNoise( vec3 x ) {
  vec3 i = floor( x );
  vec3 f = fract( x );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( eHash( i ), eHash( i + vec3( 1, 0, 0 ) ), f.x ),
                   mix( eHash( i + vec3( 0, 1, 0 ) ), eHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
              mix( mix( eHash( i + vec3( 0, 0, 1 ) ), eHash( i + vec3( 1, 0, 1 ) ), f.x ),
                   mix( eHash( i + vec3( 0, 1, 1 ) ), eHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
}
float eFbm( vec3 p ) {
  float a = 0.5;
  float s = 0.0;
  for ( int i = 0; i < 4; i ++ ) {
    s += a * eNoise( p );
    p = p * 2.03 + vec3( 17.1, 3.7, 9.2 );
    a *= 0.5;
  }
  return s;
}
`,q=`
varying vec3 vDir;
void main() {
  vDir = position;
  // rotation only: the dome is infinitely far away and never clipped
  vec4 p = projectionMatrix * vec4( mat3( viewMatrix ) * position, 1.0 );
  gl_Position = p.xyww;
}
`,J=`
precision highp float;
varying vec3 vDir;
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uBottom;
uniform vec2 uHorizon;         // elevation of the horizon line, width of the mid-colour band
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec2 uSun;            // angular size (rad), glow
uniform float uStars;
uniform float uClouds;
uniform vec3 uCloudColor;
uniform vec3 uCloudColorB;
uniform float uSilhouettes;
uniform vec3 uSilhouetteColor;
uniform vec3 uViewDir;        // camera forward (world)
uniform float uKTime;
${K}
float starLayer( vec3 d, float scale, float density ) {
  vec3 p = d * scale;
  vec3 cell = floor( p );
  vec3 f = fract( p ) - 0.5;
  float h = eHash( cell );
  if ( h > density ) return 0.0;
  vec3 off = vec3( eHash( cell + 1.7 ), eHash( cell + 5.3 ), eHash( cell + 9.1 ) ) - 0.5;
  float dist = length( f - off * 0.6 );
  float tw = 0.65 + 0.35 * sin( uKTime * ( 0.6 + h * 40.0 ) + h * 100.0 );
  return smoothstep( 0.09, 0.0, dist ) * tw * ( 0.4 + 0.6 * fract( h * 91.7 ) );
}
void main() {
  vec3 d = normalize( vDir );
  float h = d.y;
  float rel = h - uHorizon.x;
  // vertical gradient bottom → top, with the 'mid' colour glowing in a band around the horizon line
  vec3 color = mix( uBottom, uTop, smoothstep( -0.8, 0.8, rel ) );
  float band = exp( -pow( rel / uHorizon.y, 2.0 ) );
  color = mix( color, uMid, band );

  #if defined( ENV_SPACE )
    // nebula: soft cloud masses drifting very slowly, brighter in their cores; a gentle glow behind the subject
    float t = uKTime * 0.006;
    float n = eFbm( d * 1.35 + vec3( t, -t * 0.6, t * 0.4 ) );
    float n2 = eFbm( d * 2.7 - vec3( t * 0.7, t, 0.0 ) + 4.0 );
    float cloud = smoothstep( 0.38, 0.74, n );
    vec3 nebula = mix( uCloudColor, uCloudColorB, smoothstep( 0.3, 0.7, n2 ) );
    color = mix( color, nebula, cloud * uClouds * 0.6 );
    color += nebula * pow( cloud, 3.0 ) * 0.3 * uClouds;
    color += uMid * pow( max( dot( d, uViewDir ), 0.0 ), 4.0 ) * 0.35;
    float st = starLayer( d, 46.0, 0.07 ) + starLayer( d, 23.0, 0.045 ) * 1.4;
    color += vec3( 0.75, 0.82, 1.0 ) * st * uStars * 0.8;
  #elif defined( ENV_STUDIO )
    // backdrop spot behind and slightly below the subject keeps the silhouette readable
    vec3 spotDir = normalize( uViewDir + vec3( 0.0, -0.18, 0.0 ) );
    color += uMid * pow( max( dot( d, spotDir ), 0.0 ), 2.5 ) * 0.5;
  #else
    // sky: sun glow + stylised disc
    float sd = max( dot( d, uSunDir ), 0.0 );
    color += uSunColor * ( pow( sd, 5.0 ) * 0.22 + pow( sd, 40.0 ) * 0.45 ) * uSun.y;
    if ( uSun.x > 0.0 ) {
      float disc = smoothstep( cos( uSun.x ) - 0.0006, cos( uSun.x ) + 0.0006, sd );
      color = mix( color, uSunColor * 1.6, disc );
    }
    // stars (upper sky, fading into the horizon glow)
    if ( uStars > 0.001 ) {
      float st = starLayer( d, 60.0, 0.06 ) + starLayer( d, 28.0, 0.04 ) * 1.5;
      color += vec3( 0.8, 0.86, 1.0 ) * st * uStars * smoothstep( -0.05, 0.4, rel ) * 1.25;
    }
    if ( uClouds > 0.001 ) {
      float t = uKTime * 0.004;
      // painted cloud bands just above the horizon: two flat cel levels
      float n = eFbm( vec3( d.x * 2.4 + t, h * 7.0, d.z * 2.4 - t ) );
      float bandUp = smoothstep( 0.62, 0.0, abs( rel - 0.16 ) * 2.2 );
      color = mix( color, mix( color, uCloudColor, 0.34 ), smoothstep( 0.5, 0.53, n ) * bandUp * uClouds );
      color = mix( color, mix( color, uCloudColor, 0.6 ), smoothstep( 0.6, 0.63, n ) * bandUp * uClouds );
      // "sea of clouds" below the horizon — dioramas are mostly seen from above, so this is their backdrop
      float m = eFbm( vec3( d.x * 1.7 - t, h * 3.4 + 2.0, d.z * 1.7 + t * 0.7 ) );
      float below = smoothstep( 0.02, -0.5, rel );
      color = mix( color, mix( color, uCloudColor, 0.2 ), smoothstep( 0.46, 0.5, m ) * below * uClouds );
      color = mix( color, mix( color, uCloudColor, 0.36 ), smoothstep( 0.57, 0.61, m ) * below * uClouds );
    }
    // distant layered silhouettes: three ridgelines, each closer one darker and more saturated
    if ( uSilhouettes > 0.001 ) {
      vec2 az = normalize( d.xz + 1e-5 );
      for ( int i = 0; i < 3; i ++ ) {
        float fi = float( i );
        float fr = 2.2 + fi * 1.7;
        float ridge = eNoise( vec3( az * fr, fi * 7.3 ) ) * 0.6 + eNoise( vec3( az * fr * 2.7, fi * 3.1 + 2.0 ) ) * 0.25;
        float line = uHorizon.x + 0.035 - fi * 0.055 + ( ridge - 0.42 ) * ( 0.16 - fi * 0.03 );
        float m = smoothstep( line + 0.003, line - 0.003, h ) * smoothstep( line - 0.5, line - 0.12, h );
        vec3 layer = mix( uMid, uSilhouetteColor, 0.3 + 0.27 * fi );
        color = mix( color, layer, m * uSilhouettes * ( 0.55 + 0.2 * fi ) );
      }
    }
  #endif
  gl_FragColor = vec4( color, 1.0 );
}
`,Y=`
attribute vec4 aSeed;   // phase, speed, size, brightness
attribute vec3 aColor;
uniform float uKTime;
uniform float uScale;
uniform float uAmount;
varying vec2 vQuad;
varying vec4 vColor;
void main() {
  vQuad = position.xy * 2.0;
  vec3 center = ( instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
  float t = uKTime * aSeed.y;
  center += vec3( sin( t + aSeed.x ), cos( t * 0.8 + aSeed.x * 1.7 ), sin( t * 0.6 + aSeed.x * 2.3 ) ) * uScale * 0.6;
  vec4 mv = modelViewMatrix * vec4( center, 1.0 );
  mv.xy += position.xy * aSeed.z * uScale;
  gl_Position = projectionMatrix * mv;
  float pulse = 0.75 + 0.25 * sin( uKTime * 0.35 + aSeed.x * 5.0 );
  vColor = vec4( aColor, aSeed.w * pulse * uAmount );
}
`,X=`
precision highp float;
varying vec2 vQuad;
varying vec4 vColor;
void main() {
  float r = length( vQuad );
  float disc = smoothstep( 1.0, 0.86, r );
  float rim = smoothstep( 0.62, 0.92, r ) * disc;
  gl_FragColor = vec4( vColor.rgb * vColor.a * disc * ( 0.6 + 0.5 * rim ), 1.0 );
}
`,Z=`
attribute vec4 aSeed;   // phase, speed, size, brightness
uniform float uKTime;
uniform float uScale;
uniform float uAmount;
uniform float uPixelScale;
uniform vec3 uCenter;
varying float vAlpha;
void main() {
  float t = uKTime * ( 0.25 + aSeed.y * 0.5 );
  vec3 box = vec3( uScale * 2.0 );
  vec3 p = position * uScale;
  p += vec3( sin( t + aSeed.x * 6.28 ), t * 0.35 + cos( t * 0.7 + aSeed.x * 3.0 ) * 0.4, cos( t * 0.9 + aSeed.x * 4.0 ) ) * uScale * 0.12;
  // wrap into the box around the centre so motes never run out
  p = mod( p - uCenter + box * 0.5, box ) - box * 0.5 + uCenter;
  vec4 mv = modelViewMatrix * vec4( p, 1.0 );
  gl_Position = projectionMatrix * mv;
  float twinkle = 0.55 + 0.45 * sin( uKTime * ( 0.8 + aSeed.y * 2.0 ) + aSeed.x * 40.0 );
  // fade near the box faces (no popping at the wrap) and very close to the camera
  vec3 e = abs( p - uCenter ) / ( box * 0.5 );
  float edge = 1.0 - smoothstep( 0.75, 1.0, max( e.x, max( e.y, e.z ) ) );
  vAlpha = aSeed.w * twinkle * edge * uAmount * smoothstep( 0.2, 1.2, -mv.z / uScale * 4.0 );
  gl_PointSize = max( aSeed.z * 0.4 * uPixelScale * uScale / max( -mv.z, 1e-3 ), 1.0 );
}
`,Q=`
precision highp float;
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float r = length( gl_PointCoord - 0.5 ) * 2.0;
  float a = smoothstep( 1.0, 0.0, r );
  gl_FragColor = vec4( uColor * a * a * vAlpha, 1.0 );
}
`,te=U({uv:!0}),ne=`
${W}
varying vec2 vKUv;
uniform vec3 uFloorColor;
uniform float uFloor;
uniform vec3 uContact; // footprint radius / floor radius, strength, _
${G}
void main() {
  float r = length( vKUv - 0.5 ) * 2.0;
  #include <normal_fragment_begin>
  vec3 color = kShade( uFloorColor, normal );
  // brighter pool of light in the middle, soft falloff to nothing at the rim
  color *= mix( 1.25, 0.82, smoothstep( 0.0, 0.75, r ) );
  // grounding: a soft, tinted contact shadow hugging the subject's footprint (independent of the shadow map,
  // so low, wide objects such as turntables or machine bases still sit firmly on the floor)
  float contact = ( 1.0 - smoothstep( uContact.x * 0.8, uContact.x * 1.45, r ) ) * uContact.y;
  color *= mix( vec3( 1.0 ), vec3( 0.42, 0.36, 0.7 ), contact );
  float alpha = ( 1.0 - smoothstep( 0.45, 1.0, r ) ) * uFloor;
  if ( alpha < 0.004 ) discard;
  gl_FragColor = vec4( color, alpha );
  #include <fog_fragment>
}
`,re={studio:3.4,micro:6,diorama:11},$=2.8,ie=[`violet`,`blue`,`magenta`,`cyan`,`pink`],ae=class{scene;group=new r;key;fill;kind;params;mood={tint:new f(1,1,1),tintAmount:0,harmonyColor:new f(1,.6,.3),harmony:0,accentColor:new f(1,.85,.3)};rig={rimColor:new f,rimDir:new e,lookScale:1};dome;bokeh=null;motes=null;floor=null;fog;from;to;blend=1;blendDuration=0;blendEase=C(O.mood.ease);presetName;baseOverrides={};scale;look=1;accent;shadow;shadowMapSize=2048;grounding={radius:0,strength:0};viewDir=new e(0,0,-1);constructor(n,r,a){this.scene=n,this.presetName=r.preset,this.accent=r.accent,this.kind=B(r.preset),this.scale=r.scale??6,this.params=this.resolve(r.preset),this.from=H(this.params),this.to=H(this.params),this.shadow={extent:this.scale*1.6,center:[0,0,0],softness:3.5},this.group.name=`environment`,this.dome=new o(new t(1,4),new c({vertexShader:q,fragmentShader:J,defines:this.kind===`space`?{ENV_SPACE:``}:this.kind===`studio`?{ENV_STUDIO:``}:{},uniforms:{uTop:{value:new f},uMid:{value:new f},uBottom:{value:new f},uHorizon:{value:new g},uSunDir:{value:new e},uSunColor:{value:new f},uSun:{value:new h},uStars:{value:0},uClouds:{value:0},uCloudColor:{value:new f},uCloudColorB:{value:new f},uSilhouettes:{value:0},uSilhouetteColor:{value:new f},uViewDir:{value:this.viewDir},uKTime:T.uKTime},side:1,depthWrite:!1,fog:!1})),this.dome.name=`env-dome`,this.dome.frustumCulled=!1,this.dome.renderOrder=1e3,this.dome.matrixAutoUpdate=!1,this.group.add(this.dome),this.key=new b(16777215,1),this.key.name=`env-key`,this.key.castShadow=!0,this.group.add(this.key,this.key.target),this.fill=new i(16777215,16777215,1),this.fill.name=`env-fill`,this.key.layers.enable(1),this.fill.layers.enable(1),this.group.add(this.fill),this.fog=new m(0,0),n.fog=this.fog,this.buildParticles(a),this.kind===`studio`&&this.buildFloor(),n.add(this.group),this.setQuality(a),this.apply()}get preset(){return this.presetName}set(e,t={}){if(B(e)!==this.kind)throw Error(`Environment: cannot blend from a '${this.kind}' backdrop to preset '${e}' (${B(e)}). The backdrop kind is fixed per chapter (manifest.theme.sky).`);this.presetName=e,this.blendTo(this.resolve(e,t.overrides),t)}tune(e,t={}){this.blendTo(this.resolve(this.presetName,e),t)}base(e,t={}){this.baseOverrides={...e},this.blendTo(this.resolve(this.presetName),{duration:0,...t})}get baseTune(){return this.baseOverrides}setShadow(e){this.shadow={extent:e.extent,center:e.center??[0,0,0],softness:e.softness??3.5},this.applyShadow()}setGrounding(e,t=.55){this.grounding={radius:e,strength:t},this.applyGrounding()}get lookScale(){return this.look}get subjectScale(){return this.scale}fitShadow(e,t=1.1,n=3){let r=ee(e,new u);if(r.isEmpty())return;let i=r.getBoundingSphere(new x);this.setShadow({extent:Math.max(i.radius*t,.001),center:[i.center.x,i.center.y,i.center.z],softness:n})}setScale(e,t={}){this.scale=e,this.look=t.adaptFrom!==void 0&&t.adaptFrom>0?e/t.adaptFrom:1,this.rig.lookScale=this.look,this.fog.density=this.params.fogDensity/this.look,this.bokeh&&(this.bokeh.material.uniforms.uScale.value=e),this.motes&&(this.motes.material.uniforms.uScale.value=e),this.floor&&this.floor.scale.setScalar(e*$),this.applyGrounding()}setQuality(e){this.shadowMapSize=e.shadowMapSize,this.key.castShadow=e.shadowMapSize>0,e.shadowMapSize>0&&this.key.shadow.mapSize.x!==e.shadowMapSize&&(this.key.shadow.mapSize.set(e.shadowMapSize,e.shadowMapSize),this.key.shadow.map?.dispose(),this.key.shadow.map=null),this.applyShadow()}update(e,t,n,r){if(this.blend<1&&(this.blend=this.blendDuration<=0?1:Math.min(1,this.blend+e/this.blendDuration),V(this.from,this.to,this.blendEase(this.blend),this.params),this.apply()),t.getWorldDirection(this.viewDir),this.motes){let e=this.motes.material.uniforms;e.uCenter.value.copy(n),e.uPixelScale.value=.5*r*t.projectionMatrix.elements[5]}}dispose(){this.scene.remove(this.group),this.scene.fog===this.fog&&(this.scene.fog=null),this.dome.geometry.dispose(),this.dome.material.dispose(),this.bokeh?.geometry.dispose(),this.bokeh?.material.dispose(),this.bokeh?.dispose(),this.motes?.geometry.dispose(),this.motes?.material.dispose(),this.floor?.geometry.dispose(),this.floor?.material.dispose(),this.key.dispose(),this.fill.dispose()}resolve(e,t={}){let n={...this.baseOverrides,...t},r=z(e,n);return n.rimColor===void 0&&r.rimColor.lerp(w(this.accent),.25),r}blendTo(e,t){let n=t.duration??O.mood.duration;this.to=e,n<=0?(V(e,e,1,this.params),this.blend=1,this.apply()):(this.from=H(this.params),this.blend=0,this.blendDuration=n,this.blendEase=C(t.ease??O.mood.ease))}apply(){let e=this.params,t=this.dome.material.uniforms;t.uTop.value.copy(e.top),t.uMid.value.copy(e.mid),t.uBottom.value.copy(e.bottom),t.uHorizon.value.set(e.horizon,Math.max(e.horizonWidth,.02)),t.uSunDir.value.copy(e.sunDir),t.uSunColor.value.copy(e.sunColor),t.uSun.value.set(e.sunSize,e.sunGlow,0,0),t.uStars.value=e.stars,t.uClouds.value=e.clouds,t.uCloudColor.value.copy(e.cloudColor),t.uCloudColorB.value.copy(e.cloudColorB),t.uSilhouettes.value=e.silhouettes,t.uSilhouetteColor.value.copy(e.silhouetteColor),this.key.color.copy(e.keyColor),this.key.intensity=e.keyIntensity,this.key.shadow.intensity=e.shadowStrength,this.fill.color.copy(e.fillSky),this.fill.groundColor.copy(e.fillGround),this.fill.intensity=e.fillIntensity,this.rig.rimColor.copy(e.rimColor).multiplyScalar(e.rimIntensity),this.rig.rimDir.copy(e.rimDir),this.mood.tint.copy(e.gradeTint),this.mood.tintAmount=e.gradeTintAmount,this.mood.harmonyColor.copy(e.harmonyColor).convertLinearToSRGB(),this.mood.harmony=e.harmony,this.mood.accentColor.copy(e.accentColor).convertLinearToSRGB(),this.fog.color.copy(e.fogColor),this.fog.density=e.fogDensity/this.look,this.bokeh&&(this.bokeh.material.uniforms.uAmount.value=e.bokeh,this.bokeh.visible=e.bokeh>.002),this.motes&&(this.motes.material.uniforms.uAmount.value=e.motes,this.motes.material.uniforms.uColor.value.copy(e.moteColor),this.motes.visible=e.motes>.002),this.floor&&(this.floor.material.uniforms.uFloor.value=e.floor,this.floor.material.uniforms.uFloorColor.value.copy(e.floorColor),this.floor.visible=e.floor>.002),this.applyShadow()}applyGrounding(){this.floor&&this.floor.material.uniforms.uContact.value.set(this.grounding.radius/(this.scale*$),this.grounding.strength,0)}applyShadow(){let{extent:t,center:n,softness:r}=this.shadow,i=new e(n[0],n[1],n[2]);this.key.target.position.copy(i),this.key.position.copy(i).addScaledVector(this.params.sunDir,t*3),this.key.target.updateMatrixWorld();let a=this.key.shadow.camera;a.left=-t,a.right=t,a.top=t,a.bottom=-t,a.near=.1,a.far=t*6,a.updateProjectionMatrix();let o=2*t/Math.max(this.shadowMapSize,1);this.key.shadow.radius=r,this.key.shadow.bias=-o*.5/(t*6),this.key.shadow.normalBias=o*1.1}buildParticles(t){let r=new j(`env:${this.presetName}`);if(this.kind!==`sky`){let e=Math.max(8,Math.round(46*t.particles)),i=new c({vertexShader:Y,fragmentShader:X,uniforms:{uKTime:T.uKTime,uScale:{value:this.scale},uAmount:{value:1}},transparent:!0,depthWrite:!1,blending:2,fog:!1}),a=new S(new l(1,1),i,e),o=new Float32Array(e*4),u=new Float32Array(e*3),d=new s,f=[this.accent,...ie];for(let t=0;t<e;t++){let[e,n,i]=r.onSphere(),s=r.range(4.5,11);d.makeTranslation(e*s,n*s*.6,i*s),a.setMatrixAt(t,d),o.set([r.range(0,6.28),r.range(.03,.12),r.range(.35,1.5),r.range(.03,.12)],t*4);let c=w(r.pick(f));u.set([c.r,c.g,c.b],t*3)}a.scale.setScalar(this.scale),a.geometry.setAttribute(`aSeed`,new n(o,4)),a.geometry.setAttribute(`aColor`,new n(u,3)),a.frustumCulled=!1,a.name=`env-bokeh`,a.renderOrder=1001,this.bokeh=a,this.group.add(a)}let i=Math.max(24,Math.round(260*t.particles)),a=new Float32Array(i*3),o=new Float32Array(i*4);for(let e=0;e<i;e++)a.set([r.signed(),r.signed(),r.signed()],e*3),o.set([r.next(),r.next(),r.range(.012,.05),r.range(.25,1)],e*4);let u=new d;u.setAttribute(`position`,new y(a,3)),u.setAttribute(`aSeed`,new y(o,4));let p=new v(u,new c({vertexShader:Z,fragmentShader:Q,uniforms:{uKTime:T.uKTime,uScale:{value:this.scale},uAmount:{value:1},uPixelScale:{value:500},uCenter:{value:new e},uColor:{value:new f}},transparent:!0,depthWrite:!1,blending:2,fog:!1}));p.frustumCulled=!1,p.name=`env-motes`,p.renderOrder=1002,this.motes=p,this.group.add(p)}buildFloor(){let t=a.merge([_.lights,_.fog,{opacity:{value:1},uFade:{value:1},uFloorColor:{value:new f},uFloor:{value:1},uContact:{value:new e(0,0,0)},uBand:{value:new h(0,.2,2,0)},uRim:{value:new e(0,.6,.1)}}]);D(t);let n=new c({vertexShader:te,fragmentShader:ne,uniforms:t,lights:!0,fog:!0,transparent:!0,depthWrite:!0}),r=new o(new p(1,96),n);r.rotation.x=-Math.PI/2,r.scale.setScalar(this.scale*$),r.receiveShadow=!0,r.name=`env-floor`,r.renderOrder=-10,this.floor=r,this.group.add(r)}};export{U as a,A as c,D as d,G as i,k as l,re as n,j as o,W as r,O as s,ae as t,T as u};