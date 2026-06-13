/**
 * useChosenParents freshness contract (FINDING 3): parent edits on /parents go
 * through saveParent (Dexie) and never produce a new plan object, so the hook
 * must re-query the store on its own to show fresh sparks. It re-resolves on
 * mount, when the chosen ids change, and when the document becomes visible
 * again (returning from /parents). '@/db' is mocked.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { CmPlan, Parent } from '@/core/types';
import { FIXTURE_PLAN } from '@/core/fixtures';
import { listParents } from '@/db';
import { useChosenParents } from '@/features/coverage/useChosenParents';

vi.mock('@/db', () => ({
  listParents: vi.fn(async (): Promise<Parent[]> => []),
}));

function parent(id: string, whiteSparkStars: 1 | 2 | 3): Parent {
  return {
    id,
    umaId: '100201',
    blueSpark: { stat: 'spd', stars: 3 },
    pinkSpark: { aptitude: 'turf', stars: 3 },
    whiteSparks: [{ skillId: '200332', stars: whiteSparkStars }],
    source: 'mine',
  };
}

const PLAN: CmPlan = { ...FIXTURE_PLAN, chosenParents: ['p1', undefined] };

afterEach(() => {
  cleanup();
  vi.mocked(listParents).mockReset();
});

describe('useChosenParents', () => {
  it('resolves the chosen parent ids against the store on mount', async () => {
    vi.mocked(listParents).mockResolvedValue([parent('p1', 1)]);
    const { result } = renderHook(() => useChosenParents(PLAN));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.parents).toHaveLength(1);
    expect(result.current.parents[0]?.whiteSparks[0]?.stars).toBe(1);
  });

  it('FINDING 3: re-resolves on visibilitychange so an edited parent shows fresh sparks', async () => {
    // First read: parent has a 1-star white spark. After an off-screen edit on
    // /parents, the store now holds a 3-star spark — returning to the planner
    // fires visibilitychange and the hook must pick up the new value WITHOUT a
    // new plan object (the plan never changed).
    vi.mocked(listParents)
      .mockResolvedValueOnce([parent('p1', 1)])
      .mockResolvedValueOnce([parent('p1', 3)]);

    const { result } = renderHook(() => useChosenParents(PLAN));
    await waitFor(() => expect(result.current.parents[0]?.whiteSparks[0]?.stars).toBe(1));
    expect(vi.mocked(listParents)).toHaveBeenCalledTimes(1);

    // Simulate returning to the tab/route.
    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() => expect(result.current.parents[0]?.whiteSparks[0]?.stars).toBe(3));
    expect(vi.mocked(listParents)).toHaveBeenCalledTimes(2);
  });
});
