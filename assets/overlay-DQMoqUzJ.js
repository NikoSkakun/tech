import{u as e}from"./palette-BnC5IwH6.js";import{V as t}from"./index-BpPtQQ1w.js";var n=`
#dbg{position:fixed;left:10px;top:10px;z-index:20;width:268px;max-height:calc(100vh - 20px);display:flex;flex-direction:column;
  font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:${e(`mist`)};
  background:rgba(13,17,54,.86);border:1px solid rgba(45,226,230,.35);border-radius:12px;overflow:hidden;user-select:none}
#dbg.min .dbg-body{display:none}
#dbg header{display:flex;gap:6px;align-items:center;padding:7px 9px;background:rgba(26,22,87,.9);color:${e(`white`)};cursor:pointer}
#dbg header b{flex:1}
#dbg .dbg-body{overflow:auto;padding:6px 8px 8px}
#dbg .row{display:flex;gap:4px;flex-wrap:wrap;margin:4px 0}
#dbg button{font:inherit;color:${e(`white`)};background:rgba(46,31,122,.9);border:1px solid rgba(141,143,184,.4);border-radius:7px;padding:3px 7px;cursor:pointer}
#dbg button:hover{border-color:${e(`cyan`)}}
#dbg button.on{background:${e(`cyan`)};color:${e(`bg.void`)};border-color:${e(`cyan`)}}
#dbg .ch{margin-top:6px;color:${e(`white`)};font-weight:700}
#dbg .ch small{color:${e(`steel`)};font-weight:400}
#dbg .st{display:block;width:100%;text-align:left;margin:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#dbg pre{margin:6px 0 0;white-space:pre-wrap;color:${e(`mist`)}}
#dbg .tip{color:${e(`yellow`)};min-height:16px}
#dbg .err{color:${e(`coral`)}}
`;function r(e){let r=document.createElement(`style`);r.textContent=n,document.head.appendChild(r);let i=document.createElement(`div`);i.id=`dbg`,i.innerHTML=`<header><b>debug</b><span id="dbg-pos"></span><span>▾</span></header>
    <div class="dbg-body">
      <div class="row" id="dbg-q"></div>
      <div class="row">
        <button id="dbg-prev">← prev</button><button id="dbg-next">next →</button>
        <button id="dbg-pause">pause</button><button id="dbg-step">step</button><button id="dbg-rm">reduced motion</button>
      </div>
      <div class="tip" id="dbg-tip"></div>
      <pre id="dbg-stats"></pre>
      <div id="dbg-list"></div>
    </div>`,document.body.appendChild(i);let a=e=>i.querySelector(`#${e}`);i.querySelector(`header`).addEventListener(`click`,()=>i.classList.toggle(`min`));let o=a(`dbg-q`),s=[`auto`,...t],c=s.map(t=>{let n=document.createElement(`button`);return n.textContent=t,n.addEventListener(`click`,()=>e.setQuality(t)),o.appendChild(n),n});e.store.subscribe(e=>e.settings.quality,()=>{let t=e.store.get().settings.quality;c.forEach((e,n)=>e.classList.toggle(`on`,s[n]===t))},{immediate:!0}),a(`dbg-prev`).addEventListener(`click`,()=>void e.nav.prev()),a(`dbg-next`).addEventListener(`click`,()=>void e.nav.next());let l=a(`dbg-pause`);l.addEventListener(`click`,()=>{e.clock.paused=!e.clock.paused,e.clock.paused||e.clock.resetReal(),l.classList.toggle(`on`,e.clock.paused)}),a(`dbg-step`).addEventListener(`click`,()=>{e.clock.paused=!0,l.classList.add(`on`),e.advance(1/60)});let u=a(`dbg-rm`);u.addEventListener(`click`,()=>{e.store.updateSettings({reducedMotion:!e.reducedMotion}),u.classList.toggle(`on`,e.reducedMotion)}),u.classList.toggle(`on`,e.reducedMotion);let d=a(`dbg-list`),f=new Map,p=e.library.volumes.flatMap(t=>e.library.registry(t.id)?.chapters??[]);for(let t of p){let n=document.createElement(`div`);n.className=`ch`,n.innerHTML=`${t.parent?`↳ `:``}${t.volume}/${t.id} <small>${t.axisLabel}${t.dev?` · dev`:``}</small>`,d.appendChild(n);for(let n of t.steps){let r=document.createElement(`button`);r.className=`st`,r.textContent=`${n.id} — ${n.title}`,r.addEventListener(`click`,()=>void e.nav.goto(`${t.volume}/${t.id}`,n.id)),d.appendChild(r),f.set(`${t.volume}/${t.id}/${n.id}`,r)}}let m=a(`dbg-pos`);e.store.subscribe(e=>`${e.volumeId}/${e.chapterId}/${e.stepId}`,()=>{let t=e.store.get();m.textContent=t.chapterId?`${t.volumeId}/${t.chapterId}/${t.stepId}`:``;for(let[e,n]of f)n.classList.toggle(`on`,e===`${t.volumeId}/${t.chapterId}/${t.stepId}`)},{immediate:!0});let h=a(`dbg-tip`);e.input.on(`hover`,e=>{h.textContent=e.tooltip?`hover: ${e.tooltip}`:``});let g=a(`dbg-stats`),_=0;e.onUpdate(()=>{let t=performance.now();if(t-_<250)return;_=t;let n=e.stats(),r=e.store.get().transition,i=window.__app.errors();g.innerHTML=`${n.fps.toFixed(0)} fps · cpu ${n.cpuAvg.toFixed(2)} ms (p95 ${n.cpuP95.toFixed(2)})\n${n.drawCalls} calls · ${(n.triangles/1e3).toFixed(1)}k tris\ngeo ${n.geometries} · tex ${n.textures} · prog ${n.programs} · tweens ${n.tweens}\n${n.width}×${n.height} @${n.dpr.toFixed(2)} · ${n.quality} · t=${n.time.toFixed(2)}\ntransition: ${r.phase}${r.phase===`idle`?``:` → ${r.to} ${(r.progress*100).toFixed(0)}%`}`+(i.length?`\n<span class="err">${i.length} console errors/warnings</span>`:``)})}export{r as mountDebugOverlay};