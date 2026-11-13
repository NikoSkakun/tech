import{$ as e,C as t,F as n,H as r,O as i,U as a,Z as o,bt as s,c,ct as l,et as u,l as d,mt as f,p,pt as m,xt as h}from"./three-DivSuCi6.js";import{i as g,o as _}from"./palette-DIXoAjR5.js";import{a as ee}from"./tween-WuFZ1pug.js";import{H as v,R as y,k as b}from"./index-lV7NYp5i.js";import{t as x}from"./style-VNxrSw10.js";import"./text-BjuvH6eo.js";import{labels as te}from"./content-CYJfo7rl.js";function ne(t,n,r,i,a){let o=new Float32Array(n*3),s=new Float32Array(n*3);for(let e=0;e<n;e++){let n=t.next()<.42?.42:.82,i=Math.max(.12,n+t.gauss()*.11)*r,[a,c,l]=t.onSphere();o.set([a*i,c*i*.92,l*i],e*3),s.set([t.next(),t.range(.6,1.6),t.next()],e*3)}let u=new d;u.setAttribute(`position`,new c(o,3)),u.setAttribute(`aSeed`,new c(s,3));let f=new l({uniforms:{uKTime:v.uKTime,uAmount:{value:1},uPixelScale:{value:600},uRadius:{value:r},uInner:{value:_(i)},uOuter:{value:_(a)}},vertexShader:`
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
      }`,transparent:!0,depthWrite:!1,blending:2}),p=new e(u,f);return p.frustumCulled=!1,p.name=`electron-cloud`,{points:p,get amount(){return f.uniforms.uAmount.value},set amount(e){f.uniforms.uAmount.value=e,p.visible=e>.002},get pixelScale(){return f.uniforms.uPixelScale.value},set pixelScale(e){f.uniforms.uPixelScale.value=e}}}function re(e,t,n,r=.4){let i=new l({uniforms:{uColor:{value:_(n)},uHead:{value:0},uLength:{value:r},uStrength:{value:1}},vertexShader:`
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
      }`,transparent:!0,depthWrite:!1,blending:2,side:2}),o=new a(new f(e,t,8,220),i);return o.name=`orbit-trail`,{mesh:o,get head(){return i.uniforms.uHead.value*Math.PI*2},set head(e){i.uniforms.uHead.value=(e/(Math.PI*2)%1+1)%1},get strength(){return i.uniforms.uStrength.value},set strength(e){i.uniforms.uStrength.value=e}}}function ie(e=`yellow`){let t=_(e),n=new l({uniforms:{uKTime:v.uKTime,uColor:{value:t},uCore:{value:t.clone().lerp(new p(1,1,1),.7)},uLife:{value:1}},vertexShader:`
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
      }`,transparent:!0,depthWrite:!1,blending:2,side:2}),r=new a(new o(2,.09,96,1),n);return r.name=`photon`,r.visible=!1,{mesh:r,get life(){return n.uniforms.uLife.value},set life(e){n.uniforms.uLife.value=e,r.visible=e>.001&&e<.999}}}var S=class extends a{constructor(e,t,n,r){let i=new d;i.setAttribute(`position`,new c(new Float32Array(12),3)),i.setAttribute(`aEnd`,new c(new Float32Array([0,0,1,1]),1)),i.setAttribute(`aSide`,new c(new Float32Array([-1,1,-1,1]),1)),i.setIndex([0,1,2,2,1,3]),super(i,new l({uniforms:{uFrom:{value:e.clone()},uTo:{value:t.clone()},uColor:{value:n},uWidth:{value:r},uViewport:{value:new s(1280,720)},uFade:{value:1}},vertexShader:`
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
          }`,transparent:!0,depthTest:!1,depthWrite:!1,side:2})),this.frustumCulled=!1}get fade(){return this.material.uniforms.uFade.value}set fade(e){this.material.uniforms.uFade.value=e}onBeforeRender(e){e.getSize(this.material.uniforms.uViewport.value)}};function C(e,t){let n=new i;n.name=`label:${e}`;let r=t.color??`white`,a=new h(...t.offset),o=t.size??20,s=new y(`●`,{font:`body`,size:15,color:r,anchorX:`center`,anchorY:`middle`,billboard:!0,screenSpace:!0,depthTest:!1,depthWrite:!1,rich:!1}),c=new S(new h,a.clone().multiplyScalar(.94),_(r),1.8),l=new y(e,{font:`bodyBold`,size:o,color:r,anchorX:t.anchor===`center`?`center`:a.x>=0?`left`:`right`,anchorY:`middle`,billboard:!0,screenSpace:!0,depthTest:!1,depthWrite:!1,halo:{radius:.12,color:`bg.void`,opacity:.85}});return l.position.copy(a).multiplyScalar(t.anchor===`center`?1.22:1.03),c.renderOrder=1,s.renderOrder=2,l.renderOrder=3,n.add(c,s,l),ee(n)}var w=.5,ae=[{radius:3,tilt:new t(1.2,.25,0),speed:.9,phase:.6},{radius:3.75,tilt:new t(.55,.95,.3),speed:-.68,phase:2.3},{radius:4.5,tilt:new t(-.62,-.5,.85),speed:.52,phase:4.2}],T=.35,oe=.42,E=b(e=>{let{root:t,stage:o,camera:s,random:c}=e;e.env.setScale(6),e.env.setShadow({extent:3.2,softness:4});let l=new i;l.name=`nucleus`,t.add(l);let d=[];for(let e=0;e<14;e++)d.push(new h(...c.onSphere()).multiplyScalar(c.range(.2,1.2)));let p=new h;for(let e=0;e<160;e++)for(let e=0;e<14;e++){d[e].multiplyScalar(.985);for(let t=e+1;t<14;t++){p.subVectors(d[e],d[t]);let n=p.length()||.001,r=w*1.86-n;r>0&&(p.multiplyScalar(r*.5/n),d[e].add(p),d[t].sub(p))}}let _=new m(w,48,32),ee=x.toon({color:g.proton,highlight:.6,rim:1.3,gloss:.7}),v=x.toon({gradient:{bottom:g.neutronShade,top:g.neutron,range:[-.45,.4]},highlight:.5,rim:1.1,gloss:.7}),b=new n(_,ee,7),S=new n(_,v,7);for(let e of[b,S])e.castShadow=!0,e.receiveShadow=!0,e.frustumCulled=!1,l.add(e);let E=new a(new m(.62,24,16),x.glow({color:`amber`,intensity:1.5,additive:!0,opacity:.5,falloff:1.2}));l.add(E);let se=d.filter((e,t)=>t%2==0).map(()=>{let e=new y(`+`,{font:`display`,size:.5,color:`white`,opacity:.9,anchorX:`center`,anchorY:`middle`,billboard:!0,depthWrite:!1,rich:!1});return t.add(e),e}),D=ne(c.fork(`cloud`),e.quality.count(1500,300),5.2,`cyan`,`violet`);t.add(D.points);let ce=new m(.17,32,20),le=new m(.36,24,16),O=ae.map((e,n)=>{let r=new i;r.rotation.copy(e.tilt),r.name=`orbit-${n}`;let o=new a(new f(e.radius,.011,6,200),x.glow({color:`violet.light`,intensity:.55,additive:!0,opacity:.6,falloff:0})),s=re(e.radius,.034,g.electron,.34),c=new a(ce,x.glow({color:g.electron,intensity:1.9,falloff:2,edge:.52})),l=new a(le,x.glow({color:g.electron,intensity:.6,additive:!0,opacity:.4,falloff:2.4,edge:0}));return c.add(l),r.add(o,s.mesh,c),t.add(r),{orbit:e,group:r,ring:o,trail:s,body:c,angle:e.phase}}),k=O[0],ue=k.body.material,A=ie(g.photon);t.add(A.mesh);let j=te,M=C(j.nucleus,{offset:[1.5,1.7,.3],color:`white`});M.position.set(.5,.95,.5);let N=C(j.cloud,{offset:[-.9,1,0],color:`violet.light`});N.position.set(-2.9,2.5,1);let de=C(j.electron,{offset:[.42,.34,0],color:`cyan`});k.body.add(de);let P=C(j.drag,{offset:[0,.62,0],color:`cyan`,size:18,anchor:`center`});t.add(P);let fe=(e,t)=>[...e].sort((e,n)=>n.z+n.x*t-(e.z+e.x*t))[0],F=fe(d.filter((e,t)=>t%2==0),.8),I=fe(d.filter((e,t)=>t%2==1),-.8),L=C(j.proton,{offset:[.75,.6,.2],color:`coral`});L.position.copy(F).multiplyScalar(1+w/F.length());let R=C(j.neutron,{offset:[-1,.7,.2],color:`mist`});R.position.copy(I).multiplyScalar(1+w/I.length()),t.add(M,N,L,R);let pe=C(j.photon,{offset:[.1,.55,0],color:`yellow`,size:18});A.mesh.add(pe);let z=new h(Math.cos(T)*k.orbit.radius,Math.sin(T)*k.orbit.radius,0).applyEuler(k.orbit.tilt);s.shots({atom:{position:[.5,4.4,16.5],target:[0,0,0],fov:32},nucleus:{position:[1.9,1.5,5.4],target:[0,.05,0],fov:30,orbit:{azimuth:1.2,polar:.6}},electron:{position:z.clone().add(new h(.9,.7,3.4)),target:z,focus:k.body,fov:30,orbit:{azimuth:.5,polar:.3,zoom:[.8,1.6]}},excited:{position:[-3.5,4,15.8],target:[.2,0,0],fov:32}});let B={appear:`fade`,inDuration:.4},me=o.actor(M,B),he=o.actor(N,B),ge=o.actor(de,B),_e=o.actor(P,B),ve=o.actor(L,B),ye=o.actor(R,B),V=O.map(e=>o.actor(e.group));o.param(`cloud`,1,{onChange:e=>D.amount=e});let be=o.param(`spin`,1),xe=o.param(`hold`,0,{duration:1.4,ease:`power2.inOut`}),Se=o.param(`excite`,0,{duration:.9,ease:`back.out`});o.param(`core`,1.5,{onChange:e=>E.material.intensity=e}),o.define({atom:{show:[...V,me,he],camera:`atom`},nucleus:{show:[ve,ye],params:{cloud:.12,spin:.4,core:2.4},camera:`nucleus`,post:{aoIntensity:.7}},electron:{show:[V[0],ge],params:{cloud:.3,spin:.25,hold:1},camera:`electron`,post:{bloomIntensity:1}},excited:{show:[...V,_e],params:{cloud:.55,spin:.7,excite:1},camera:`excited`,post:{bloomIntensity:1.25}}});let H={level:0,dragging:!1,angle:0,glow:0},Ce=new h(0,0,1).applyEuler(k.orbit.tilt),we=new h,U=new h,Te=new u().setFromEuler(k.orbit.tilt).invert(),Ee=new h,De=e=>{if(!e.planePoint(Ce,Ee,we))return;U.copy(we).applyQuaternion(Te),H.angle=Math.atan2(U.y,U.x);let t=Math.hypot(U.x,U.y)/k.orbit.radius;H.level=Math.min(Math.max((t-1)/oe,-.15),1.25)},W=2.2,Oe=()=>{G.copy(k.body.getWorldPosition(new h)),K.copy(G).normalize(),q=1e-4};e.input.register(k.body,{tooltip:te.electron,cursor:`grab`,hover:t=>e.tweens.to(H,{glow:+!!t},{duration:.12}),dragStart:e=>{H.dragging=!0,De(e)},drag:De,dragEnd:()=>{H.dragging=!1,H.level>.25&&Oe(),k.angle=H.angle,e.tweens.to(H,{level:0},{duration:.5,ease:`power2.in`}),W=3.4}});let G=new h,K=new h(1,0,0),q=1,J=new r,Y=new h,ke=new u,X=new h,Z=new h,Q=new h,$=new h;return{enterStep(){W=2.2},update(t,n){l.rotation.y=n*.16,l.rotation.x=Math.sin(n*.11)*.2;for(let e=0;e<14;e++){let t=d[e],r=1+Math.sin(n*1.7+e*2.1)*.035;Y.copy(t).multiplyScalar(r),X.setScalar(1+Math.sin(n*2.3+e*1.3)*.025),J.compose(Y,ke.identity(),X),(e%2==0?b:S).setMatrixAt(e>>1,J)}L.position.copy(F).multiplyScalar(1+w/F.length()),l.localToWorld(L.position),R.position.copy(I).multiplyScalar(1+w/I.length()),l.localToWorld(R.position),b.instanceMatrix.needsUpdate=!0,l.updateMatrixWorld(),se.forEach((e,t)=>{let r=1+Math.sin(n*1.7+t*2*2.1)*.035;Y.copy(d[t*2]).multiplyScalar(r),l.localToWorld(Y),X.copy(s.camera.position).sub(Y).normalize(),e.position.copy(Y).addScaledVector(X,w*1.03)}),S.instanceMatrix.needsUpdate=!0,E.scale.setScalar(1+Math.sin(n*1.3)*.08),O.forEach((e,n)=>{e.angle+=e.orbit.speed*be.value*t;let r=e.angle,i=0;if(n===0){let e=Math.atan2(Math.sin(T-r),Math.cos(T-r));r+=e*xe.value,H.dragging&&(r=H.angle),i=Math.max(Se.value+H.level,-.15)}let a=1+i*oe;e.group.scale.set(a,a,1),e.body.position.set(Math.cos(r)*e.orbit.radius,Math.sin(r)*e.orbit.radius,0),e.body.scale.set(1/a,1/a,1),e.trail.head=r,e.trail.strength=.55+.45*be.value}),k.body.getWorldPosition(P.position),ue.intensity=1.9+H.glow*1.2+Math.sin(n*5)*.08,k.body.scale.multiplyScalar(1+H.glow*.22),o.current===`excited`&&!H.dragging&&(W-=t,W<=0&&(W=3.4,Oe(),H.level=-.9,e.tweens.to(H,{level:0},{duration:.8,delay:1.3,ease:`back.out`}))),q<1&&(q=Math.min(1,q+t/1.9),A.life=q,A.mesh.position.copy(G).addScaledVector(K,.9+q*6.5),Z.copy(K),$.copy(s.camera.position).sub(A.mesh.position),Q.crossVectors($,Z).normalize(),$.crossVectors(Z,Q).normalize(),A.mesh.quaternion.setFromRotationMatrix(J.makeBasis(Z,Q,$))),D.pixelScale=.5*e.viewport.height*e.viewport.dpr*s.camera.projectionMatrix.elements[5]}}});export{E as default};