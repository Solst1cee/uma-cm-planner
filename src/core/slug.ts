/**
 * Lowercase kebab-case slug — the single source of truth for deterministic
 * timeline entry ids (used by build-time preset ids + synthesized CM ids).
 * Keep it here so both producers normalize identically across builds.
 */
export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
