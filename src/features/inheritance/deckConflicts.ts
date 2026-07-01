// src/features/inheritance/deckConflicts.ts
/** M1.6 — deck vs. trainee conflict rules.
 *
 *  In-game you can't train with a support card of your OWN character (no rainbow
 *  value), and a deck can't hold two support cards of the same character. We don't
 *  hard-block a template that already contains such a card — it loads and the slot
 *  is shown greyed — but the picker refuses to ADD a conflicting card.
 *
 *  Matching is by character name: every uma's `nameEn` equals the support card
 *  `charName` for that character (verified across the full Global roster). */

/** True when the card is the trainee's own character. */
export function isTraineeConflict(
  cardCharName: string,
  traineeCharName: string | null | undefined,
): boolean {
  return !!traineeCharName && cardCharName === traineeCharName;
}

/** Slot indices holding the 2nd+ copy of a character already present earlier in the
 *  deck (the duplicates to grey). `charNames` is parallel to the deck slots; empty
 *  slots pass `null`/`undefined`. */
export function duplicateCharSlots(
  charNames: Array<string | null | undefined>,
): Set<number> {
  const seen = new Set<string>();
  const dupes = new Set<number>();
  charNames.forEach((c, i) => {
    if (!c) return;
    if (seen.has(c)) dupes.add(i);
    else seen.add(c);
  });
  return dupes;
}

/** Can a candidate card be added to the deck via the picker?
 *  No if it's already in the deck, is the trainee's character, or a sibling card of
 *  a character already in the deck. */
export function canAddCard(opts: {
  cardCharName: string;
  traineeCharName: string | null | undefined;
  /** Character names currently occupying the deck. */
  deckCharNames: Set<string>;
  inDeck: boolean;
}): boolean {
  const { cardCharName, traineeCharName, deckCharNames, inDeck } = opts;
  if (inDeck) return false;
  if (isTraineeConflict(cardCharName, traineeCharName)) return false;
  if (deckCharNames.has(cardCharName)) return false;
  return true;
}
