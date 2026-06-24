import { describe, expect, it } from 'vitest';
import { sanitizeStatDraft, statValueFromDraft } from './statInput';

describe('sanitizeStatDraft', () => {
  it('keeps a normal number unchanged', () => {
    expect(sanitizeStatDraft('1200')).toBe('1200');
  });
  it('allows an empty string mid-edit', () => {
    expect(sanitizeStatDraft('')).toBe('');
  });
  it('strips leading zeros but keeps a single zero', () => {
    expect(sanitizeStatDraft('01200')).toBe('1200');
    expect(sanitizeStatDraft('0')).toBe('0');
    expect(sanitizeStatDraft('0000')).toBe('0');
    expect(sanitizeStatDraft('0850')).toBe('850');
  });
  it('drops non-digit characters', () => {
    expect(sanitizeStatDraft('12a3')).toBe('123');
    expect(sanitizeStatDraft('-5')).toBe('5');
    expect(sanitizeStatDraft('1.2')).toBe('12');
  });
});

describe('statValueFromDraft', () => {
  it('treats empty as 0', () => {
    expect(statValueFromDraft('')).toBe(0);
  });
  it('parses the sanitized digits', () => {
    expect(statValueFromDraft('01200')).toBe(1200);
    expect(statValueFromDraft('0')).toBe(0);
  });
});
