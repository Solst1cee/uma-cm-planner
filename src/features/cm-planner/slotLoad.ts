/** Loading `id` into `slot` collides when that exact plan is currently loaded in the
 *  OTHER slot — the planner then duplicates it so the two slots never share an id. */
export function shouldDuplicateForSlot(
  id: string,
  slot: 'uma1' | 'uma2',
  uma1Id: string | undefined,
  uma2Id: string | undefined,
): boolean {
  return slot === 'uma1' ? id === uma2Id : id === uma1Id;
}
