import { describe, it, expect } from 'vitest';
import { classifyNews, cupOf } from './newsMatch';

describe('classifyNews', () => {
  it('returns "cm" for a Champions Meeting title', () => {
    expect(classifyNews('Champions Meeting "Cancer Cup" Info')).toBe('cm');
  });
  it('returns "cm" for a cup-only title', () => {
    expect(classifyNews('Taurus Cup registration open')).toBe('cm');
  });
  it('returns "banner" for a scout/gacha title', () => {
    expect(classifyNews('New Support Card Scout Now Available!')).toBe('banner');
  });
  it('returns "banner" for a new uma title', () => {
    expect(classifyNews('New Uma Character coming soon')).toBe('banner');
  });
  it('returns "patch" for a balance/update title', () => {
    expect(classifyNews('Balance Adjustment and Maintenance Notice')).toBe('patch');
  });
  it('returns "other" for an unrelated title', () => {
    expect(classifyNews('Additional Free Retries Event Coming Soon!')).toBe('other');
  });
});

describe('cupOf', () => {
  it('extracts the cup name from a title', () => {
    expect(cupOf('Champions Meeting "Cancer Cup" Finals')).toBe('cancer cup');
  });
  it('returns undefined when no cup name present', () => {
    expect(cupOf('Maintenance Notice')).toBeUndefined();
  });
  it('handles Taurus Cup', () => {
    expect(cupOf('Taurus Cup registration')).toBe('taurus cup');
  });
});
