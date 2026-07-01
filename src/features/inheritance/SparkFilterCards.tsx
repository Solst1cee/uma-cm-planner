/** "Star Tracks" spark filter (M1.4) — recreated from the design handoff
 *  (docs/handoff/design_handoff_spark_filter). Three category cards — STAT
 *  (blue) · APTITUDE (pink) · UNIQUE (green) — each with a gradient header, 3
 *  lineage-member pips, active factor rows (parent + total star meters), and
 *  add-controls (+ chips for blue/pink, a unique-skill search for green).
 *
 *  Provider-free: the container passes the spark API + (optional) green icon. */
import { useState, type ReactNode } from 'react';
import { LegacyMeter, TotalMeter, GreenTotalMeter, MEMBERS } from './SparkMeter';

export type SparkCat = 'blue' | 'pink' | 'green';
export interface SparkVal { legacy: number; total: number }

/** Short factor labels (blue stats + pink aptitudes). Green names come from skillName. */
export const SPARK_NAMES: Record<string, string> = {
  spd: 'Speed', sta: 'Stamina', pow: 'Power', gut: 'Guts', wit: 'Wit',
  turf: 'Turf', dirt: 'Dirt', sprint: 'Sprint', mile: 'Mile', medium: 'Medium', long: 'Long',
  front: 'Front', pace: 'Pace', late: 'Late', end: 'End',
};
const NAMES = SPARK_NAMES;
interface CardDef { cat: SparkCat; title: string; keys: string[] }
const CARDS: CardDef[] = [
  { cat: 'blue', title: 'STAT', keys: ['spd', 'sta', 'pow', 'gut', 'wit'] },
  { cat: 'pink', title: 'APTITUDE', keys: ['turf', 'dirt', 'sprint', 'mile', 'medium', 'long', 'front', 'pace', 'late', 'end'] },
  { cat: 'green', title: 'UNIQUE', keys: [] },
];

export interface SparkFilterCardsProps {
  value: (cat: SparkCat, key: string) => SparkVal;
  onSet: (cat: SparkCat, key: string, legacy: number, total: number) => void;
  maxTotal: (cat: SparkCat, key: string) => number;
  legacyLocked: (cat: SparkCat, key: string) => boolean;
  /** Lineage members used in a category (0–3) → pips + add cap. */
  membersUsed: (cat: SparkCat) => number;
  /** Active green sparks (skillId + name), in add order. */
  activeGreen: Array<{ key: string; name: string }>;
  /** Selectable unique skills for the green search (already excludes active). */
  greenOptions: Array<{ id: string; name: string }>;
  /** Optional green skill icon node (container-wired GameIcon); falls back to a placeholder. */
  greenIcon?: (skillId: string) => ReactNode;
}

export function SparkFilterCards(p: SparkFilterCardsProps) {
  const [query, setQuery] = useState('');

  const row = (cat: SparkCat, key: string, name: string, green: boolean) => {
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
    if (green) {
      return (
        <div key={key} className="spc-row spc-row-green">
          <span className="spc-green-icon">{p.greenIcon ? p.greenIcon(key) : <span className="spc-green-ph" aria-hidden />}</span>
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
        const active = card.cat === 'green'
          ? p.activeGreen
          : card.keys.filter((k) => { const v = p.value(card.cat, k); return v.legacy > 0 || v.total > 0; }).map((k) => ({ key: k, name: NAMES[k] ?? k }));
        const q = query.trim().toLowerCase();
        const greenMatches = card.cat === 'green' && q
          ? p.greenOptions.filter((o) => o.name.toLowerCase().includes(q)).slice(0, 8)
          : [];
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
                  {active.map((a) => row(card.cat, a.key, a.name ?? NAMES[a.key] ?? a.key, card.cat === 'green'))}
                </div>
              )}
              {card.cat === 'green' ? (
                !full && (
                  <div className="spc-green-search">
                    <input type="search" className="spc-green-input" placeholder="Search unique skill…"
                      aria-label="Search unique skill" value={query} onChange={(e) => setQuery(e.target.value)} />
                    {greenMatches.length > 0 && (
                      <div className="spc-green-results" role="listbox">
                        {greenMatches.map((o) => (
                          <button key={o.id} type="button" role="option" aria-selected={false}
                            onClick={() => { p.onSet('green', o.id, 0, 1); setQuery(''); }}>{o.name}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              ) : (
                <div className="spc-add">
                  {card.keys.filter((k) => { const v = p.value(card.cat, k); return !(v.legacy > 0 || v.total > 0); }).map((k) => (
                    <button key={k} type="button" className="spc-add-chip" disabled={full}
                      onClick={() => { if (!full) p.onSet(card.cat, k, 0, 1); }}>+ {NAMES[k] ?? k}</button>
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
