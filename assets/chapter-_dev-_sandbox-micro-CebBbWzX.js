import{C as e,F as t,H as n,O as r,Q as i,St as a,U as o,c as s,et as c,ht as l,l as u,lt as d,mt as f,p,tt as ee,xt as m}from"./three-C4KRfW3Y.js";import{c as h,o as g}from"./palette-BnC5IwH6.js";import"./api-Cblt3J-b.js";import{a as te}from"./tween-Czwt7mfe.js";import{B as _,G as v,j as y}from"./index-B2dlDKLv.js";import{t as b}from"./style-D3hc74fy.js";import"./text-DjvLdMZu.js";import{labels as ne}from"./content-CgT3PtJ8.js";function re(e,t,n,r,i){let a=new Float32Array(t*3),o=new Float32Array(t*3);for(let r=0;r<t;r++){let t=e.next()<.42?.42:.82,i=Math.max(.12,t+e.gauss()*.11)*n,[s,c,l]=e.onSphere();a.set([s*i,c*i*.92,l*i],r*3),o.set([e.next(),e.range(.6,1.6),e.next()],r*3)}let l=new u;l.setAttribute(`position`,new s(a,3)),l.setAttribute(`aSeed`,new s(o,3));let f=new d({uniforms:{uKTime:v.uKTime,uAmount:{value:1},uPixelScale:{value:600},uRadius:{value:n},uInner:{value:h(r)},uOuter:{value:h(i)}},vertexShader:`
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
      }`,transparent:!0,depthWrite:!1,blending:2}),p=new c(l,f);return p.frustumCulled=!1,p.name=`electron-cloud`,{points:p,get amount(){return f.uniforms.uAmount.value},set amount(e){f.uniforms.uAmount.value=e,p.visible=e>.002},get pixelScale(){return f.uniforms.uPixelScale.value},set pixelScale(e){f.uniforms.uPixelScale.value=e}}}function ie(e,t,n,r=.4){let i=new d({uniforms:{uColor:{value:h(n)},uHead:{value:0},uLength:{value:r},uStrength:{value:1}},vertexShader:`
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
      }`,transparent:!0,depthWrite:!1,blending:2,side:2}),a=new o(new l(e,t,8,220),i);return a.name=`orbit-trail`,{mesh:a,get head(){return i.uniforms.uHead.value*Math.PI*2},set head(e){i.uniforms.uHead.value=(e/(Math.PI*2)%1+1)%1},get strength(){return i.uniforms.uStrength.value},set strength(e){i.uniforms.uStrength.value=e}}}function ae(e=`yellow`){let t=h(e),n=new d({uniforms:{uKTime:v.uKTime,uColor:{value:t},uCore:{value:t.clone().lerp(new p(1,1,1),.7)},uLife:{value:1}},vertexShader:`
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
      }`,transparent:!0,depthWrite:!1,blending:2,side:2}),r=new o(new i(2,.09,96,1),n);return r.name=`photon`,r.visible=!1,{mesh:r,get life(){return n.uniforms.uLife.value},set life(e){n.uniforms.uLife.value=e,r.visible=e>.001&&e<.999}}}var x=class extends o{constructor(e,t,n,r){let i=new u;i.setAttribute(`position`,new s(new Float32Array(12),3)),i.setAttribute(`aEnd`,new s(new Float32Array([0,0,1,1]),1)),i.setAttribute(`aSide`,new s(new Float32Array([-1,1,-1,1]),1)),i.setIndex([0,1,2,2,1,3]),super(i,new d({uniforms:{uFrom:{value:e.clone()},uTo:{value:t.clone()},uColor:{value:n},uWidth:{value:r},uViewport:{value:new m(1280,720)},uFade:{value:1}},vertexShader:`
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
          }`,transparent:!0,depthTest:!1,depthWrite:!1,side:2})),this.frustumCulled=!1}get fade(){return this.material.uniforms.uFade.value}set fade(e){this.material.uniforms.uFade.value=e}onBeforeRender(e){e.getSize(this.material.uniforms.uViewport.value)}};function S(e,t){let n=new r;n.name=`label:${e}`;let i=t.color??`white`,o=new a(...t.offset),s=t.size??20,c=new _(`●`,{font:`body`,size:15,color:i,anchorX:`center`,anchorY:`middle`,billboard:!0,screenSpace:!0,depthTest:!1,depthWrite:!1,rich:!1}),l=new x(new a,o.clone().multiplyScalar(.94),h(i),1.8),u=new _(e,{font:`bodyBold`,size:s,color:i,anchorX:t.anchor===`center`?`center`:o.x>=0?`left`:`right`,anchorY:`middle`,billboard:!0,screenSpace:!0,depthTest:!1,depthWrite:!1,halo:{radius:.12,color:`bg.void`,opacity:.85}});return u.position.copy(o).multiplyScalar(t.anchor===`center`?1.22:1.03),l.renderOrder=1,c.renderOrder=2,u.renderOrder=3,n.add(l,c,u),te(n)}var C=.5,oe=[{radius:3,tilt:new e(1.2,.25,0),speed:.9,phase:.6},{radius:3.75,tilt:new e(.55,.95,.3),speed:-.68,phase:2.3},{radius:4.5,tilt:new e(-.62,-.5,.85),speed:.52,phase:4.2}],w=.35,se=.42,T=y(e=>{let{root:i,stage:s,camera:c,random:u}=e;e.env.setScale(6),e.env.setShadow({extent:3.2,softness:4});let d=new r;d.name=`nucleus`,i.add(d);let p=[];for(let e=0;e<14;e++)p.push(new a(...u.onSphere()).multiplyScalar(u.range(.2,1.2)));let m=new a;for(let e=0;e<160;e++)for(let e=0;e<14;e++){p[e].multiplyScalar(.985);for(let t=e+1;t<14;t++){m.subVectors(p[e],p[t]);let n=m.length()||.001,r=C*1.86-n;r>0&&(m.multiplyScalar(r*.5/n),p[e].add(m),p[t].sub(m))}}let h=new f(C,48,32),te=b.toon({color:g.proton,highlight:.6,rim:1.3,gloss:.7}),v=b.toon({gradient:{bottom:g.neutronShade,top:g.neutron,range:[-.45,.4]},highlight:.5,rim:1.1,gloss:.7}),y=new t(h,te,7),x=new t(h,v,7);for(let e of[y,x])e.castShadow=!0,e.receiveShadow=!0,e.frustumCulled=!1,d.add(e);let T=new o(new f(.62,24,16),b.glow({color:`amber`,intensity:1.5,additive:!0,opacity:.5,falloff:1.2}));d.add(T);let ce=p.filter((e,t)=>t%2==0).map(()=>{let e=new _(`+`,{font:`display`,size:.5,color:`white`,opacity:.9,anchorX:`center`,anchorY:`middle`,billboard:!0,depthWrite:!1,rich:!1});return i.add(e),e}),E=re(u.fork(`cloud`),e.quality.count(1500,300),5.2,`cyan`,`violet`);i.add(E.points);let le=new f(.17,32,20),ue=new f(.36,24,16),D=oe.map((e,t)=>{let n=new r;n.rotation.copy(e.tilt),n.name=`orbit-${t}`;let a=new o(new l(e.radius,.011,6,200),b.glow({color:`violet.light`,intensity:.55,additive:!0,opacity:.6,falloff:0})),s=ie(e.radius,.034,g.electron,.34),c=new o(le,b.glow({color:g.electron,intensity:1.9,falloff:2,edge:.52})),u=new o(ue,b.glow({color:g.electron,intensity:.6,additive:!0,opacity:.4,falloff:2.4,edge:0}));return c.add(u),n.add(a,s.mesh,c),i.add(n),{orbit:e,group:n,ring:a,trail:s,body:c,angle:e.phase}}),O=D[0],de=O.body.material,k=ae(g.photon);i.add(k.mesh);let A=ne,j=S(A.nucleus,{offset:[1.5,1.7,.3],color:`white`});j.position.set(.5,.95,.5);let M=S(A.cloud,{offset:[-.9,1,0],color:`violet.light`});M.position.set(-2.9,2.5,1);let N=S(A.electron,{offset:[.42,.34,0],color:`cyan`});O.body.add(N);let P=S(A.drag,{offset:[0,.62,0],color:`cyan`,size:18,anchor:`center`});i.add(P);let F=(e,t)=>[...e].sort((e,n)=>n.z+n.x*t-(e.z+e.x*t))[0],I=F(p.filter((e,t)=>t%2==0),.8),L=F(p.filter((e,t)=>t%2==1),-.8),R=S(A.proton,{offset:[.75,.6,.2],color:`coral`});R.position.copy(I).multiplyScalar(1+C/I.length());let z=S(A.neutron,{offset:[-1,.7,.2],color:`mist`});z.position.copy(L).multiplyScalar(1+C/L.length()),i.add(j,M,R,z);let fe=S(A.photon,{offset:[.1,.55,0],color:`yellow`,size:18});k.mesh.add(fe);let pe=new a(Math.cos(w)*O.orbit.radius,Math.sin(w)*O.orbit.radius,0).applyEuler(O.orbit.tilt);c.shots({atom:{position:[.5,4.4,16.5],target:[0,0,0],fov:32,fit:{center:[0,0,0],radius:5.6}},nucleus:{position:[1.9,1.5,5.4],target:[0,.05,0],fov:30,fit:{center:[0,.05,0],radius:1.5},orbit:{azimuth:1.2,polar:.6}},electron:{position:pe.clone().add(new a(.9,.7,3.4)),target:pe,focus:O.body,fov:30,orbit:{azimuth:.5,polar:.3,zoom:[.8,1.6]}},excited:{position:[-3.5,4,15.8],target:[.2,0,0],fov:32}});let B={appear:`fade`,inDuration:.4},me=s.actor(j,B),he=s.actor(M,B),ge=s.actor(N,B),_e=s.actor(P,B),ve=s.actor(R,B),ye=s.actor(z,B),V=D.map(e=>s.actor(e.group));s.param(`cloud`,1,{onChange:e=>E.amount=e});let be=s.param(`spin`,1),xe=s.param(`hold`,0,{duration:1.4,ease:`power2.inOut`}),Se=s.param(`excite`,0,{duration:.9,ease:`back.out`});s.param(`core`,1.5,{onChange:e=>T.material.intensity=e}),s.define({atom:{show:[...V,me,he],camera:`atom`},nucleus:{show:[ve,ye],params:{cloud:.12,spin:.4,core:2.4},camera:`nucleus`,post:{aoIntensity:.7}},electron:{show:[V[0],ge],params:{cloud:.3,spin:.25,hold:1},camera:`electron`,post:{bloomIntensity:1}},excited:{show:[...V,_e],params:{cloud:.55,spin:.7,excite:1},camera:`excited`,post:{bloomIntensity:1.25}}});let H={level:0,dragging:!1,angle:0,glow:0},Ce=new a(0,0,1).applyEuler(O.orbit.tilt),we=new a,U=new a,Te=new ee().setFromEuler(O.orbit.tilt).invert(),Ee=new a,De=e=>{if(!e.planePoint(Ce,Ee,we))return;U.copy(we).applyQuaternion(Te),H.angle=Math.atan2(U.y,U.x);let t=Math.hypot(U.x,U.y)/O.orbit.radius;H.level=Math.min(Math.max((t-1)/se,-.15),1.25)},W=2.2,Oe=()=>{G.copy(O.body.getWorldPosition(new a)),K.copy(G).normalize(),q=1e-4};e.input.register(O.body,{tooltip:ne.electron,cursor:`grab`,hover:t=>e.tweens.to(H,{glow:+!!t},{duration:.12}),dragStart:e=>{H.dragging=!0,De(e)},drag:De,dragEnd:()=>{H.dragging=!1,H.level>.25&&Oe(),O.angle=H.angle,e.tweens.to(H,{level:0},{duration:.5,ease:`power2.in`}),W=3.4}});let G=new a,K=new a(1,0,0),q=1,J=new n,Y=new a,ke=new ee,X=new a,Z=new a,Q=new a,$=new a;return{enterStep(){W=2.2},update(t,n){d.rotation.y=n*.16,d.rotation.x=Math.sin(n*.11)*.2;for(let e=0;e<14;e++){let t=p[e],r=1+Math.sin(n*1.7+e*2.1)*.035;Y.copy(t).multiplyScalar(r),X.setScalar(1+Math.sin(n*2.3+e*1.3)*.025),J.compose(Y,ke.identity(),X),(e%2==0?y:x).setMatrixAt(e>>1,J)}R.position.copy(I).multiplyScalar(1+C/I.length()),d.localToWorld(R.position),z.position.copy(L).multiplyScalar(1+C/L.length()),d.localToWorld(z.position),y.instanceMatrix.needsUpdate=!0,d.updateMatrixWorld(),ce.forEach((e,t)=>{let r=1+Math.sin(n*1.7+t*2*2.1)*.035;Y.copy(p[t*2]).multiplyScalar(r),d.localToWorld(Y),X.copy(c.camera.position).sub(Y).normalize(),e.position.copy(Y).addScaledVector(X,C*1.03)}),x.instanceMatrix.needsUpdate=!0,T.scale.setScalar(1+Math.sin(n*1.3)*.08),D.forEach((e,n)=>{e.angle+=e.orbit.speed*be.value*t;let r=e.angle,i=0;if(n===0){let e=Math.atan2(Math.sin(w-r),Math.cos(w-r));r+=e*xe.value,H.dragging&&(r=H.angle),i=Math.max(Se.value+H.level,-.15)}let a=1+i*se;e.group.scale.set(a,a,1),e.body.position.set(Math.cos(r)*e.orbit.radius,Math.sin(r)*e.orbit.radius,0),e.body.scale.set(1/a,1/a,1),e.trail.head=r,e.trail.strength=.55+.45*be.value}),O.body.getWorldPosition(P.position),de.intensity=1.9+H.glow*1.2+Math.sin(n*5)*.08,O.body.scale.multiplyScalar(1+H.glow*.22),s.current===`excited`&&!H.dragging&&(W-=t,W<=0&&(W=3.4,Oe(),H.level=-.9,e.tweens.to(H,{level:0},{duration:.8,delay:1.3,ease:`back.out`}))),q<1&&(q=Math.min(1,q+t/1.9),k.life=q,k.mesh.position.copy(G).addScaledVector(K,.9+q*6.5),Z.copy(K),$.copy(c.camera.position).sub(k.mesh.position),Q.crossVectors($,Z).normalize(),$.crossVectors(Z,Q).normalize(),k.mesh.quaternion.setFromRotationMatrix(J.makeBasis(Z,Q,$))),E.pixelScale=.5*e.viewport.height*e.viewport.dpr*c.camera.projectionMatrix.elements[5]}}});export{T as default};