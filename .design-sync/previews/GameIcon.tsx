// Preview stories for GameIcon — the bundled-icon resolver (skill / support /
// uma / UI). It renders a real <img> when the icon-manifest lists the id, else a
// neutral dashed placeholder box that preserves row rhythm + tap-target size.
// In design-sync fixture mode there is no icon manifest, so every cell shows the
// PLACEHOLDER (the honest fallback — see .design-sync/NOTES.md). The component is
// also the standard "icon augments a visible text label" primitive (P3).
import { GameIcon } from 'uma-cm-planner';

const row = { display: 'inline-flex', gap: 12, alignItems: 'center' } as const;

// Placeholder boxes at the sizes used across the app (20–64px).
export const Sizes = () => (
  <span style={row}>
    <GameIcon kind="skill" id="10011" size={20} alt="" />
    <GameIcon kind="skill" id="20011" size={28} alt="" />
    <GameIcon kind="uma" id="100201" size={44} alt="" />
    <GameIcon kind="support" id="30028" size={64} alt="" />
  </span>
);

// The real-world pattern: icon beside a visible label (alt="" — decorative).
export const BesideLabel = () => (
  <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
    <GameIcon kind="skill" id="20011" size={24} alt="" />
    <span>Corner Adept ○</span>
  </span>
);
