// Normalize the GLOBAL succession_relation extracts into affinity groups for src/core/affinity.ts.
// relation.json:        [{ relation_type, relation_point }]   (943 rows; relation_point is 2)
// relation_member.json: [{ id, relation_type, chara_id }]     (2562 rows; chara_id 1001..1074)
import type { AffinityGroup } from '@/core/types';

interface RelationRow { relation_type: number; relation_point: number }
interface RelationMemberRow { id: number; relation_type: number; chara_id: number }

export function buildAffinity(inputs: {
  relation: RelationRow[];
  relationMember: RelationMemberRow[];
  dataVersion: string;
}): { server: 'global'; dataVersion: string; groups: AffinityGroup[] } {
  const pointByType = new Map<number, number>(inputs.relation.map((r) => [r.relation_type, r.relation_point]));
  const membersByType = new Map<number, number[]>();
  for (const m of inputs.relationMember) {
    const arr = membersByType.get(m.relation_type) ?? [];
    arr.push(m.chara_id);
    membersByType.set(m.relation_type, arr);
  }
  const groups: AffinityGroup[] = [...membersByType.entries()]
    .map(([relationType, members]) => ({
      relationType,
      point: pointByType.get(relationType) ?? 0,
      members: [...new Set(members)].sort((a, b) => a - b),
    }))
    .filter((g) => g.point > 0 && g.members.length >= 2)
    .sort((a, b) => a.relationType - b.relationType);
  return { server: 'global', dataVersion: inputs.dataVersion, groups };
}
