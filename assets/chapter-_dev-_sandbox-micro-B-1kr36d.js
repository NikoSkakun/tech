import{$ as e,C as t,F as n,H as r,O as i,Q as a,U as o,X as s,c,dt as l,ft as u,l as d,p as f,st as p,vt as m,yt as h}from"./three-B5K2OhcN.js";import{a as g,r as _}from"./palette-BzgpeUEC.js";import{a as ee}from"./tween-BErJcqpS.js";import{L as v,O as te,V as y}from"./index-BNZvEo9O.js";import{t as b}from"./style-DHPNiE6X.js";import"./text-BncqcyCY.js";import{labels as ne}from"./content-DNYFgpv7.js";function re(e,t,n,r,i){let o=new Float32Array(t*3),s=new Float32Array(t*3);for(let r=0;r<t;r++){let t=e.next()<.42?.42:.82,i=Math.max(.12,t+e.gauss()*.11)*n,[a,c,l]=e.onSphere();o.set([a*i,c*i*.92,l*i],r*3),s.set([e.next(),e.range(.6,1.6),e.next()],r*3)}let l=new d;l.setAttribute(`position`,new c(o,3)),l.setAttribute(`aSeed`,new c(s,3));let u=new p({uniforms:{uKTime:y.uKTime,uAmount:{value:1},uPixelScale:{value:600},uRadius:{value:n},uInner:{value:g(r)},uOuter:{value:g(i)}},vertexShader:`
      attribute vec3 aSeed;
      uniform float uKTime;
      uniform float uAmount;
      uniform float uPixelScale;
      uniform float uRadius;
      uniform vec3 uInner;
      uniform vec3 uOuter;
      varying vec4 vColor;
      void main() {
        // differential rotation around Y: inner dots orbit faster, like a swirling cloud
        float r = length( position );
        float a = uKTime * 0.22 * aSeed.y * ( 0.6 + 0.9 * ( 1.0 - r / uRadius ) ) + aSeed.x * 6.2831;
        float c = cos( a ), s = sin( a );
        vec3 p = vec3( position.x * c - position.z * s, position.y + sin( uKTime * 0.5 + aSeed.z * 20.0 ) * 0.05, position.x * s + position.z * c );
        vec4 mv = modelViewMatrix * vec4( p, 1.0 );
        gl_Position = projectionMatrix * mv;
        float twinkle = 0.55 + 0.45 * sin( uKTime * ( 1.0 + aSeed.y ) + aSeed.z * 50.0 );
        float size = mix( 0.045, 0.11, aSeed.z ) * ( 0.7 + 0.5 * twinkle );
        gl_PointSize = max( size * uPixelScale / max( -mv.z, 1e-3 ), 1.0 ) * step( 0.001, uAmount );
        vColor = vec4( mix( uInner, uOuter, smoothstep( 0.3, 0.95, r / uRadius ) ), twinkle * uAmount );
      }`,fragmentShader:`
      precision highp float;
      varying vec4 vColor;
      void main() {
        float d = length( gl_PointCoord - 0.5 ) * 2.0;
        float a = smoothstep( 1.0, 0.1, d );
        gl_FragColor = vec4( vColor.rgb * a * a * vColor.a * 0.9, 1.0 );
      }`,transparent:!0,depthWrite:!1,blending:2}),f=new a(l,u);return f.frustumCulled=!1,f.name=`electron-cloud`,{points:f,get amount(){return u.uniforms.uAmount.value},set amount(e){u.uniforms.uAmount.value=e,f.visible=e>.002},get pixelScale(){return u.uniforms.uPixelScale.value},set pixelScale(e){u.uniforms.uPixelScale.value=e}}}function ie(e,t,n,r=.4){let i=new p({uniforms:{uColor:{value:g(n)},uHead:{value:0},uLength:{value:r},uStrength:{value:1}},vertexShader:`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }`,fragmentShader:`
      precision highp float;
      uniform vec3 uColor;
      uniform float uHead;
      uniform float uLength;
      uniform float uStrength;
      varying vec2 vUv;
      void main() {
        // distance behind the head along the ring, 0…1
        float behind = fract( uHead - vUv.x );
        float tail = smoothstep( uLength, 0.0, behind );
        float faint = 0.07;
        gl_FragColor = vec4( uColor * ( tail * tail * 2.6 + faint ) * uStrength, 1.0 );
      }`,transparent:!0,depthWrite:!1,blending:2,side:2}),a=new o(new u(e,t,8,220),i);return a.name=`orbit-trail`,{mesh:a,get head(){return i.uniforms.uHead.value*Math.PI*2},set head(e){i.uniforms.uHead.value=(e/(Math.PI*2)%1+1)%1},get strength(){return i.uniforms.uStrength.value},set strength(e){i.uniforms.uStrength.value=e}}}function ae(e=`yellow`){let t=g(e),n=new p({uniforms:{uKTime:y.uKTime,uColor:{value:t},uCore:{value:t.clone().lerp(new f(1,1,1),.7)},uLife:{value:1}},vertexShader:`
      uniform float uKTime;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        float envelope = sin( uv.x * 3.14159265 );
        p.y += sin( uv.x * 24.0 - uKTime * 16.0 ) * 0.17 * envelope;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
      }`,fragmentShader:`
      precision highp float;
      uniform vec3 uColor;
      uniform vec3 uCore;
      uniform float uLife;
      varying vec2 vUv;
      void main() {
        float across = 1.0 - abs( vUv.y - 0.5 ) * 2.0;
        float envelope = sin( vUv.x * 3.14159265 );
        float fade = smoothstep( 1.0, 0.75, uLife ) * smoothstep( 0.0, 0.08, uLife );
        float a = smoothstep( 0.0, 0.9, across ) * envelope * fade;
        gl_FragColor = vec4( mix( uColor, uCore, across * across ) * a * 3.2, 1.0 );
      }`,transparent:!0,depthWrite:!1,blending:2,side:2}),r=new o(new s(2,.09,96,1),n);return r.name=`photon`,r.visible=!1,{mesh:r,get life(){return n.uniforms.uLife.value},set life(e){n.uniforms.uLife.value=e,r.visible=e>.001&&e<.999}}}var x=class extends o{constructor(e,t,n,r){let i=new d;i.setAttribute(`position`,new c(new Float32Array(12),3)),i.setAttribute(`aEnd`,new c(new Float32Array([0,0,1,1]),1)),i.setAttribute(`aSide`,new c(new Float32Array([-1,1,-1,1]),1)),i.setIndex([0,1,2,2,1,3]),super(i,new p({uniforms:{uFrom:{value:e.clone()},uTo:{value:t.clone()},uColor:{value:n},uWidth:{value:r},uViewport:{value:new m(1280,720)},uFade:{value:1}},vertexShader:`
          attribute float aEnd;
          attribute float aSide;
          uniform vec3 uFrom;
          uniform vec3 uTo;
          uniform float uWidth;
          uniform vec2 uViewport;
          varying float vSide;
          void main() {
            vec4 a = projectionMatrix * modelViewMatrix * vec4( uFrom, 1.0 );
            vec4 b = projectionMatrix * modelViewMatrix * vec4( uTo, 1.0 );
            vec2 dir = normalize( ( b.xy / b.w - a.xy / a.w ) * uViewport );
            vec2 normal = vec2( -dir.y, dir.x );
            vec4 p = mix( a, b, aEnd );
            // half-width + 1 px on each side so the fragment shader can antialias the edges
            float halfPx = uWidth * 0.5 + 1.0;
            p.xy += normal * aSide * halfPx * 2.0 / uViewport * p.w;
            vSide = aSide * halfPx; // signed distance from the centre line in px
            gl_Position = p;
          }`,fragmentShader:`
          precision highp float;
          uniform vec3 uColor;
          uniform float uFade;
          uniform float uWidth;
          varying float vSide;
          void main() {
            float a = clamp( uWidth * 0.5 + 0.5 - abs( vSide ), 0.0, 1.0 );
            gl_FragColor = vec4( uColor, a * 0.9 * uFade );
          }`,transparent:!0,depthTest:!1,depthWrite:!1,side:2})),this.frustumCulled=!1}get fade(){return this.material.uniforms.uFade.value}set fade(e){this.material.uniforms.uFade.value=e}onBeforeRender(e){e.getSize(this.material.uniforms.uViewport.value)}};function S(e,t){let n=new i;n.name=`label:${e}`;let r=t.color??`white`,a=new h(...t.offset),o=t.size??20,s=new v(`●`,{font:`body`,size:15,color:r,anchorX:`center`,anchorY:`middle`,billboard:!0,screenSpace:!0,depthTest:!1,depthWrite:!1,rich:!1}),c=new x(new h,a.clone().multiplyScalar(.94),g(r),1.8),l=new v(e,{font:`bodyBold`,size:o,color:r,anchorX:t.anchor===`center`?`center`:a.x>=0?`left`:`right`,anchorY:`middle`,billboard:!0,screenSpace:!0,depthTest:!1,depthWrite:!1,halo:{radius:.12,color:`bg.void`,opacity:.85}});return l.position.copy(a).multiplyScalar(t.anchor===`center`?1.22:1.03),c.renderOrder=1,s.renderOrder=2,l.renderOrder=3,n.add(c,s,l),ee(n)}var C=.5,oe=[{radius:3,tilt:new t(1.2,.25,0),speed:.9,phase:.6},{radius:3.75,tilt:new t(.55,.95,.3),speed:-.68,phase:2.3},{radius:4.5,tilt:new t(-.62,-.5,.85),speed:.52,phase:4.2}],w=.35,se=.42,T=te(t=>{let{root:a,stage:s,camera:c,random:d}=t;t.env.setScale(6),t.env.setShadow({extent:3.2,softness:4});let f=new i;f.name=`nucleus`,a.add(f);let p=[];for(let e=0;e<14;e++)p.push(new h(...d.onSphere()).multiplyScalar(d.range(.2,1.2)));let m=new h;for(let e=0;e<160;e++)for(let e=0;e<14;e++){p[e].multiplyScalar(.985);for(let t=e+1;t<14;t++){m.subVectors(p[e],p[t]);let n=m.length()||.001,r=C*1.86-n;r>0&&(m.multiplyScalar(r*.5/n),p[e].add(m),p[t].sub(m))}}let g=new l(C,48,32),ee=b.toon({color:_.proton,highlight:.6,rim:1.3,gloss:.7}),te=b.toon({gradient:{bottom:_.neutronShade,top:_.neutron,range:[-.45,.4]},highlight:.5,rim:1.1,gloss:.7}),y=new n(g,ee,7),x=new n(g,te,7);for(let e of[y,x])e.castShadow=!0,e.receiveShadow=!0,e.frustumCulled=!1,f.add(e);let T=new o(new l(.62,24,16),b.glow({color:`amber`,intensity:1.5,additive:!0,opacity:.5,falloff:1.2}));f.add(T);let ce=p.filter((e,t)=>t%2==0).map(()=>{let e=new v(`+`,{font:`display`,size:.5,color:`white`,opacity:.9,anchorX:`center`,anchorY:`middle`,billboard:!0,depthWrite:!1,rich:!1});return a.add(e),e}),E=re(d.fork(`cloud`),t.quality.count(1500,300),5.2,`cyan`,`violet`);a.add(E.points);let le=new l(.17,32,20),ue=new l(.36,24,16),D=oe.map((e,t)=>{let n=new i;n.rotation.copy(e.tilt),n.name=`orbit-${t}`;let r=new o(new u(e.radius,.011,6,200),b.glow({color:`violet.light`,intensity:.55,additive:!0,opacity:.6,falloff:0})),s=ie(e.radius,.034,_.electron,.34),c=new o(le,b.glow({color:_.electron,intensity:1.9,falloff:2,edge:.52})),l=new o(ue,b.glow({color:_.electron,intensity:.6,additive:!0,opacity:.4,falloff:2.4,edge:0}));return c.add(l),n.add(r,s.mesh,c),a.add(n),{orbit:e,group:n,ring:r,trail:s,body:c,angle:e.phase}}),O=D[0],de=O.body.material,k=ae(_.photon);a.add(k.mesh);let A=ne,j=S(A.nucleus,{offset:[1.5,1.7,.3],color:`white`});j.position.set(.5,.95,.5);let M=S(A.cloud,{offset:[-.9,1,0],color:`violet.light`});M.position.set(-2.9,2.5,1);let fe=S(A.electron,{offset:[.42,.34,0],color:`cyan`});O.body.add(fe);let N=S(A.drag,{offset:[0,.62,0],color:`cyan`,size:18,anchor:`center`});a.add(N);let pe=(e,t)=>[...e].sort((e,n)=>n.z+n.x*t-(e.z+e.x*t))[0],P=pe(p.filter((e,t)=>t%2==0),.8),F=pe(p.filter((e,t)=>t%2==1),-.8),I=S(A.proton,{offset:[.75,.6,.2],color:`coral`});I.position.copy(P).multiplyScalar(1+C/P.length());let L=S(A.neutron,{offset:[-1,.7,.2],color:`mist`});L.position.copy(F).multiplyScalar(1+C/F.length()),a.add(j,M,I,L);let me=S(A.photon,{offset:[.1,.55,0],color:`yellow`,size:18});k.mesh.add(me);let R=new h(Math.cos(w)*O.orbit.radius,Math.sin(w)*O.orbit.radius,0).applyEuler(O.orbit.tilt);c.shots({atom:{position:[.5,4.4,16.5],target:[0,0,0],fov:32},nucleus:{position:[1.9,1.5,5.4],target:[0,.05,0],fov:30,orbit:{azimuth:1.2,polar:.6}},electron:{position:R.clone().add(new h(.9,.7,3.4)),target:R,focus:O.body,fov:30,orbit:{azimuth:.5,polar:.3,zoom:[.8,1.6]}},excited:{position:[-3.5,4,15.8],target:[.2,0,0],fov:32}});let z={appear:`fade`,inDuration:.4},he=s.actor(j,z),ge=s.actor(M,z),_e=s.actor(fe,z),ve=s.actor(N,z),ye=s.actor(I,z),be=s.actor(L,z),B=D.map(e=>s.actor(e.group));s.param(`cloud`,1,{onChange:e=>E.amount=e});let V=s.param(`spin`,1),xe=s.param(`hold`,0,{duration:1.4,ease:`power2.inOut`}),Se=s.param(`excite`,0,{duration:.9,ease:`back.out`});s.param(`core`,1.5,{onChange:e=>T.material.intensity=e}),s.define({atom:{show:[...B,he,ge],camera:`atom`},nucleus:{show:[ye,be],params:{cloud:.12,spin:.4,core:2.4},camera:`nucleus`,post:{aoIntensity:.7}},electron:{show:[B[0],_e],params:{cloud:.3,spin:.25,hold:1},camera:`electron`,post:{bloomIntensity:1}},excited:{show:[...B,ve],params:{cloud:.55,spin:.7,excite:1},camera:`excited`,post:{bloomIntensity:1.25}}});let H={level:0,dragging:!1,angle:0,glow:0},Ce=new h(0,0,1).applyEuler(O.orbit.tilt),we=new h,U=new h,Te=new e().setFromEuler(O.orbit.tilt).invert(),Ee=new h,De=e=>{if(!e.planePoint(Ce,Ee,we))return;U.copy(we).applyQuaternion(Te),H.angle=Math.atan2(U.y,U.x);let t=Math.hypot(U.x,U.y)/O.orbit.radius;H.level=Math.min(Math.max((t-1)/se,-.15),1.25)},W=2.2,Oe=()=>{G.copy(O.body.getWorldPosition(new h)),K.copy(G).normalize(),q=1e-4};t.input.register(O.body,{tooltip:ne.electron,cursor:`grab`,hover:e=>t.tweens.to(H,{glow:+!!e},{duration:.12}),dragStart:e=>{H.dragging=!0,De(e)},drag:De,dragEnd:()=>{H.dragging=!1,H.level>.25&&Oe(),O.angle=H.angle,t.tweens.to(H,{level:0},{duration:.5,ease:`power2.in`}),W=3.4}});let G=new h,K=new h(1,0,0),q=1,J=new r,Y=new h,ke=new e,X=new h,Z=new h,Q=new h,$=new h;return{enterStep(){W=2.2},update(e,n){f.rotation.y=n*.16,f.rotation.x=Math.sin(n*.11)*.2;for(let e=0;e<14;e++){let t=p[e],r=1+Math.sin(n*1.7+e*2.1)*.035;Y.copy(t).multiplyScalar(r),X.setScalar(1+Math.sin(n*2.3+e*1.3)*.025),J.compose(Y,ke.identity(),X),(e%2==0?y:x).setMatrixAt(e>>1,J)}I.position.copy(P).multiplyScalar(1+C/P.length()),f.localToWorld(I.position),L.position.copy(F).multiplyScalar(1+C/F.length()),f.localToWorld(L.position),y.instanceMatrix.needsUpdate=!0,f.updateMatrixWorld(),ce.forEach((e,t)=>{let r=1+Math.sin(n*1.7+t*2*2.1)*.035;Y.copy(p[t*2]).multiplyScalar(r),f.localToWorld(Y),X.copy(c.camera.position).sub(Y).normalize(),e.position.copy(Y).addScaledVector(X,C*1.03)}),x.instanceMatrix.needsUpdate=!0,T.scale.setScalar(1+Math.sin(n*1.3)*.08),D.forEach((t,n)=>{t.angle+=t.orbit.speed*V.value*e;let r=t.angle,i=0;if(n===0){let e=Math.atan2(Math.sin(w-r),Math.cos(w-r));r+=e*xe.value,H.dragging&&(r=H.angle),i=Math.max(Se.value+H.level,-.15)}let a=1+i*se;t.group.scale.set(a,a,1),t.body.position.set(Math.cos(r)*t.orbit.radius,Math.sin(r)*t.orbit.radius,0),t.body.scale.set(1/a,1/a,1),t.trail.head=r,t.trail.strength=.55+.45*V.value}),O.body.getWorldPosition(N.position),de.intensity=1.9+H.glow*1.2+Math.sin(n*5)*.08,O.body.scale.multiplyScalar(1+H.glow*.22),s.current===`excited`&&!H.dragging&&(W-=e,W<=0&&(W=3.4,Oe(),H.level=-.9,t.tweens.to(H,{level:0},{duration:.8,delay:1.3,ease:`back.out`}))),q<1&&(q=Math.min(1,q+e/1.9),k.life=q,k.mesh.position.copy(G).addScaledVector(K,.9+q*6.5),Z.copy(K),$.copy(c.camera.position).sub(k.mesh.position),Q.crossVectors($,Z).normalize(),$.crossVectors(Z,Q).normalize(),k.mesh.quaternion.setFromRotationMatrix(J.makeBasis(Z,Q,$))),E.pixelScale=.5*t.viewport.height*t.viewport.dpr*c.camera.projectionMatrix.elements[5]}}});export{T as default};