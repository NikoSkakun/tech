/**
 * Dev-only HTML overlay behind `?debug` (lazy chunk): chapter/step list, quality switch, clock controls and
 * live stats, so the app is navigable before the real in-scene HUD exists. Not part of the product UI.
 */
import { hex } from '@/style/palette';
import type { Engine } from '../app';
import { QUALITY_TIERS, type QualityTier } from '../quality';

const CSS = `
#dbg{position:fixed;left:10px;top:10px;z-index:20;width:268px;max-height:calc(100vh - 20px);display:flex;flex-direction:column;
  font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:${hex('mist')};
  background:rgba(13,17,54,.86);border:1px solid rgba(45,226,230,.35);border-radius:12px;overflow:hidden;user-select:none}
#dbg.min .dbg-body{display:none}
#dbg header{display:flex;gap:6px;align-items:center;padding:7px 9px;background:rgba(26,22,87,.9);color:${hex('white')};cursor:pointer}
#dbg header b{flex:1}
#dbg .dbg-body{overflow:auto;padding:6px 8px 8px}
#dbg .row{display:flex;gap:4px;flex-wrap:wrap;margin:4px 0}
#dbg button{font:inherit;color:${hex('white')};background:rgba(46,31,122,.9);border:1px solid rgba(141,143,184,.4);border-radius:7px;padding:3px 7px;cursor:pointer}
#dbg button:hover{border-color:${hex('cyan')}}
#dbg button.on{background:${hex('cyan')};color:${hex('bg.void')};border-color:${hex('cyan')}}
#dbg .ch{margin-top:6px;color:${hex('white')};font-weight:700}
#dbg .ch small{color:${hex('steel')};font-weight:400}
#dbg .st{display:block;width:100%;text-align:left;margin:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#dbg pre{margin:6px 0 0;white-space:pre-wrap;color:${hex('mist')}}
#dbg .tip{color:${hex('yellow')};min-height:16px}
#dbg .err{color:${hex('coral')}}
`;

export function mountDebugOverlay(engine: Engine): void {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.id = 'dbg';
  root.innerHTML = `<header><b>debug</b><span id="dbg-pos"></span><span>▾</span></header>
    <div class="dbg-body">
      <div class="row" id="dbg-q"></div>
      <div class="row">
        <button id="dbg-prev">← prev</button><button id="dbg-next">next →</button>
        <button id="dbg-pause">pause</button><button id="dbg-step">step</button><button id="dbg-rm">reduced motion</button>
      </div>
      <div class="tip" id="dbg-tip"></div>
      <pre id="dbg-stats"></pre>
      <div id="dbg-list"></div>
    </div>`;
  document.body.appendChild(root);
  const $ = (id: string): HTMLElement => root.querySelector(`#${id}`)!;
  root.querySelector('header')!.addEventListener('click', () => root.classList.toggle('min'));

  // quality
  const q = $('dbg-q');
  const tiers: (QualityTier | 'auto')[] = ['auto', ...QUALITY_TIERS];
  const qButtons = tiers.map((tier) => {
    const b = document.createElement('button');
    b.textContent = tier;
    b.addEventListener('click', () => engine.setQuality(tier));
    q.appendChild(b);
    return b;
  });
  const refreshQuality = (): void => {
    const setting = engine.store.get().settings.quality;
    qButtons.forEach((b, i) => b.classList.toggle('on', tiers[i] === setting));
  };
  engine.store.subscribe((s) => s.settings.quality, refreshQuality, { immediate: true });

  // navigation + clock
  $('dbg-prev').addEventListener('click', () => void engine.nav.prev());
  $('dbg-next').addEventListener('click', () => void engine.nav.next());
  const pause = $('dbg-pause');
  pause.addEventListener('click', () => {
    engine.clock.paused = !engine.clock.paused;
    if (!engine.clock.paused) engine.clock.resetReal();
    pause.classList.toggle('on', engine.clock.paused);
  });
  $('dbg-step').addEventListener('click', () => {
    engine.clock.paused = true;
    pause.classList.add('on');
    engine.advance(1 / 60);
  });
  const rm = $('dbg-rm');
  rm.addEventListener('click', () => {
    engine.store.updateSettings({ reducedMotion: !engine.reducedMotion });
    rm.classList.toggle('on', engine.reducedMotion);
  });
  rm.classList.toggle('on', engine.reducedMotion);

  // chapter / step list
  const list = $('dbg-list');
  const stepButtons = new Map<string, HTMLButtonElement>();
  const chapters = engine.library.volumes.flatMap((v) => engine.library.registry(v.id)?.chapters ?? []);
  for (const m of chapters) {
    const h = document.createElement('div');
    h.className = 'ch';
    h.innerHTML = `${m.parent ? '↳ ' : ''}${m.volume}/${m.id} <small>${m.axisLabel}${m.dev ? ' · dev' : ''}</small>`;
    list.appendChild(h);
    for (const s of m.steps) {
      const b = document.createElement('button');
      b.className = 'st';
      b.textContent = `${s.id} — ${s.title}`;
      b.addEventListener('click', () => void engine.nav.goto(`${m.volume}/${m.id}`, s.id));
      list.appendChild(b);
      stepButtons.set(`${m.volume}/${m.id}/${s.id}`, b);
    }
  }
  const pos = $('dbg-pos');
  const refreshPosition = (): void => {
    const s = engine.store.get();
    pos.textContent = s.chapterId ? `${s.volumeId}/${s.chapterId}/${s.stepId}` : '';
    for (const [key, b] of stepButtons)
      b.classList.toggle('on', key === `${s.volumeId}/${s.chapterId}/${s.stepId}`);
  };
  engine.store.subscribe((s) => `${s.volumeId}/${s.chapterId}/${s.stepId}`, refreshPosition, {
    immediate: true,
  });

  // hover tooltip hook (the real HUD renders this in 3D)
  const tip = $('dbg-tip');
  engine.input.on('hover', (e) => {
    tip.textContent = e.tooltip ? `hover: ${e.tooltip}` : '';
  });

  // stats, refreshed 4×/s on real time (this overlay is not part of the simulated world)
  const stats = $('dbg-stats');
  let last = 0;
  engine.onUpdate(() => {
    const now = performance.now();
    if (now - last < 250) return;
    last = now;
    const s = engine.stats();
    const t = engine.store.get().transition;
    const errors = window.__app.errors();
    stats.innerHTML =
      `${s.fps.toFixed(0)} fps · cpu ${s.cpuAvg.toFixed(2)} ms (p95 ${s.cpuP95.toFixed(2)})\n` +
      `${s.drawCalls} calls · ${(s.triangles / 1000).toFixed(1)}k tris\n` +
      `geo ${s.geometries} · tex ${s.textures} · prog ${s.programs} · tweens ${s.tweens}\n` +
      `${s.width}×${s.height} @${s.dpr.toFixed(2)} · ${s.quality} · t=${s.time.toFixed(2)}\n` +
      `transition: ${t.phase}${t.phase !== 'idle' ? ` → ${t.to} ${(t.progress * 100).toFixed(0)}%` : ''}` +
      (errors.length ? `\n<span class="err">${errors.length} console errors/warnings</span>` : '');
  });
}
