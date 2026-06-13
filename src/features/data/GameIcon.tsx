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
import { cardIconPath, skillIconPath, umaIconPath } from '@/core/icons';
import { BASE_URL, useGameData } from '@/features/data/gameData';

export type GameIconKind = 'skill' | 'card' | 'uma';

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
  }
}

export function GameIcon({
  kind,
  id,
  size = 22,
  alt,
  className,
}: {
  kind: GameIconKind;
  /** SkillRecord.iconId for kind="skill"; cardId / umaId otherwise. */
  id: string;
  /** Rendered box edge in px (square). Defaults to 22 (matrix skill icon). */
  size?: number;
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

  const boxStyle = { width: size, height: size } as const;

  if (relative === undefined || broken) {
    // Neutral placeholder: keeps row rhythm + tap-target size without a broken
    // image. aria-hidden because the adjacent text label already names it.
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
      width={size}
      height={size}
      style={boxStyle}
      loading="lazy"
      decoding="async"
      alt={alt}
      onError={() => setBroken(true)}
    />
  );
}
