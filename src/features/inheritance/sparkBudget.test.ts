import { describe, expect, it } from 'vitest';
import { maxTotalForKey, membersForTotal, MAX_TOTAL } from './sparkBudget';

describe('membersForTotal', () => {
  it('needs ceil(total/3) members', () => {
    expect(membersForTotal(0)).toBe(0);
    expect(membersForTotal(3)).toBe(1);
    expect(membersForTotal(4)).toBe(2); // 3+1 or 2+2
    expect(membersForTotal(6)).toBe(2);
    expect(membersForTotal(9)).toBe(3);
  });
});

describe('maxTotalForKey', () => {
  it('a fresh category allows the full 9★ on one type', () => {
    expect(maxTotalForKey({}, 'spd')).toBe(MAX_TOTAL);
    expect(maxTotalForKey({ spd: 0 }, 'spd')).toBe(9);
  });

  it('one type at 3★ (1 member) leaves 6★ for another', () => {
    expect(maxTotalForKey({ pow: 3 }, 'sta')).toBe(6);
  });

  it('one type at 4★ (2 members) leaves only 3★ for another — so no 4+4', () => {
    expect(maxTotalForKey({ pow: 4 }, 'sta')).toBe(3);
  });

  it('two types each at 3★ (2 members) leave 3★ for a third', () => {
    expect(maxTotalForKey({ pow: 3, sta: 3 }, 'gut')).toBe(3);
  });

  it('budget exhausted → 0 for a new type', () => {
    expect(maxTotalForKey({ pow: 9 }, 'sta')).toBe(0);
    expect(maxTotalForKey({ pow: 3, sta: 3, gut: 3 }, 'wit')).toBe(0);
  });

  it('ignores the key being measured (its own usage doesn’t shrink its cap)', () => {
    expect(maxTotalForKey({ pow: 6 }, 'pow')).toBe(9);
  });
});
