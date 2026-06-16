/**
 * design-sync bundle entry (claude.ai/design import).
 *
 * Re-exports ONLY the curated presentational components plus the
 * `GameDataProvider` wrapper (the preview provider — see cfg.provider). The app
 * has no library entry of its own, so this file is the synthetic entry passed to
 * the converter via `cfg.entry`. Keeping it explicit (vs. the converter's
 * "export * from every src file" fallback) keeps the shared bundle small and
 * engine-free.
 *
 * Engine-coupled components are intentionally EXCLUDED — RaceSetup, RaceTrackView
 * and SkillDetailDisclosure transitively pull the 5.2 MB umalator bundle via lazy
 * `import('@/sim/...')`, which esbuild inlines under iife. See .design-sync/NOTES.md.
 *
 * The CSS imports below are bundled by esbuild into `_ds_bundle.css` (the app's
 * tokens live in app.css `:root`); the converter's styles.css @imports it so the
 * design agent gets the real token + component styling.
 */
import '@/styles/app.css';
import '@/features/meta-intel/meta-intel.css';
import '@/features/sp-optimizer/sp-optimizer.css';
import '@/features/skill-acq/skill-acq.css';
import '@/features/cm-planner/cm-planner.css';
import '@/features/parents/parents.css';

// Preview provider (wraps every card so useGameData() resolves to fixture data).
export { GameDataProvider } from '@/features/data/gameData';

// Curated components.
export { GameIcon } from '@/features/data/GameIcon';
export { TimelineEntryCard } from '@/features/meta-intel/TimelineEntryCard';
export { TimelineDetailPanel } from '@/features/meta-intel/TimelineDetailPanel';
export { SearchPicker } from '@/features/parents/SearchPicker';
export { BuildCards } from '@/features/sp-optimizer/BuildCards';
export { SkillPicker } from '@/features/skill-planner/SkillPicker';
export { PlanHeaderPanel } from '@/features/skill-planner/PlanHeaderPanel';
