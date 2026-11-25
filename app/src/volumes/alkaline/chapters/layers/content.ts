/** All reader text comes from the generated runtime content (docs/volumes/alkaline/chapters/layers.md → tools/content). */
import { defineContent } from '@/content';
import { captions } from '@alkaline/shared/chapter';
import raw from '../../content/generated/layers.json';

const content = defineContent(raw);
export default content;
/** Caption `i` of a step («Підписи» of the script, in their order). */
export const caption = captions('layers', content);
