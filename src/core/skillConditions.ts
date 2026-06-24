/** Pure helpers for reading a skill's raw activation-condition DSL (engine format,
 *  e.g. "order_rate<=40&phase>=2@order>=3"). `&` = AND within an alternative,
 *  `@` = OR between alternatives. */

/** Tokens that mark a wisdom-gated (random) activation — a "wit check". */
const WIT_RANDOM = /(?:all_corner_random|corner_random|straight_random|phase_random|random_lot|is_lastspurt_random)/;

export function requiresWitCheck(conditions: string): boolean {
  return WIT_RANDOM.test(conditions);
}

/** Engine wit-check pass probability (percent, integer), runner.ts:1523:
 *  threshold = max(100 - 9000/wit, 20). */
export function witCheckPassChance(wit: number): number {
  if (wit <= 0) return 20;
  return Math.round(Math.max(100 - 9000 / wit, 20));
}

// Field sizes per race mode (upstream umalator constants — order_rate is a % of the field).
// place = round((order_rate / 100) × fieldSize). E.g. order_rate>50 → CM round(4.5)=5, LoH round(6)=6.
const FIELD_CM = 9;
const FIELD_LOH = 12;

/** Human-readable positioning requirement parsed from one alternative's tokens. */
function describeOneAlternative(alt: string): string | null {
  const parts = alt.split('&').map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    let m: RegExpMatchArray | null;
    if ((m = p.match(/^order_rate(<=|>=|==|<|>)(\d+)/))) {
      // order_rate is a percentile of the field — show the exact place for CM (9) and LoH (12).
      const op = sym(m[1]!);
      const rate = Number(m[2]);
      const cm = Math.round((rate / 100) * FIELD_CM);
      const loh = Math.round((rate / 100) * FIELD_LOH);
      out.push(`CM ${op}${cm} · LoH ${op}${loh}`);
    } else if ((m = p.match(/^order(<=|>=|==|<|>)(\d+)/))) {
      out.push(`place ${sym(m[1]!)}${m[2]}`);
    } else if ((m = p.match(/^bashin_diff_infront(<=|>=|==|<|>)(\d+)/))) {
      out.push(`within ${m[2]} ahead`);
    } else if ((m = p.match(/^bashin_diff_behind(<=|>=|==|<|>)(\d+)/))) {
      out.push(`within ${m[2]} behind`);
    }
  }
  return out.length ? out.join(', ') : null;
}

function sym(op: string): string {
  return op === '<=' ? '≤' : op === '>=' ? '≥' : op === '<' ? '<' : op === '>' ? '>' : '=';
}

export function describePositioning(conditions: string): string {
  if (!conditions.trim()) return '—';
  const alts = conditions.split('@').map((a) => a.trim()).filter(Boolean);
  const described = alts.map(describeOneAlternative).filter((x): x is string => x !== null);
  if (described.length === 0) return '—';
  return [...new Set(described)].join(' / ');
}
