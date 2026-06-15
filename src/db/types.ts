/**
 * Storage-only types. Domain shapes live in '@/core/types' (frozen contract);
 * these are Dexie table rows with no meaning outside src/db.
 */

/**
 * Minimal Module 3 placeholder (plan §4 storage schema). Module 3 extends
 * this with a new db version — do not widen here without a version bump.
 */
export interface MatchLog {
  id?: number; // Dexie auto-increment
  cmPlanId: string;
  /** ISO date string of the observed match. */
  date: string;
  notes?: string;
}

/** Key-value row for the 'settings' table (primary key: `key`). */
export interface SettingRecord {
  key: string;
  value: unknown;
}

import type { CaptureBundle } from '@/core/spOptimizer';

/** A persisted M2 capture (the source-of-truth artifact; results are derived). */
export interface StoredCapture {
  id: string;
  label: string;
  bundle: CaptureBundle;
}
