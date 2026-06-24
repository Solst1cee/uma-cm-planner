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

/** Human-readable positioning requirement parsed from one alternative's tokens. */
function describeOneAlternative(alt: string): string | null {
  const parts = alt.split('&').map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    let m: RegExpMatchArray | null;
    if ((m = p.match(/^order_rate(<=|>=|==|<|>)(\d+)/))) {
      out.push(`${opWord(m[1]!)}${m[2]}% back`);
    } else if ((m = p.match(/^order(<=|>=|==|<|>)(\d+)/))) {
      out.push(`pos ${sym(m[1]!)}${m[2]}`);
    } else if ((m = p.match(/^bashin_diff_infront(<=|>=|==|<|>)(\d+)/))) {
      out.push(`within ${m[2]} ahead`);
    } else if ((m = p.match(/^bashin_diff_behind(<=|>=|==|<|>)(\d+)/))) {
      out.push(`within ${m[2]} behind`);
    }
  }
  return out.length ? out.join(', ') : null;
}

function opWord(op: string): string {
  // order_rate<=40 means "no more than 40% back" → "≤40% back"
  return op === '<=' || op === '<' ? '≤' : op === '>=' || op === '>' ? '≥' : '=';
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
