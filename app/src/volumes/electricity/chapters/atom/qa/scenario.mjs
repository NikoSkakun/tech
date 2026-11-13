/* global process, console */
// Screenshot scenario for `tools/qa/shot.mjs --script`: puts a step into an interaction state before the shot.
// The state is described by $DO, a comma-separated list of actions run in order:
//
//   click:<control id>[:fx]        button / toggle (fx 0…1 inside it; toggles: 0.08)
//   pick:<control id>:<item>       item of a segmented control, or `plus` / `minus` of a builder stepper
//   slide:<control id>:<fx>        slider knob to the fraction fx of its track
//   hold:<control id>:<item>:<s>   press and hold a part of a control for s seconds (auto-repeat)
//   tap:<probe>  hover:<probe>     scene object published with ctx.qa.probe
//   drag:<probe>:<fx>:<fy>         press on a probe and drag by fractions of the viewport height; stays down
//   release                        let the drag go
//   wait:<seconds>                 advance the frozen clock
//   read:<name>                    print the chapter state published with ctx.qa.expose(name)
//
//   DO="pick:model:quantum,pick:orbital:3d,wait:7" node tools/qa/shot.mjs atom/models --size 1280x720 \
//     --script app/src/volumes/electricity/chapters/atom/qa/scenario.mjs --out /srv/electricity/qa/P-atom/3d.jpg
import { advance, at, click, clickProbe, dragProbe, hold, pick, read, slide } from './helpers.mjs';

export default async (page) => {
  let release = null;
  for (const action of (process.env.DO ?? '').split(',').filter(Boolean)) {
    const [verb, a, b, c] = action.split(':');
    if (verb === 'click') await click(page, a, b === undefined ? 0.5 : Number(b));
    else if (verb === 'pick') await pick(page, a, b);
    else if (verb === 'slide') await slide(page, a, Number(b));
    else if (verb === 'hold') await hold(page, `ctl-${a}:${b}`, Number(c));
    else if (verb === 'tap') await clickProbe(page, a);
    else if (verb === 'hover') {
      const p = await at(page, a);
      await page.mouse.move(p.x, p.y, { steps: 4 });
      await advance(page, 0.3);
    } else if (verb === 'drag') release = await dragProbe(page, a, Number(b), Number(c));
    else if (verb === 'release') await release?.();
    else if (verb === 'wait') await advance(page, Number(a));
    else if (verb === 'read') console.log(`read ${a} →`, JSON.stringify(await read(page, a)));
    else throw new Error(`scenario: unknown action '${action}'`);
  }
  if (!process.env.DO) await advance(page, 2);
};
