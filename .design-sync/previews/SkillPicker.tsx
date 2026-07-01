// Preview story for SkillPicker — searchable skill picker (filters Global-server
// skills by EN name, shows SP cost + rarity). The results list is gated behind a
// typed query (internal state), so the static preview shows the idle search
// field; the rarity-plated result rows appear once a query is entered. See
// .design-sync/NOTES.md "interaction-gated previews". Skills come from
// useGameData() (fixture data via the provider).
import { SkillPicker } from 'uma-cm-planner';

const noop = () => {};

export const Idle = () => <SkillPicker addedSkillIds={new Set()} onPick={noop} />;
