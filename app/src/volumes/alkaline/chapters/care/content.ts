/** All reader text comes from the generated runtime content (docs/volumes/alkaline/chapters/care.md → tools/content). */
import { defineContent } from '@/content';
import { captions } from '@alkaline/shared/chapter';
import raw from '../../content/generated/care.json';

const content = defineContent(raw);
export default content;
/** Caption `i` of a step («Підписи» of the script, in their order). */
export const caption = captions('care', content);
