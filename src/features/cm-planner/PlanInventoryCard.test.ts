import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { FIXTURE_PLAN } from '@/core/fixtures';
import { createPlansZip } from './PlanInventoryCard';

describe('createPlansZip', () => {
  it('stores every saved plan as a separate readable JSON file', () => {
    const plans = [
      { ...FIXTURE_PLAN, id: 'one', name: 'CM15 / Kitasan' },
      { ...FIXTURE_PLAN, id: 'two', name: 'Rainy: Trial?' },
    ];

    const files = unzipSync(createPlansZip(plans));
    const names = Object.keys(files).sort();

    expect(names).toEqual(['01-CM15 - Kitasan.json', '02-Rainy- Trial-.json']);
    expect(JSON.parse(strFromU8(files[names[0]!]!))).toMatchObject({ id: 'one', name: 'CM15 / Kitasan' });
    expect(JSON.parse(strFromU8(files[names[1]!]!))).toMatchObject({ id: 'two', name: 'Rainy: Trial?' });
  });
});
