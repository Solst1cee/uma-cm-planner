/**
 * Add/edit form for a Parent record (plan §6 step 4 / §7 manual entry —
 * UmaExtractor import is the later friction-killer; this is the fallback
 * path). Persistence is the caller's job; the form only assembles a
 * ParentDraft and validates the required picks.
 */
import { useMemo, useState, type FormEvent } from 'react';
import type { Parent, ParentRef, SkillRecord, Stat } from '@/core/types';
import type { ParentDraft } from '@/db';
import { useGameData } from '@/features/data/gameData';
import { GameIcon } from '@/features/data/GameIcon';
import { SearchPicker, type SearchItem } from './SearchPicker';
import { useUmas, umaName } from './useUmas';
import {
  APTITUDE_OPTIONS,
  STARS,
  STAT_OPTIONS,
  starsGlyph,
  type Stars,
} from './sparkMeta';

// --- Small shared inputs -----------------------------------------------------

function StarsSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Stars;
  onChange: (v: Stars) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value) as Stars)}>
        {STARS.map((n) => (
          <option key={n} value={n}>
            {starsGlyph(n)} ({n})
          </option>
        ))}
      </select>
    </label>
  );
}

interface SparkDraft {
  skillId: string;
  stars: Stars;
}

/** White-spark rows: per-spark stars + remove. The spark is named after the skill. */
function SparkRows({
  sparks,
  onChange,
  skillName,
  ariaPrefix = '',
}: {
  sparks: SparkDraft[];
  onChange: (next: SparkDraft[]) => void;
  skillName: (id: string) => string;
  /** Disambiguates accessible names across parent/grandparent sections. */
  ariaPrefix?: string;
}) {
  if (sparks.length === 0) return null;
  return (
    <ul className="spark-list" aria-label={`${ariaPrefix}white sparks`.trim()}>
      {sparks.map((sp) => {
        const name = skillName(sp.skillId);
        return (
          <li key={sp.skillId} className="spark-row">
            <span className="target-name">{name}</span>
            <select
              aria-label={`Stars for ${ariaPrefix}${name}`}
              value={sp.stars}
              onChange={(e) =>
                onChange(
                  sparks.map((s) =>
                    s.skillId === sp.skillId
                      ? { ...s, stars: Number(e.target.value) as Stars }
                      : s,
                  ),
                )
              }
            >
              {STARS.map((n) => (
                <option key={n} value={n}>
                  {starsGlyph(n)} ({n})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Remove ${ariaPrefix}${name}`}
              onClick={() => onChange(sparks.filter((s) => s.skillId !== sp.skillId))}
            >
              ✕
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// --- Grandparent sub-form -----------------------------------------------------

interface GrandparentDraft {
  umaId: string | null;
  /** '' = no blue spark recorded. */
  blueStat: Stat | '';
  blueStars: Stars;
  /** '' = no pink spark recorded. */
  pinkAptitude: string;
  pinkStars: Stars;
  whiteSparks: SparkDraft[];
}

function emptyGrandparent(): GrandparentDraft {
  return {
    umaId: null,
    blueStat: '',
    blueStars: 3,
    pinkAptitude: '',
    pinkStars: 3,
    whiteSparks: [],
  };
}

function grandparentFromRef(ref: ParentRef | undefined): GrandparentDraft {
  if (!ref) return emptyGrandparent();
  return {
    umaId: ref.umaId,
    blueStat: ref.blueSpark?.stat ?? '',
    blueStars: ref.blueSpark?.stars ?? 3,
    pinkAptitude: ref.pinkSpark?.aptitude ?? '',
    pinkStars: ref.pinkSpark?.stars ?? 3,
    whiteSparks: ref.whiteSparks?.map((s) => ({ ...s })) ?? [],
  };
}

function grandparentToRef(gp: GrandparentDraft): ParentRef | undefined {
  if (gp.umaId === null) return undefined;
  return {
    umaId: gp.umaId,
    blueSpark: gp.blueStat === '' ? undefined : { stat: gp.blueStat, stars: gp.blueStars },
    pinkSpark:
      gp.pinkAptitude === ''
        ? undefined
        : { aptitude: gp.pinkAptitude, stars: gp.pinkStars },
    whiteSparks: gp.whiteSparks.length > 0 ? gp.whiteSparks : undefined,
  };
}

function GrandparentFieldset({
  index,
  value,
  onChange,
  umaItems,
  whiteItems,
  skillName,
}: {
  index: 1 | 2;
  value: GrandparentDraft;
  onChange: (next: GrandparentDraft) => void;
  umaItems: SearchItem[];
  whiteItems: SearchItem[];
  skillName: (id: string) => string;
}) {
  const { umaById } = useUmas();
  const prefix = `grandparent ${index} `;
  return (
    <details className="gp-block" open={value.umaId !== null}>
      <summary>
        Grandparent {index}{' '}
        {value.umaId !== null ? (
          <strong>{umaName(umaById, value.umaId)}</strong>
        ) : (
          <span className="muted">(optional)</span>
        )}
      </summary>

      {value.umaId === null ? (
        <SearchPicker
          label={`Grandparent ${index} uma`}
          placeholder="Search umas by name or epithet…"
          items={umaItems}
          onPick={(umaId) => onChange({ ...value, umaId })}
        />
      ) : (
        <div className="selected-row">
          <GameIcon kind="uma" id={value.umaId} size={32} alt="" />
          <span className="owned-name">{umaName(umaById, value.umaId)}</span>
          <button type="button" onClick={() => onChange(emptyGrandparent())}>
            Clear grandparent {index}
          </button>
        </div>
      )}

      {value.umaId !== null && (
        <>
          <div className="spark-grid">
            <label className="field">
              <span>Grandparent {index} blue stat</span>
              <select
                value={value.blueStat}
                onChange={(e) => onChange({ ...value, blueStat: e.target.value as Stat | '' })}
              >
                <option value="">— none —</option>
                {STAT_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {value.blueStat !== '' && (
              <StarsSelect
                label={`Grandparent ${index} blue stars`}
                value={value.blueStars}
                onChange={(blueStars) => onChange({ ...value, blueStars })}
              />
            )}
            <label className="field">
              <span>Grandparent {index} pink aptitude</span>
              <select
                value={value.pinkAptitude}
                onChange={(e) => onChange({ ...value, pinkAptitude: e.target.value })}
              >
                <option value="">— none —</option>
                {APTITUDE_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {value.pinkAptitude !== '' && (
              <StarsSelect
                label={`Grandparent ${index} pink stars`}
                value={value.pinkStars}
                onChange={(pinkStars) => onChange({ ...value, pinkStars })}
              />
            )}
          </div>

          <SparkRows
            sparks={value.whiteSparks}
            onChange={(whiteSparks) => onChange({ ...value, whiteSparks })}
            skillName={skillName}
            ariaPrefix={prefix}
          />
          <SearchPicker
            label={`Add grandparent ${index} white spark`}
            placeholder="Search white skills…"
            items={whiteItems.map((i) => ({
              ...i,
              disabled: value.whiteSparks.some((s) => s.skillId === i.id),
            }))}
            onPick={(skillId) =>
              onChange({
                ...value,
                whiteSparks: [...value.whiteSparks, { skillId, stars: 3 }],
              })
            }
          />
        </>
      )}
    </details>
  );
}

// --- Main form ------------------------------------------------------------------

const RARITY_BADGE: Partial<Record<SkillRecord['rarity'], string>> = {
  white: 'White',
  gold: 'Gold',
  inherited_unique: 'Inherited',
};

export function ParentForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Parent;
  onSave: (draft: ParentDraft) => void;
  onCancel: () => void;
}) {
  const { skills, skillById } = useGameData();
  const { umas, umaById } = useUmas();

  const [umaId, setUmaId] = useState<string | null>(initial?.umaId ?? null);
  const [blueStat, setBlueStat] = useState<Stat>(initial?.blueSpark.stat ?? 'spd');
  const [blueStars, setBlueStars] = useState<Stars>(initial?.blueSpark.stars ?? 3);
  const [pinkAptitude, setPinkAptitude] = useState(initial?.pinkSpark.aptitude ?? 'turf');
  const [pinkStars, setPinkStars] = useState<Stars>(initial?.pinkSpark.stars ?? 3);
  const [green, setGreen] = useState<{
    skillId: string;
    stars: Stars;
    sourceCardId?: string;
  } | null>(initial?.greenSpark ?? null);
  const [whiteSparks, setWhiteSparks] = useState<SparkDraft[]>(
    initial?.whiteSparks.map((s) => ({ ...s })) ?? [],
  );
  const [gp1, setGp1] = useState<GrandparentDraft>(() =>
    grandparentFromRef(initial?.grandparents?.[0]),
  );
  const [gp2, setGp2] = useState<GrandparentDraft>(() =>
    grandparentFromRef(initial?.grandparents?.[1]),
  );
  const [affinityHint, setAffinityHint] = useState(
    initial?.affinityHint !== undefined ? String(initial.affinityHint) : '',
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [source, setSource] = useState<Parent['source']>(initial?.source ?? 'mine');
  const [formError, setFormError] = useState<string | null>(null);

  const skillName = (id: string) => skillById.get(id)?.nameEn ?? `Skill ${id}`;

  // P4: only Global records are offered.
  const umaItems = useMemo<SearchItem[]>(
    () =>
      umas
        .filter((u) => u.server === 'global')
        .map((u) => ({
          id: u.umaId,
          name: u.nameEn,
          sub: u.epithet,
          icon: <GameIcon kind="uma" id={u.umaId} size={32} alt="" />,
        })),
    [umas],
  );
  // FINDING 1: white sparks are white-skill ONLY. Gold/unique skills are not
  // white-spark inheritance targets (mechanics-notes §8; white_spark_skills.json
  // carries white ids exclusively); offering+pricing a gold as a white spark
  // fabricates an inheritance % for an event that cannot occur (P3).
  const whiteItems = useMemo<SearchItem[]>(
    () =>
      skills
        .filter((s) => s.server === 'global' && s.rarity === 'white')
        .map((s) => ({
          id: s.skillId,
          name: s.nameEn,
          badge: RARITY_BADGE[s.rarity],
          badgeClass: `rarity-${s.rarity}`,
          icon: <GameIcon kind="skill" id={s.iconId} size={24} alt="" />,
        })),
    [skills],
  );
  // Green sparks grant the 9xxxxx inherited-unique skill (mechanics-notes §8).
  const greenItems = useMemo<SearchItem[]>(
    () =>
      skills
        .filter((s) => s.server === 'global' && s.rarity === 'inherited_unique')
        .map((s) => ({
          id: s.skillId,
          name: s.nameEn,
          badge: RARITY_BADGE[s.rarity],
          badgeClass: `rarity-${s.rarity}`,
          icon: <GameIcon kind="skill" id={s.iconId} size={24} alt="" />,
        })),
    [skills],
  );

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (umaId === null) {
      setFormError('Pick the uma first — everything else hangs off it.');
      return;
    }
    const affinity = affinityHint.trim() === '' ? undefined : Number(affinityHint);
    const grandparents: [ParentRef?, ParentRef?] = [
      grandparentToRef(gp1),
      grandparentToRef(gp2),
    ];
    onSave({
      id: initial?.id,
      umaId,
      blueSpark: { stat: blueStat, stars: blueStars },
      pinkSpark: { aptitude: pinkAptitude, stars: pinkStars },
      greenSpark: green ?? undefined,
      whiteSparks,
      grandparents: grandparents[0] || grandparents[1] ? grandparents : undefined,
      affinityHint: affinity !== undefined && Number.isFinite(affinity) ? affinity : undefined,
      notes: notes.trim() === '' ? undefined : notes.trim(),
      source,
      importSource: initial?.importSource ?? 'manual',
      // Preserve importer-provided extras when editing (UmaExtractor, later).
      stats: initial?.stats,
      rating: initial?.rating,
    });
  };

  return (
    <form
      className="parent-form"
      onSubmit={handleSubmit}
      aria-label={initial ? 'Edit parent' : 'Add parent'}
    >
      <h3>{initial ? 'Edit parent' : 'New parent'}</h3>

      {umaId === null ? (
        <SearchPicker
          label="Uma"
          placeholder="Search umas by name or epithet…"
          items={umaItems}
          onPick={setUmaId}
        />
      ) : (
        <div className="selected-row">
          <GameIcon kind="uma" id={umaId} size={36} alt="" />
          <span className="owned-name">{umaName(umaById, umaId)}</span>
          {umaById.get(umaId)?.epithet !== undefined && (
            <span className="muted small">{umaById.get(umaId)?.epithet}</span>
          )}
          <button type="button" onClick={() => setUmaId(null)}>
            Change uma
          </button>
        </div>
      )}

      <h3>Blue / pink sparks</h3>
      <div className="spark-grid">
        <label className="field">
          <span>Blue spark stat</span>
          <select value={blueStat} onChange={(e) => setBlueStat(e.target.value as Stat)}>
            {STAT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <StarsSelect label="Blue spark stars" value={blueStars} onChange={setBlueStars} />
        <label className="field">
          <span>Pink spark aptitude</span>
          <select value={pinkAptitude} onChange={(e) => setPinkAptitude(e.target.value)}>
            {APTITUDE_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <StarsSelect label="Pink spark stars" value={pinkStars} onChange={setPinkStars} />
      </div>

      <h3>Green spark (inherited unique)</h3>
      {green !== null ? (
        <div className="selected-row">
          <span className="target-name">{skillName(green.skillId)}</span>
          <StarsSelect
            label="Green spark stars"
            value={green.stars}
            onChange={(stars) => setGreen({ ...green, stars })}
          />
          <button
            type="button"
            className="icon-btn"
            aria-label="Remove green spark"
            onClick={() => setGreen(null)}
          >
            ✕
          </button>
        </div>
      ) : (
        <SearchPicker
          label="Green spark"
          placeholder="Search inherited uniques…"
          items={greenItems}
          onPick={(skillId) => setGreen({ skillId, stars: 3 })}
        />
      )}

      <h3>White sparks</h3>
      <p className="muted small">Each spark is named after the skill it grants.</p>
      <SparkRows
        sparks={whiteSparks}
        onChange={setWhiteSparks}
        skillName={skillName}
      />
      <SearchPicker
        label="Add white spark"
        placeholder="Search white skills…"
        items={whiteItems.map((i) => ({
          ...i,
          disabled: whiteSparks.some((s) => s.skillId === i.id),
        }))}
        onPick={(skillId) => setWhiteSparks((prev) => [...prev, { skillId, stars: 3 }])}
      />

      <h3>Grandparents</h3>
      <GrandparentFieldset
        index={1}
        value={gp1}
        onChange={setGp1}
        umaItems={umaItems}
        whiteItems={whiteItems}
        skillName={skillName}
      />
      <GrandparentFieldset
        index={2}
        value={gp2}
        onChange={setGp2}
        umaItems={umaItems}
        whiteItems={whiteItems}
        skillName={skillName}
      />

      <h3>Details</h3>
      <label className="field">
        <span>Affinity hint (total)</span>
        <input
          type="number"
          min={0}
          value={affinityHint}
          onChange={(e) => setAffinityHint(e.target.value)}
          aria-describedby="parent-affinity-help"
        />
      </label>
      <p className="muted small" id="parent-affinity-help">
        total affinity vs your target uma — look it up on umamily.moe or Ice&apos;s sheet
        (plan §7); per-member scores are the real model, this total is an upper bound
      </p>

      <label className="field">
        <span>Notes</span>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Trainer ID for rentals, farming notes…"
        />
      </label>

      <div className="field">
        <span id="parent-source-label">Source</span>
        <div className="source-toggle" role="group" aria-labelledby="parent-source-label">
          <button
            type="button"
            className="toggle-chip"
            aria-pressed={source === 'mine'}
            onClick={() => setSource('mine')}
          >
            Mine
          </button>
          <button
            type="button"
            className="toggle-chip"
            aria-pressed={source === 'friend_rental'}
            onClick={() => setSource('friend_rental')}
          >
            Friend rental
          </button>
        </div>
      </div>

      {formError !== null && (
        <p className="error" role="alert">
          {formError}
        </p>
      )}
      <div className="form-actions">
        <button type="submit">Save parent</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
