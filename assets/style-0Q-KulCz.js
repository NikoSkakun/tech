import{l as e}from"./palette-B2D9CW2d.js";import{Ct as t,St as n,_t as r,i,lt as a,p as o,xt as s}from"./three-C4KRfW3Y.js";import{F as c,I as l,K as u,P as d,q as f}from"./index-D43nO5ux.js";var p=`
${d}
#ifdef K_KEEP_HUE
// Pre-compensate the final pass's overflow bleed (mix toward the peak by w = 1 − exp(−0.7·(peak − 1))):
// channel c' = (target − peak·w) / (1 − w) shows as target = colour / peak after the bleed. Same maths as
// K.glow keepHue (unlit.ts); the peak is capped at 1.8, above which no compensation can keep the hue.
vec3 kKeepHue( vec3 c ) {
  float peak = max( c.r, max( c.g, c.b ) );
  if ( peak <= 1.0 ) return c;
  c *= min( peak, 1.8 ) / peak;
  peak = min( peak, 1.8 );
  float w = 1.0 - exp( -0.7 * ( peak - 1.0 ) );
  vec3 target = c / peak;
  vec3 comp = max( ( target - peak * w ) / max( 1.0 - w, 1e-3 ), -peak );
  return mix( comp, vec3( peak ), step( 0.999, target ) );
}
#endif
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec2 uGradRange;
uniform vec3 uEmissive;
#ifdef K_VERTEX_EMISSIVE
  varying vec3 vKEmissive;
  uniform float uVertexEmissive;
#endif
uniform float uEmissiveIntensity;
#ifdef K_LAYERS
  uniform float uLayerY[ K_LAYERS ];
  uniform vec3 uLayerColor[ K_LAYERS ];
  uniform vec3 uLayerOpts; // border softness, wobble amplitude, 1 / wobble scale
#endif
#ifdef K_SLOPE
  uniform vec3 uSlopeColor;
  uniform vec2 uSlope; // normal.y where it starts, where it is complete
#endif
#ifdef K_ENERGY
  varying vec2 vKUv;
  uniform vec3 uPulseColor;
  uniform vec4 uPulse; // repeat, speed, tail length, peak intensity
  uniform float uPulsePhase; // ∫ speed dt (integrated on the CPU so changing speed never makes pulses jump)
  uniform float uPower;
#endif
${c}
void main() {
  #include <clipping_planes_fragment>
  kFadeDiscard();
  #ifdef K_GRADIENT_WORLD
    float gradY = vKWorldPos.y;
  #else
    float gradY = vKObjPos.y;
  #endif
  float grad = smoothstep( uGradRange.x, uGradRange.y, gradY );
  vec4 diffuseColor = vec4( mix( uColorA, uColorB, grad ), opacity );
  #include <normal_fragment_begin>
  #ifdef K_LAYERS
    #ifdef K_LAYERS_OBJECT
      float layerY = vKObjPos.y;
    #else
      float layerY = vKWorldPos.y;
    #endif
    layerY += ( kNoise( vKWorldPos.xz * uLayerOpts.z ) + 0.5 * kNoise( vKWorldPos.zx * uLayerOpts.z * 2.7 + 5.0 ) - 0.75 ) * uLayerOpts.y;
    // border width: at least ~1 screen pixel (crisp, antialiased at any slope and zoom), or the requested softness
    float layerEdge = max( fwidth( layerY ) * 0.9, uLayerOpts.x );
    vec3 layerColor = uLayerColor[ 0 ];
    for ( int i = 1; i < K_LAYERS; i ++ ) {
      layerColor = mix( layerColor, uLayerColor[ i ], smoothstep( uLayerY[ i ] - layerEdge, uLayerY[ i ] + layerEdge, layerY ) );
    }
    diffuseColor.rgb = layerColor;
  #endif
  #ifdef K_SLOPE
    float worldNormalY = dot( normal, viewMatrix[ 1 ].xyz );
    diffuseColor.rgb = mix( diffuseColor.rgb, uSlopeColor, 1.0 - smoothstep( uSlope.y, uSlope.x, worldNormalY ) );
  #endif
  #include <color_fragment>
  vec3 color = kShade( diffuseColor.rgb, normal );
  vec3 emissive = uEmissive * uEmissiveIntensity;
  #ifdef K_VERTEX_EMISSIVE
    emissive += vKEmissive * uVertexEmissive;
  #endif
  #ifdef K_ENERGY
    // Comet-shaped pulses travelling along +U: bright head, quadratic tail, seamless loop.
    float phase = fract( vKUv.x * uPulse.x - uPulsePhase );
    float tail = smoothstep( 1.0 - uPulse.z, 1.0, phase );
    float pulse = tail * tail * smoothstep( 1.0, 0.975, phase );
    emissive += uPulseColor * ( ( pulse * uPulse.w + 0.1 ) * uPower );
  #endif
  #ifdef K_KEEP_HUE
    gl_FragColor = vec4( kKeepHue( color + emissive ), diffuseColor.a );
  #else
    gl_FragColor = vec4( color + emissive, diffuseColor.a );
  #endif
  #include <fog_fragment>
}
`,m=`kEmissive`,h=class c extends a{isKMaterial=!0;variant;flatShading=!1;phase=0;phaseTime=-1;constructor(a={},c=`toon`){super(),this.variant=c,this.name=a.name??`K.${c}`;let u=e(a.color??`mist`),d=a.gradient,h=a.emissive===void 0?new o(0,0,0):e(a.emissive),g={opacity:{value:a.opacity??1},uFade:{value:1},uColorA:{value:d?e(d.bottom):u.clone()},uColorB:{value:d?e(d.top):u.clone()},uGradRange:{value:new s(d?d.range[0]:0,d?d.range[1]:1)},uEmissive:{value:h},uEmissiveIntensity:{value:a.emissiveIntensity??(a.emissive===void 0?0:1)},uBand:{value:new t(a.terminator??.02,Math.max(a.softness??.035,.002),a.highlightThreshold??.8,a.highlight??.55)},uRim:{value:new n(a.rim??1,.62,.12)}};this.defines={},d?.space===`world`&&(this.defines.K_GRADIENT_WORLD=``),(a.bands??3)===3&&(this.defines.K_BANDS3=``,g.uMid={value:new s(a.midThreshold??.42,a.midLevel??.5)});let _=a.layers;if(_&&_.stops.length>0){let t=_.stops.slice(0,8);this.defines.K_LAYERS=t.length,_.space===`object`&&(this.defines.K_LAYERS_OBJECT=``),g.uLayerY={value:t.map(e=>e[0])},g.uLayerColor={value:t.map(t=>e(t[1]))},g.uLayerOpts={value:new n(Math.max(_.softness??0,0),_.wobble??.12,1/Math.max(_.wobbleScale??2,.001))}}a.slope&&(this.defines.K_SLOPE=``,g.uSlopeColor={value:e(a.slope.color)},g.uSlope={value:new s(a.slope.from??.8,a.slope.to??.6)}),c!==`metal`&&(a.gloss??0)>0&&(this.defines.K_GLOSS=``,g.uSpec={value:new n(90,a.gloss??0,.06)}),c===`metal`&&(this.defines.K_METAL=``,g.uSpec={value:new n(a.shininess??48,a.specular??.7,.08)}),a.keepHue&&(this.defines.K_KEEP_HUE=``),a.vertexEmissive&&(this.defines.K_VERTEX_EMISSIVE=``,g.uVertexEmissive={value:a.vertexEmissiveIntensity??1}),c===`energy`&&(this.defines.K_ENERGY=``,g.uPulseColor={value:e(a.pulseColor??`yellow`)},g.uPulse={value:new t(a.repeat??3,a.speed??.5,a.length??.45,a.intensity??3.5)},g.uPower={value:a.power??1},g.uPulsePhase={value:0}),this.uniforms=r.merge([i.lights,i.fog,g]),f(this.uniforms),this.vertexShader=l({uv:c===`energy`,...a.vertexEmissive?{pars:`attribute vec3 ${m};\nvarying vec3 vKEmissive;`,transform:`vKEmissive = ${m};`}:{}}),this.fragmentShader=p,this.lights=!0,this.fog=a.fog??!0,this.clipping=!0,this.vertexColors=a.vertexColors??!1,this.flatShading=a.flatShading??!1,this.side=a.side??0,a.clippingPlanes&&(this.clippingPlanes=a.clippingPlanes),(a.opacity??1)<1&&(this.transparent=!0,this.depthWrite=!1)}get color(){return this.uniforms.uColorA.value}setColor(t){return e(t,this.uniforms.uColorA.value),this.uniforms.uColorB.value.copy(this.uniforms.uColorA.value),this}setGradient(t,n,r){return e(t,this.uniforms.uColorA.value),e(n,this.uniforms.uColorB.value),this.uniforms.uGradRange.value.set(r[0],r[1]),this}get emissive(){return this.uniforms.uEmissive.value}setEmissive(t,n){return e(t,this.uniforms.uEmissive.value),n!==void 0&&(this.emissiveIntensity=n),this}get emissiveIntensity(){return this.uniforms.uEmissiveIntensity.value}set emissiveIntensity(e){this.uniforms.uEmissiveIntensity.value=e}get vertexEmissiveIntensity(){return this.uniforms.uVertexEmissive?.value??0}set vertexEmissiveIntensity(e){this.uniforms.uVertexEmissive&&(this.uniforms.uVertexEmissive.value=e)}get fade(){return this.uniforms.uFade.value}set fade(e){this.uniforms.uFade.value=e}get power(){return this.uniforms.uPower?.value??0}set power(e){this.uniforms.uPower&&(this.uniforms.uPower.value=e)}get speed(){return this.uniforms.uPulse?.value?.y??0}set speed(e){let t=this.uniforms.uPulse?.value;t&&(t.y=e)}onBeforeRender(){let e=this.uniforms.uPulsePhase;if(!e)return;let t=u.uKTime.value;if(t===this.phaseTime)return;let n=this.phaseTime<0?0:Math.max(t-this.phaseTime,0);this.phaseTime=t,this.phase=(this.phase+n*this.uniforms.uPulse.value.y)%4096,e.value=this.phase}clone(){let e=new c({},this.variant);return a.prototype.copy.call(e,this),e.flatShading=this.flatShading,f(e.uniforms),e}},g=`
${d}
#include <normal_pars_fragment>
uniform vec3 uColor;
uniform vec3 uCore;
uniform float uIntensity;
uniform vec2 uFalloff; // power, edge level
void main() {
  #include <clipping_planes_fragment>
  kFadeDiscard();
  #include <normal_fragment_begin>
  float ndv = saturate( dot( normal, normalize( vViewPosition ) ) );
  float core = uFalloff.x > 0.0 ? pow( ndv, uFalloff.x ) : 1.0;
  vec4 diffuseColor = vec4( mix( uColor * uFalloff.y, uCore, core ) * uIntensity, opacity );
  #include <color_fragment>
  #ifdef K_KEEP_HUE
    // Pre-compensate the overflow bleed of the final pass (FINAL_FRAGMENT: mix toward the peak by
    // w = 1 − exp(−0.7·(peak − 1))): channel c' = (target − peak·w) / (1 − w) shows as target after the bleed,
    // where target = colour / peak (the hue at full brightness). The dominant channel keeps the peak (bloom).
    // c' may be negative (exact compensation needs it; the bloom halo just gets more saturated). Above a peak
    // of 1.8 no compensation can keep the hue, so the peak is capped there.
    float kPeak = max( diffuseColor.r, max( diffuseColor.g, diffuseColor.b ) );
    if ( kPeak > 1.0 ) {
      diffuseColor.rgb *= min( kPeak, 1.8 ) / kPeak;
      kPeak = min( kPeak, 1.8 );
      float kW = 1.0 - exp( -0.7 * ( kPeak - 1.0 ) );
      vec3 kTarget = diffuseColor.rgb / kPeak;
      vec3 kComp = max( ( kTarget - kPeak * kW ) / max( 1.0 - kW, 1e-3 ), -kPeak );
      diffuseColor.rgb = mix( kComp, vec3( kPeak ), step( 0.999, kTarget ) );
    }
  #endif
  gl_FragColor = diffuseColor;
  #ifdef K_ADDITIVE
    gl_FragColor.rgb *= gl_FragColor.a * mix( 1.0, core, 0.6 );
  #endif
  #include <fog_fragment>
}
`,_=class extends a{isKMaterial=!0;whiten;constructor(t={}){super(),this.name=t.name??`K.glow`;let n=e(t.color??`cyan`);this.whiten=Math.min(Math.max(t.whiten??.55,0),1);let a=t.core===void 0?n.clone().lerp(new o(1,1,1),this.whiten):e(t.core),c=t.additive??!1,u={opacity:{value:t.opacity??1},uFade:{value:1},uColor:{value:n},uCore:{value:a},uIntensity:{value:t.intensity??2.2},uFalloff:{value:new s(t.falloff??1.6,t.edge??.55)}};this.uniforms=r.merge([i.fog,u]),f(this.uniforms),this.defines={...c?{K_ADDITIVE:``}:{},...t.keepHue?{K_KEEP_HUE:``}:{}},this.vertexShader=l(),this.fragmentShader=g,this.fog=t.fog??!c,this.clipping=!0,this.vertexColors=t.vertexColors??!1,this.side=t.side??0,t.clippingPlanes&&(this.clippingPlanes=t.clippingPlanes),c?(this.transparent=!0,this.depthWrite=!1,this.blending=2):(t.opacity??1)<1&&(this.transparent=!0,this.depthWrite=!1)}get color(){return this.uniforms.uColor.value}setColor(t){let n=e(t,this.uniforms.uColor.value);return this.uniforms.uCore.value.copy(n).lerp(new o(1,1,1),this.whiten),this}get intensity(){return this.uniforms.uIntensity.value}set intensity(e){this.uniforms.uIntensity.value=e}get fade(){return this.uniforms.uFade.value}set fade(e){this.uniforms.uFade.value=e}clone(){let e=super.clone();return f(e.uniforms),e.whiten=this.whiten,e}},v=`
${d}
#include <normal_pars_fragment>
uniform vec3 uColor;
uniform vec3 uEdgeColor;
uniform vec3 uGlass; // edge opacity, fresnel power, specular strength
void main() {
  #include <clipping_planes_fragment>
  kFadeDiscard();
  #include <normal_fragment_begin>
  float ndv = saturate( abs( dot( normal, normalize( vViewPosition ) ) ) );
  float fres = pow( 1.0 - ndv, uGlass.y );
  // No real refraction (STYLE_GUIDE §4): tinted body, brighter fresnel edge, one crisp view-space highlight.
  float streak = smoothstep( 0.93, 0.96, dot( normal, normalize( vec3( -0.45, 0.72, 0.52 ) ) ) );
  vec3 color = mix( uColor, uEdgeColor, fres ) + vec3( streak * uGlass.z );
  float alpha = mix( opacity, uGlass.x, fres );
  alpha = max( alpha, streak * uGlass.z );
  gl_FragColor = vec4( min( color, vec3( 1.0 ) ), alpha );
  #include <fog_fragment>
}
`,y=class extends a{isKMaterial=!0;constructor(t={}){super(),this.name=t.name??`K.glass`;let a=e(t.color??`sky`),s={opacity:{value:t.opacity??.16},uFade:{value:1},uColor:{value:a},uEdgeColor:{value:t.edgeColor===void 0?a.clone().lerp(new o(1,1,1),.6):e(t.edgeColor)},uGlass:{value:new n(t.edgeOpacity??.7,2.2,t.specular??.8)}};this.uniforms=r.merge([i.fog,s]),f(this.uniforms),this.vertexShader=l(),this.fragmentShader=v,this.fog=t.fog??!0,this.clipping=!0,this.transparent=!0,this.depthWrite=!1,this.blending=1,this.side=t.doubleSided??!0?2:0,t.clippingPlanes&&(this.clippingPlanes=t.clippingPlanes)}get color(){return this.uniforms.uColor.value}get fade(){return this.uniforms.uFade.value}set fade(e){this.uniforms.uFade.value=e}clone(){let e=super.clone();return f(e.uniforms),e}},b=`
${d}
varying vec2 vKUv;
uniform vec4 uPanel;   // width, height, radius, margin
uniform vec3 uFill;
uniform vec3 uAccent;
uniform vec4 uLook;    // fill opacity, border width, glow, hover highlight
uniform float uDim;    // backdrop dim
float kRoundRect( vec2 p, vec2 halfSize, float r ) {
  vec2 q = abs( p ) - halfSize + r;
  return length( max( q, 0.0 ) ) + min( max( q.x, q.y ), 0.0 ) - r;
}
void main() {
  vec2 full = uPanel.xy + 2.0 * uPanel.w;
  vec2 p = ( vKUv - 0.5 ) * full;
  float r = min( uPanel.z, 0.5 * min( uPanel.x, uPanel.y ) );
  float d = kRoundRect( p, 0.5 * uPanel.xy, r );
  float aa = max( fwidth( d ), 1e-4 );
  float inside = 1.0 - smoothstep( -aa, aa, d );
  float v = p.y / uPanel.y + 0.5; // 0 bottom … 1 top
  // fill: subtle vertical gradient, faint animated scan line and grain
  vec3 fill = uFill * mix( 0.78, 1.22, v );
  float scan = smoothstep( 0.0, 0.5, fract( v * 3.0 - uKTime * 0.06 ) ) * smoothstep( 1.0, 0.5, fract( v * 3.0 - uKTime * 0.06 ) );
  fill += uAccent * ( 0.018 * scan + 0.012 * ( kHash( gl_FragCoord.xy + fract( uKTime ) * 61.0 ) - 0.5 ) );
  fill += uAccent * uLook.w * 0.08;
  // inner border: accent at 60 % along the top-left, fading toward the bottom-right
  float bw = uLook.y;
  float border = smoothstep( -bw - aa, -bw + aa, d ) * inside;
  float sweep = saturate( 0.5 + 0.5 * dot( normalize( p / uPanel.xy + 1e-5 ), normalize( vec2( -0.6, 0.8 ) ) ) );
  float borderAlpha = mix( 0.14, 0.6, sweep ) + uLook.w * 0.3;
  vec3 color = mix( fill, uAccent * 1.25, border * borderAlpha );
  float glassAlpha = 1.0 - ( 1.0 - uLook.x ) * ( 1.0 - uDim );
  float alpha = inside * mix( glassAlpha, 1.0, border * borderAlpha );
  // soft outer glow in the accent colour
  float glow = exp( -max( d, 0.0 ) / max( uPanel.w * 0.3, 1e-3 ) ) * ( 1.0 - inside ) * uLook.z * 0.3;
  color = mix( uAccent, color, inside );
  alpha = max( alpha, glow );
  gl_FragColor = vec4( color, alpha * opacity * uFade );
}
`,x=class extends a{isKMaterial=!0;constructor(n){super(),this.name=n.name??`K.hologram`,this.uniforms={opacity:{value:n.opacity??1},uFade:{value:1},uPanel:{value:new t(n.size[0],n.size[1],n.radius??20,n.margin??24)},uFill:{value:e(n.fill??`bg.deep`)},uAccent:{value:e(n.accent??`cyan`)},uLook:{value:new t(n.fillOpacity??.9,n.border??1.5,n.glow??.5,0)}},this.uniforms.uDim={value:n.backdropDim??.8},f(this.uniforms),this.vertexShader=l({uv:!0}),this.fragmentShader=b,this.transparent=!0,this.depthWrite=!1,this.fog=!1,this.side=2}setSize(e,t){let n=this.uniforms.uPanel.value;return n.x=e,n.y=t,this}get margin(){return this.uniforms.uPanel.value.w}get accent(){return this.uniforms.uAccent.value}get backdropDim(){return this.uniforms.uDim.value}set backdropDim(e){this.uniforms.uDim.value=e}get highlight(){return this.uniforms.uLook.value.w}set highlight(e){this.uniforms.uLook.value.w=e}get fade(){return this.uniforms.uFade.value}set fade(e){this.uniforms.uFade.value=e}clone(){let e=super.clone();return f(e.uniforms),e}},S=`
uniform vec4 uWave; // scale, speed, wave height, glints
`,C=`
  {
    vec2 wp = position.xy * 1.7 / max( uWave.x, 1e-3 );
    float wt = uKTime * uWave.y;
    transformed += normal * ( sin( wp.x + wt * 1.1 ) * cos( wp.y * 0.8 - wt * 0.7 ) * uWave.z );
  }
`,w=`
${d}
varying vec2 vKUv;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uFoam;
uniform vec4 uWave; // scale, speed, wave height, glints
uniform float uFoamAmount;
${c}
void main() {
  kFadeDiscard();
  #if defined( K_WATER_DISC )
    float shore = saturate( length( vKUv - 0.5 ) * 2.0 );
  #elif defined( K_WATER_STRIP )
    float shore = saturate( abs( vKUv.y - 0.5 ) * 2.0 );
  #else
    float shore = 0.0;
  #endif
  float t = uKTime * uWave.y;
  #ifdef K_WATER_FOLLOW_LOOK
    vec2 p = vKWorldPos.xz / max( uWave.x * uKLookScale, 1e-3 );
  #else
    vec2 p = vKWorldPos.xz / max( uWave.x, 1e-3 );
  #endif
  // depth gradient: shallow at the shore, deep in the middle
  vec3 base = mix( uDeep, uShallow, smoothstep( 0.25, 1.0, shore ) );
  // soft large-scale tone variation so the surface is never a dead flat colour
  float swell = kNoise( p * 0.55 + vec2( t * 0.11, -t * 0.07 ) );
  base *= mix( 0.93, 1.06, swell );
  // glint lines: where two drifting noise fields cross — thin, organic, cel-style highlights
  float n1 = kNoise( p * 1.3 + vec2( t * 0.23, t * 0.17 ) );
  float n2 = kNoise( p * 1.9 - vec2( t * 0.19, -t * 0.21 ) + 7.3 );
  float lineW = 0.035;
  float glint = ( 1.0 - smoothstep( lineW * 0.4, lineW, abs( n1 - n2 ) ) ) * smoothstep( 0.35, 0.6, n1 ) * uWave.w;
  // foam: animated rings near the shore + a solid lip at the very edge
  float ring = fract( shore * 5.0 - t * 0.22 + ( n1 - 0.5 ) * 0.35 );
  float rings = smoothstep( 0.42, 0.5, ring ) * ( 1.0 - smoothstep( 0.62, 0.7, ring ) );
  float foam = rings * smoothstep( 0.62, 0.92, shore ) * 0.75 + smoothstep( 0.93, 0.965, shore + ( n2 - 0.5 ) * 0.04 );
  foam = saturate( foam * uFoamAmount );
  vec3 surface = mix( base, uFoam, saturate( glint * 0.55 + foam ) );
  #include <normal_fragment_begin>
  vec3 color = kShade( surface, normal );
  gl_FragColor = vec4( color, opacity );
  #include <fog_fragment>
}
`,T=class extends a{isKMaterial=!0;constructor(a={}){super(),this.name=a.name??`K.water`;let o={opacity:{value:a.opacity??1},uFade:{value:1},uShallow:{value:e(a.shallow??`sky`)},uDeep:{value:e(a.deep??`blue`)},uFoam:{value:e(a.foam??`white`)},uWave:{value:new t(a.scale??1.6,a.speed??1,a.waveHeight??.03,a.glints??.6)},uFoamAmount:{value:a.foamAmount??1},uBand:{value:new t(0,.2,2,0)},uRim:{value:new n(0,.6,.1)}};this.uniforms=r.merge([i.lights,i.fog,o]),f(this.uniforms);let s=a.shape??`disc`;this.defines=s===`disc`?{K_WATER_DISC:``}:s===`strip`?{K_WATER_STRIP:``}:{},a.followLook&&(this.defines.K_WATER_FOLLOW_LOOK=``),this.vertexShader=l({uv:!0,pars:S,transform:C}),this.fragmentShader=w,this.lights=!0,this.fog=a.fog??!0,this.side=a.side??0,(a.opacity??1)<1&&(this.transparent=!0,this.depthWrite=!1)}get shallow(){return this.uniforms.uShallow.value}get deep(){return this.uniforms.uDeep.value}get fade(){return this.uniforms.uFade.value}set fade(e){this.uniforms.uFade.value=e}clone(){let e=super.clone();return f(e.uniforms),e}},E={toon:(e={})=>new h(e,`toon`),metal:(e={})=>new h({color:`steel`,...e},`metal`),energy:(e={})=>new h({color:`ink`,...e},`energy`),glow:(e={})=>new _(e),flat:(e,t={})=>new _({...t,color:e,core:e,intensity:1,falloff:0,edge:1,name:`K.flat`}),glass:(e={})=>new y(e),water:(e={})=>new T(e),hologram:e=>new x(e)};function D(e){return typeof e.fade==`number`}export{D as n,m as r,E as t};