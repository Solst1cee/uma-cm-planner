/** Sanitize a raw stat-field draft: digits only, leading zeros stripped (a single
 *  '0' and the empty string survive so the field can be cleared mid-edit). */
export function sanitizeStatDraft(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits === '') return '';
  const stripped = digits.replace(/^0+/, '');
  return stripped === '' ? '0' : stripped;
}

/** The committed numeric value for a draft ('' → 0). */
export function statValueFromDraft(raw: string): number {
  return Number(sanitizeStatDraft(raw) || '0');
}
