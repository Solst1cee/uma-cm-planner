/** "Star Tracks" spark filter (M1.4) — recreated from the design handoff
 *  (docs/handoff/design_handoff_spark_filter). Four category cards — STAT
 *  (blue) · APTITUDE (pink) · UNIQUE (green) · SKILL (white) — each with a
 *  header, 3 lineage-member pips, active factor rows (parent + total star
 *  meters), and add-controls: `+` chips for blue/pink, a skill search
 *  (keyboard-navigable) for the green (unique) + white (skill) cards.
 *
 *  Provider-free: the container passes the spark API + (optional) icons. */
import { useState, type ReactNode } from 'react';
import { LegacyMeter, TotalMeter, GreenTotalMeter, MEMBERS } from './SparkMeter';

export type SparkCat = 'blue' | 'pink' | 'green' | 'white';
export interface SparkVal { legacy: number; total: number }

/** Short factor labels (blue stats + pink aptitudes). Green/white names come from skillName. */
export const SPARK_NAMES: Record<string, string> = {
  spd: 'Speed', sta: 'Stamina', pow: 'Power', gut: 'Guts', wit: 'Wit',
  turf: 'Turf', dirt: 'Dirt', sprint: 'Sprint', mile: 'Mile', medium: 'Medium', long: 'Long',
  front: 'Front', pace: 'Pace', late: 'Late', end: 'End',
};
const NAMES = SPARK_NAMES;
interface CardDef { cat: SparkCat; title: string; keys: string[]; groups?: string[][] }
// Pink add-chips are laid out as the in-game three rows: surface · distance · style.
const PINK_GROUPS = [['turf', 'dirt'], ['sprint', 'mile', 'medium', 'long'], ['front', 'pace', 'late', 'end']];
const CARDS: CardDef[] = [
  { cat: 'blue', title: 'STAT', keys: ['spd', 'sta', 'pow', 'gut', 'wit'] },
  { cat: 'pink', title: 'APTITUDE', keys: PINK_GROUPS.flat(), groups: PINK_GROUPS },
  { cat: 'green', title: 'UNIQUE', keys: [] },
  { cat: 'white', title: 'SKILL', keys: [] },
];
/** Green (unique) + white (skill) are search-driven; blue/pink use `+` chips. */
const isSearchCat = (cat: SparkCat): cat is 'green' | 'white' => cat === 'green' || cat === 'white';

export interface SparkFilterCardsProps {
  value: (cat: SparkCat, key: string) => SparkVal;
  onSet: (cat: SparkCat, key: string, legacy: number, total: number) => void;
  maxTotal: (cat: SparkCat, key: string) => number;
  legacyLocked: (cat: SparkCat, key: string) => boolean;
  /** Lineage members used in a category (0–3) → pips + add cap. */
  membersUsed: (cat: SparkCat) => number;
  /** Active green (unique) sparks (skillId + name), in add order. */
  activeGreen: Array<{ key: string; name: string }>;
  /** Selectable unique skills for the green search (already excludes active). */
  greenOptions: Array<{ id: string; name: string }>;
  /** Optional green skill icon node (container-wired GameIcon); falls back to a placeholder. */
  greenIcon?: (skillId: string) => ReactNode;
  /** Active white (skill) sparks (skillId + name), in add order. */
  activeWhite: Array<{ key: string; name: string }>;
  /** Selectable white skills for the skill search (already excludes active). */
  whiteOptions: Array<{ id: string; name: string }>;
  /** Optional white skill icon node (container-wired GameIcon); falls back to a placeholder. */
  whiteIcon?: (skillId: string) => ReactNode;
}

/** Keyboard-navigable skill search for a search-driven card (green/white). Owns
 *  its own query/highlight so the two search cards don't share filter state. */
function SkillSearch({ cat, options, unique, onPick }: {
  cat: 'green' | 'white';
  options: Array<{ id: string; name: string }>;
  unique: boolean;
  onPick: (skillId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const q = query.trim().toLowerCase();
  const matches = q ? options.filter((o) => o.name.toLowerCase().includes(q)).slice(0, 8) : [];
  const hlIdx = Math.min(highlight, matches.length - 1);
  const pick = (o: { id: string; name: string }) => { onPick(o.id); setQuery(''); setHighlight(0); };
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setQuery(''); setHighlight(0); return; }
    if (matches.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((a) => Math.min(a + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const o = matches[hlIdx]; if (o) pick(o); }
  };
  const listId = `spc-${cat}-listbox`;
  return (
    <div className="spc-green-search">
      <input type="search" className="spc-green-input"
        placeholder={unique ? 'Search unique skill…' : 'Search skill…'}
        aria-label={unique ? 'Search unique skill' : 'Search skill'} role="combobox"
        aria-expanded={matches.length > 0} aria-controls={listId}
        aria-activedescendant={matches.length > 0 ? `spc-${cat}-opt-${hlIdx}` : undefined}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
        onKeyDown={onKeyDown} />
      {matches.length > 0 && (
        <div className="spc-green-results" role="listbox" id={listId}>
          {matches.map((o, i) => (
            <button key={o.id} id={`spc-${cat}-opt-${i}`} type="button" role="option"
              aria-selected={i === hlIdx} className={i === hlIdx ? 'is-active' : undefined}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => pick(o)}>{o.name}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SparkFilterCards(p: SparkFilterCardsProps) {
  const searchCfg = (cat: 'green' | 'white') =>
    cat === 'green'
      ? { options: p.greenOptions, active: p.activeGreen, icon: p.greenIcon, unique: true }
      : { options: p.whiteOptions, active: p.activeWhite, icon: p.whiteIcon, unique: false };

  const row = (cat: SparkCat, key: string, name: string, search: boolean, icon?: (id: string) => ReactNode) => {
    const v = p.value(cat, key);
    const cap = p.maxTotal(cat, key);
    const locked = p.legacyLocked(cat, key);
    const onLegacy = (target: number) => {
      const l = Math.max(0, Math.min(Math.min(3, cap), target));
      p.onSet(cat, key, l, Math.max(v.total, l));
    };
    const onTotal = (target: number) => {
      const t = Math.max(v.legacy, Math.min(cap, target));
      p.onSet(cat, key, v.legacy, t);
    };
    const remove = () => p.onSet(cat, key, 0, 0);
    if (search) {
      return (
        <div key={key} className="spc-row spc-row-green">
          <span className="spc-green-icon">{icon ? icon(key) : <span className="spc-green-ph" aria-hidden />}</span>
          <div className="spc-green-body">
            <div className="spc-green-head">
              <span className="spc-name spc-name-full">{name}</span>
              <button type="button" className="spc-x" aria-label={`Remove ${name}`} onClick={remove}>✕</button>
            </div>
            <div className="spc-green-meters">
              <span className="spc-meter"><span className="spc-lbl spc-lbl-parent">Parent</span>
                <LegacyMeter name={name} legacy={v.legacy} cap={cap} locked={locked} onSet={onLegacy} /></span>
              <span className="spc-meter"><span className="spc-lbl spc-lbl-total">Total</span>
                <GreenTotalMeter name={name} legacy={v.legacy} total={v.total} cap={cap} onSet={onTotal} /></span>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div key={key} className="spc-row">
        <span className="spc-name">{name}</span>
        <div className="spc-meters">
          <span className="spc-meter"><span className="spc-lbl spc-lbl-parent">Parent</span>
            <LegacyMeter name={name} legacy={v.legacy} cap={cap} locked={locked} onSet={onLegacy} /></span>
          <span className="spc-meter"><span className="spc-lbl spc-lbl-total">Total</span>
            <TotalMeter name={name} legacy={v.legacy} total={v.total} cap={cap} onSet={onTotal} /></span>
        </div>
        <button type="button" className="spc-x" aria-label={`Remove ${name}`} onClick={remove}>✕</button>
      </div>
    );
  };

  return (
    <div className="spc">
      {CARDS.map((card) => {
        const used = p.membersUsed(card.cat);
        const full = used >= MEMBERS;
        const cfg = isSearchCat(card.cat) ? searchCfg(card.cat) : null;
        const active = cfg
          ? cfg.active
          : card.keys.filter((k) => { const v = p.value(card.cat, k); return v.legacy > 0 || v.total > 0; }).map((k) => ({ key: k, name: NAMES[k] ?? k }));
        return (
          <section key={card.cat} className={`spc-card spark-${card.cat}`}>
            <header className="spc-head">
              <span className="spc-title">{card.title}</span>
              <span className="spc-pips" aria-hidden>
                {[0, 1, 2].map((i) => <span key={i} className={`spc-pip${i < used ? ' is-on' : ''}`} />)}
              </span>
            </header>
            <div className="spc-body">
              {active.length > 0 && (
                <div className="spc-rows">
                  {active.map((a) => row(card.cat, a.key, a.name ?? NAMES[a.key] ?? a.key, !!cfg, cfg?.icon))}
                </div>
              )}
              {cfg ? (
                !full && (
                  <SkillSearch cat={card.cat as 'green' | 'white'} options={cfg.options} unique={cfg.unique}
                    onPick={(id) => p.onSet(card.cat, id, 0, 1)} />
                )
              ) : (
                (() => {
                  const inactive = (k: string) => { const v = p.value(card.cat, k); return !(v.legacy > 0 || v.total > 0); };
                  const chip = (k: string) => (
                    <button key={k} type="button" className="spc-add-chip" disabled={full}
                      onClick={() => { if (!full) p.onSet(card.cat, k, 0, 1); }}>+ {NAMES[k] ?? k}</button>
                  );
                  // Pink: three in-game rows (surface · distance · style); others: one row.
                  return card.groups ? (
                    <div className="spc-add-groups">
                      {card.groups.map((grp, gi) => {
                        const chips = grp.filter(inactive);
                        return chips.length > 0 ? <div key={gi} className="spc-add">{chips.map(chip)}</div> : null;
                      })}
                    </div>
                  ) : (
                    <div className="spc-add">{card.keys.filter(inactive).map(chip)}</div>
                  );
                })()
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
