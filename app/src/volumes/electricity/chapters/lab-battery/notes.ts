/**
 * Status lines of the chapter (warnings, verdicts, model notes of the document) as `note` controls of the step
 * UI: one place maps the chapter's five tones to an icon and a status colour.
 *
 *   note('over6', L.overCurrent, 'warning', () => overCurrent)      // conditional warning in the dock / board
 *   note('ideal1', L.idealised, 'honesty')                          // permanent model note of the document
 *   note('verdict5', () => verdictText, () => verdictTone)          // live text and tone
 */
import type { NoteSpec, When } from '@/hud';
import { STATUS, type IconName } from '@/ui3d';
import type { ColorLike } from '@/style';

export type Tone = 'info' | 'ok' | 'warning' | 'alarm' | 'honesty';

const TONE: Record<Tone, { color: ColorLike; icon: IconName }> = {
  info: { color: 'mist', icon: 'info' },
  ok: { color: STATUS.ok, icon: 'check' },
  warning: { color: STATUS.warning, icon: 'warning' },
  alarm: { color: STATUS.alarm, icon: 'warning' },
  honesty: { color: STATUS.warning, icon: 'info' },
};

/**
 * A `note` control. With a live `tone` the colour follows it and the icon stays `icon` (default: the info
 * sign, which reads right under every verdict colour).
 */
export function note(
  id: string,
  text: string | (() => string),
  tone: Tone | (() => Tone),
  visible?: When,
  icon?: IconName,
): NoteSpec {
  const live = typeof tone === 'function';
  return {
    type: 'note',
    id,
    text,
    icon: icon ?? (live ? 'info' : TONE[tone].icon),
    color: live ? () => TONE[tone()].color : TONE[tone].color,
    ...(visible === undefined ? {} : { visible }),
  };
}
