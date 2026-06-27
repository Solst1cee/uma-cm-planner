/** Full-lineage spark chips for a roster veteran: the veteran (own) + its two
 *  grandparents. Blue / pink / green (unique) sit in one row, white skills
 *  below. Star colour marks the SOURCE — gold for the veteran's own (legacy)
 *  sparks, grey for grandparent sparks — uniformly across every spark type.
 *  Provider-free: `skillName` resolves white/green skill ids → names. Shared by
 *  the selected-parent card and the picker tiles. */
import { aptitudeLabel, STAT_LABEL, starsGlyph } from '@/features/parents/sparkMeta';
import type { Parent, ParentRef } from '@/core/types';

function star(n: 1 | 2 | 3, gp: boolean) {
  return <span className={gp ? 'inh-star-gp' : 'inh-star-own'}>{starsGlyph(n)}</span>;
}

export function LineageSparkChips({
  parent,
  skillName,
}: {
  parent: Parent;
  skillName?: (id: string) => string;
}) {
  const members: Array<{ src: Parent | ParentRef; gp: boolean }> = [
    { src: parent, gp: false },
    ...(parent.grandparents ?? []).filter((g): g is ParentRef => !!g).map((g) => ({ src: g, gp: true })),
  ];
  const name = (id: string) => (skillName ? skillName(id) : id);
  const blues = members.filter((m) => m.src.blueSpark);
  const pinks = members.filter((m) => m.src.pinkSpark);
  const greens = members.filter((m) => m.src.greenSpark);
  const whites = members.flatMap((m) => (m.src.whiteSparks ?? []).map((w) => ({ w, gp: m.gp })));

  // One row per spark type (blue, pink, green, white). Spans (not divs) so this
  // is valid inside both the card body and the tile <button>; `.spark-chips`'s
  // `display:flex` still makes each a block-level row.
  return (
    <>
      {blues.length > 0 && (
        <span className="spark-chips">
          {blues.map((m, i) => (
            <span key={`b${i}`} className="badge spark-blue">
              {STAT_LABEL[m.src.blueSpark!.stat]} {star(m.src.blueSpark!.stars, m.gp)}
            </span>
          ))}
        </span>
      )}
      {pinks.length > 0 && (
        <span className="spark-chips">
          {pinks.map((m, i) => (
            <span key={`p${i}`} className="badge spark-pink">
              {aptitudeLabel(m.src.pinkSpark!.aptitude)} {star(m.src.pinkSpark!.stars, m.gp)}
            </span>
          ))}
        </span>
      )}
      {greens.length > 0 && (
        <span className="spark-chips">
          {greens.map((m, i) => (
            <span key={`g${i}`} className="badge spark-green inh-white-chip" title="Inherited unique spark">
              <span className="inh-white-chip-name">{name(m.src.greenSpark!.skillId)}</span>
              {star(m.src.greenSpark!.stars, m.gp)}
            </span>
          ))}
        </span>
      )}
      {whites.length > 0 && (
        <span className="spark-chips inh-white-chips">
          {whites.map(({ w, gp }, i) => (
            <span key={`w${i}`} className="badge spark-white inh-white-chip">
              <span className="inh-white-chip-name">{name(w.skillId)}</span>
              {star(w.stars, gp)}
            </span>
          ))}
        </span>
      )}
    </>
  );
}
