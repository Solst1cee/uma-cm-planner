import type { UmaTiersCard, UmaTiersWeights, UmaTiersScoredRow } from './index';
export function processCards(
  cards: UmaTiersCard[],
  weights: UmaTiersWeights,
  selectedCards: UmaTiersCard[],
): UmaTiersScoredRow[];
