import { describe, expect, it } from 'vitest';
import { applyUmaEventsOverrides, buildUmaEvents, generateUmaEvents, type DaftuydaSkill } from './build-uma-events';

const skills: DaftuydaSkill[] = [
  { id: 201902, char_e: [101001, 100301] }, // Head-On → Taiki (101001) + another outfit
  { id: 201702, char_e: [101001] },         // All I've Got → Taiki
  { id: 200062, char_e: [] },               // no event chars
  { id: 200172, char_e: null },             // null char_e ignored
  { id: 200999 } as DaftuydaSkill,          // missing char_e ignored
];

describe('buildUmaEvents', () => {
  it('inverts char_e into { umaId: skillId[] } keyed + valued by string', () => {
    const out = buildUmaEvents(skills);
    expect(out['101001']).toEqual(['201702', '201902']); // sorted numerically
    expect(out['100301']).toEqual(['201902']);
  });

  it('reproduces the Taiki Shuttle example (Head-On + All I\'ve Got via event)', () => {
    const out = buildUmaEvents(skills);
    expect(out['101001']).toContain('201902'); // Head-On
    expect(out['101001']).toContain('201702'); // All I've Got
  });

  it('skips records with empty / missing / null char_e', () => {
    const out = buildUmaEvents(skills);
    expect(out['200062']).toBeUndefined();
    expect(Object.values(out).flat()).not.toContain('200172');
  });

  it('sorts uma keys numerically', () => {
    const out = buildUmaEvents(skills);
    expect(Object.keys(out)).toEqual(['100301', '101001']);
  });
});

describe('applyUmaEventsOverrides', () => {
  const base = { '101001': ['201702', '201902'] };

  it('adds ids (union, re-sorted) without mutating the base', () => {
    const out = applyUmaEventsOverrides(base, { addByUma: { '101001': ['200062'] } });
    expect(out['101001']).toEqual(['200062', '201702', '201902']);
    expect(base['101001']).toEqual(['201702', '201902']); // base untouched
  });

  it('removes ids (set-difference)', () => {
    const out = applyUmaEventsOverrides(base, { removeByUma: { '101001': ['201702'] } });
    expect(out['101001']).toEqual(['201902']);
  });

  it('can seed a brand-new uma via addByUma', () => {
    const out = applyUmaEventsOverrides(base, { addByUma: { '999999': ['200001'] } });
    expect(out['999999']).toEqual(['200001']);
  });

  it('generateUmaEvents composes invert + overrides', () => {
    const out = generateUmaEvents(skills, { removeByUma: { '101001': ['201902'] } });
    expect(out['101001']).toEqual(['201702']);
  });
});
