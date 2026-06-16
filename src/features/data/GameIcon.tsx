/**
 * Reusable bundled-icon renderer (plan §4 "Image assets"). Resolves a
 * skill/card/uma id to its WebP via the PURE core resolver + the runtime
 * icon manifest, and renders a fixed-size, lazy <img>. Images AUGMENT the
 * text UI — they never replace labels, so degradation is graceful:
 *
 *   - id absent from the manifest (or manifest not loaded) → neutral
 *     placeholder box, no network request, no broken-image glyph
 *   - load failure at runtime (onError) → swap to the same placeholder
 *
 * The alt text is the caller-supplied accessible name; when an image is shown
 * purely decoratively beside an existing visible label, pass alt="" so screen
 * readers don't double-read the name.
 */
import { useEffect, useState } from 'react';
import { cardIconPath, skillIconPath, uiIconPath, umaIconPath } from '@/core/icons';
import { BASE_URL, useGameData } from '@/features/data/gameData';

export type GameIconKind = 'skill' | 'card' | 'uma' | 'ui';

function relativePathFor(
  kind: GameIconKind,
  id: string,
  manifest: NonNullable<ReturnType<typeof useGameData>['iconManifest']>,
): string | undefined {
  switch (kind) {
    case 'skill':
      return skillIconPath(id, manifest);
    case 'card':
      return cardIconPath(id, manifest);
    case 'uma':
      return umaIconPath(id, manifest);
    case 'ui':
      return uiIconPath(id, manifest);
  }
}

export function GameIcon({
  kind,
  id,
  size = 22,
  width,
  height,
  alt,
  className,
}: {
  kind: GameIconKind;
  /** SkillRecord.iconId for kind="skill"; cardId / umaId / UI id otherwise. */
  id: string;
  /** Rendered box edge in px (square). Defaults to 22 (matrix skill icon). */
  size?: number;
  /** Optional non-square rendered width in px, used for in-game UI pills. */
  width?: number;
  /** Optional non-square rendered height in px, used for in-game UI pills. */
  height?: number;
  /** Accessible name; pass "" for decorative use beside a visible label. */
  alt: string;
  className?: string;
}) {
  const { iconManifest } = useGameData();
  // Reset the broken flag whenever the resolved target changes, so reusing a
  // GameIcon for a new id doesn't stick on a previous load failure.
  const [broken, setBroken] = useState(false);
  const relative = iconManifest ? relativePathFor(kind, id, iconManifest) : undefined;
  useEffect(() => {
    setBroken(false);
  }, [relative]);

  const boxWidth = width ?? size;
  const boxHeight = height ?? size;
  const boxStyle = { width: boxWidth, height: boxHeight } as const;

  if (relative === undefined || broken) {
    // Neutral placeholder: keeps row rhythm + tap-target size without a broken
    // image. aria-hidden by design — every GameIcon augments an adjacent visible
    // text label (the P3 "images augment, never replace" contract), so a missing
    // icon never drops the only accessible name. Callers pass alt="" accordingly.
    return (
      <span
        className={`game-icon game-icon-ph ${className ?? ''}`.trim()}
        style={boxStyle}
        aria-hidden="true"
        data-kind={kind}
      />
    );
  }

  return (
    <img
      className={`game-icon ${className ?? ''}`.trim()}
      src={`${BASE_URL}${relative}`}
      width={boxWidth}
      height={boxHeight}
      style={boxStyle}
      loading="lazy"
      decoding="async"
      alt={alt}
      onError={() => setBroken(true)}
    />
  );
}
