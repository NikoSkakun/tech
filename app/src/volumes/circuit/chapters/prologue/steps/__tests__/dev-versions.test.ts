import { describe, expect, it } from 'vitest';
import { parseVersions, versionHref } from '../dev-versions';

describe('dev versions: the manifest v/versions.json', () => {
  it('takes the listed versions in order', () => {
    const json = {
      versions: [
        { id: 'current', label: 'поточна', commit: null },
        { id: 'morning-19', label: 'до правок · 19.11', commit: '00324ea5' },
        { id: 'first', label: 'найперша · 16.11', commit: 'eeb0195e' },
      ],
    };
    expect(parseVersions(json)?.map((v) => v.id)).toEqual(['current', 'morning-19', 'first']);
  });
  it('is no manifest when it is not one, or lists nothing to switch to', () => {
    expect(parseVersions(null)).toBeNull();
    expect(parseVersions('<!doctype html>')).toBeNull();
    expect(parseVersions({ versions: 'x' })).toBeNull();
    expect(parseVersions({ versions: [{ id: 'current', label: 'поточна' }] })).toBeNull();
  });
  it('drops entries whose id is not a plain path segment', () => {
    const json = { versions: [{ id: '../x', label: 'a' }, { id: 'ok', label: 'b' }, { id: 'no-label' }] };
    expect(parseVersions(json)).toEqual([{ id: 'ok', label: 'b' }]);
  });
});

describe('dev versions: addresses', () => {
  const base = 'http://host:8080/?x=1#/circuit/prologue/dive';
  it('opens a frozen version on the first step of the prologue', () => {
    expect(versionHref('first', base)).toBe('http://host:8080/v/first/#/circuit/prologue/click');
  });
  it('goes back to the live build at its own path', () => {
    expect(versionHref('current', base)).toBe('http://host:8080/?x=1#/circuit/prologue/click');
  });
});
