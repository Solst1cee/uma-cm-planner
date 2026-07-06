/** M1.4b — manual editor that produces a full veteran-shape `Parent` for a
 *  real found rental (after the user follows a Task-6 `RentalDraftPanel` search
 *  link and actually finds/borrows the veteran). Presentational: no providers
 *  (no useGameData/useUmas/useActivePlan/useAvailability) — the page supplies
 *  playable-uma / unique / white-skill option lists as plain `{id,name}` pairs.
 *  Structurally mirrors the older manual `src/features/parents/ParentForm.tsx`
 *  (uma + blue/pink + green + white + 2 grandparents), adapted to native
 *  `<select>`s and props-only options (no icons — YAGNI per the controller). */
import { useState } from 'react';
import type { Parent, ParentRef, Stat } from '@/core/types';
import type { SparkFilter } from '@/core/sparkFilter';
import { APTITUDE_OPTIONS, STARS, STAT_OPTIONS, starsGlyph, type Stars } from '@/features/parents/sparkMeta';

export interface RentalParentEditorProps {
  /** Edit an existing recorded rental. */
  value?: Parent;
  /** Pre-seed sparks from a Task-6 draft's filters (promote Draft→Rental). Ignored when `value` is set. */
  seedFilters?: SparkFilter[];
  onSave: (p: Parent) => void;
  onCancel: () => void;
  /** Playable outfits. */
  umaOptions: Array<{ id: string; name: string }>;
  /** Unique (inherited-unique) skills, for the green spark. */
  greenOptions: Array<{ id: string; name: string }>;
  /** White skills, for white sparks. */
  whiteOptions: Array<{ id: string; name: string }>;
}

interface WhiteDraft {
  skillId: string;
  stars: Stars;
}

interface GpDraft {
  umaId: string; // '' = unset
  blueStat: Stat | '';
  blueStars: Stars;
  pinkAptitude: string; // '' = unset
  pinkStars: Stars;
  greenSkillId: string; // '' = unset
  greenStars: Stars;
  whiteSparks: WhiteDraft[];
}

const emptyGp = (): GpDraft => ({
  umaId: '',
  blueStat: '',
  blueStars: 3,
  pinkAptitude: '',
  pinkStars: 3,
  greenSkillId: '',
  greenStars: 3,
  whiteSparks: [],
});

function gpFromRef(ref: ParentRef | undefined): GpDraft {
  if (!ref) return emptyGp();
  return {
    umaId: ref.umaId,
    blueStat: ref.blueSpark?.stat ?? '',
    blueStars: ref.blueSpark?.stars ?? 3,
    pinkAptitude: ref.pinkSpark?.aptitude ?? '',
    pinkStars: ref.pinkSpark?.stars ?? 3,
    greenSkillId: ref.greenSpark?.skillId ?? '',
    greenStars: ref.greenSpark?.stars ?? 3,
    whiteSparks: ref.whiteSparks?.map((s) => ({ ...s })) ?? [],
  };
}

function gpToRef(gp: GpDraft): ParentRef | undefined {
  if (gp.umaId === '') return undefined;
  return {
    umaId: gp.umaId,
    blueSpark: gp.blueStat === '' ? undefined : { stat: gp.blueStat, stars: gp.blueStars },
    pinkSpark: gp.pinkAptitude === '' ? undefined : { aptitude: gp.pinkAptitude, stars: gp.pinkStars },
    greenSpark: gp.greenSkillId === '' ? undefined : { skillId: gp.greenSkillId, stars: gp.greenStars },
    whiteSparks: gp.whiteSparks.length > 0 ? gp.whiteSparks : undefined,
  };
}

/** >=3→3, >=2→2, else 1 — the shared "totalMin as a stars estimate" clamp. */
const clampStars = (n: number): Stars => (n >= 3 ? 3 : n >= 2 ? 2 : 1);

/** Seed defaults from the first blue/pink/green clause + every white clause
 *  of a draft's search filters. Only consulted when `value` is absent. */
function seedFromFilters(filters: SparkFilter[]) {
  const blue = filters.find((f): f is Extract<SparkFilter, { kind: 'blue' }> => f.kind === 'blue');
  const pink = filters.find((f): f is Extract<SparkFilter, { kind: 'pink' }> => f.kind === 'pink');
  const green = filters.find((f): f is Extract<SparkFilter, { kind: 'green' }> => f.kind === 'green');
  const whites = filters.filter((f): f is Extract<SparkFilter, { kind: 'white' }> => f.kind === 'white');
  return {
    blueStat: blue?.stat,
    blueStars: blue ? clampStars(blue.totalMin) : undefined,
    pinkAptitude: pink?.aptitude,
    pinkStars: pink ? clampStars(pink.totalMin) : undefined,
    greenSkillId: green?.skillId,
    greenStars: green ? clampStars(green.totalMin) : undefined,
    whiteSparks: whites.map((w): WhiteDraft => ({ skillId: w.skillId, stars: clampStars(w.totalMin) })),
  };
}

function StarsSelect({ label, value, onChange }: { label: string; value: Stars; onChange: (v: Stars) => void }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(Number(e.target.value) as Stars)}>
      {STARS.map((n) => (
        <option key={n} value={n}>
          {starsGlyph(n)} ({n})
        </option>
      ))}
    </select>
  );
}

/** Added white sparks (each with its own stars + remove) + a select+Add row to add another. */
function WhiteSparkList({
  sparks,
  onChange,
  whiteOptions,
  name,
  prefix,
}: {
  sparks: WhiteDraft[];
  onChange: (next: WhiteDraft[]) => void;
  whiteOptions: Array<{ id: string; name: string }>;
  name: (id: string) => string;
  prefix: string;
}) {
  const [pick, setPick] = useState('');
  const available = whiteOptions.filter((o) => !sparks.some((s) => s.skillId === o.id));
  return (
    <div className="inh-rental-white">
      {sparks.map((s) => {
        const label = name(s.skillId);
        return (
          <div key={s.skillId} className="inh-rental-white-row">
            <span className="inh-rental-white-name">{label}</span>
            <StarsSelect
              label={`${prefix}${label} stars`}
              value={s.stars}
              onChange={(stars) => onChange(sparks.map((x) => (x.skillId === s.skillId ? { ...x, stars } : x)))}
            />
            <button
              type="button"
              className="inh-rental-x"
              aria-label={`Remove ${prefix}${label}`}
              onClick={() => onChange(sparks.filter((x) => x.skillId !== s.skillId))}
            >
              ✕
            </button>
          </div>
        );
      })}
      {available.length > 0 && (
        <div className="inh-rental-white-add">
          <select aria-label={`${prefix}Add white spark`} value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">— pick white skill —</option>
            {available.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label={prefix ? `${prefix}Add` : undefined}
            disabled={pick === ''}
            onClick={() => {
              if (pick === '') return;
              onChange([...sparks, { skillId: pick, stars: 3 }]);
              setPick('');
            }}
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function GrandparentBlock({
  index,
  value,
  onChange,
  umaOptions,
  greenOptions,
  whiteOptions,
  name,
}: {
  index: 1 | 2;
  value: GpDraft;
  onChange: (next: GpDraft) => void;
  umaOptions: Array<{ id: string; name: string }>;
  greenOptions: Array<{ id: string; name: string }>;
  whiteOptions: Array<{ id: string; name: string }>;
  name: (id: string) => string;
}) {
  const prefix = `Grandparent ${index} `;
  const gpName = umaOptions.find((o) => o.id === value.umaId)?.name ?? value.umaId;
  return (
    <details className="inh-rental-gp" open={value.umaId !== ''}>
      <summary>Grandparent {index}{value.umaId !== '' ? `: ${gpName}` : ' (optional)'}</summary>
      <div className="inh-rental-gp-body">
        <label className="inh-rental-field">
          <span className="muted small">Uma</span>
          <select aria-label={`${prefix}uma`} value={value.umaId} onChange={(e) => onChange({ ...value, umaId: e.target.value })}>
            <option value="">— pick uma —</option>
            {umaOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>

        <div className="inh-rental-row">
          <label className="inh-rental-field">
            <span className="muted small">Blue stat</span>
            <select
              aria-label={`${prefix}blue stat`}
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
            <StarsSelect label={`${prefix}blue stars`} value={value.blueStars} onChange={(blueStars) => onChange({ ...value, blueStars })} />
          )}
        </div>

        <div className="inh-rental-row">
          <label className="inh-rental-field">
            <span className="muted small">Pink aptitude</span>
            <select
              aria-label={`${prefix}pink aptitude`}
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
            <StarsSelect label={`${prefix}pink stars`} value={value.pinkStars} onChange={(pinkStars) => onChange({ ...value, pinkStars })} />
          )}
        </div>

        <div className="inh-rental-row">
          <label className="inh-rental-field">
            <span className="muted small">Green (unique)</span>
            <select
              aria-label={`${prefix}green skill`}
              value={value.greenSkillId}
              onChange={(e) => onChange({ ...value, greenSkillId: e.target.value })}
            >
              <option value="">— none —</option>
              {greenOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          {value.greenSkillId !== '' && (
            <StarsSelect label={`${prefix}green stars`} value={value.greenStars} onChange={(greenStars) => onChange({ ...value, greenStars })} />
          )}
        </div>

        <div className="inh-rental-field">
          <span className="muted small">White sparks</span>
          <WhiteSparkList
            sparks={value.whiteSparks}
            onChange={(whiteSparks) => onChange({ ...value, whiteSparks })}
            whiteOptions={whiteOptions}
            name={name}
            prefix={prefix}
          />
        </div>
      </div>
    </details>
  );
}

export function RentalParentEditor({ value, seedFilters, onSave, onCancel, umaOptions, greenOptions, whiteOptions }: RentalParentEditorProps) {
  const seed = !value && seedFilters ? seedFromFilters(seedFilters) : undefined;

  const [umaId, setUmaId] = useState(value?.umaId ?? '');
  const [blueStat, setBlueStat] = useState<Stat>(value?.blueSpark.stat ?? seed?.blueStat ?? 'spd');
  const [blueStars, setBlueStars] = useState<Stars>(value?.blueSpark.stars ?? seed?.blueStars ?? 3);
  const [pinkAptitude, setPinkAptitude] = useState(value?.pinkSpark.aptitude ?? seed?.pinkAptitude ?? 'turf');
  const [pinkStars, setPinkStars] = useState<Stars>(value?.pinkSpark.stars ?? seed?.pinkStars ?? 3);
  const [greenSkillId, setGreenSkillId] = useState(value?.greenSpark?.skillId ?? seed?.greenSkillId ?? '');
  const [greenStars, setGreenStars] = useState<Stars>(value?.greenSpark?.stars ?? seed?.greenStars ?? 3);
  const [whiteSparks, setWhiteSparks] = useState<WhiteDraft[]>(value?.whiteSparks.map((s) => ({ ...s })) ?? seed?.whiteSparks ?? []);
  const [gp1, setGp1] = useState<GpDraft>(() => gpFromRef(value?.grandparents?.[0]));
  const [gp2, setGp2] = useState<GpDraft>(() => gpFromRef(value?.grandparents?.[1]));

  const skillName = (id: string) => whiteOptions.find((o) => o.id === id)?.name ?? greenOptions.find((o) => o.id === id)?.name ?? id;

  const canSave = umaId !== '';

  const handleSave = () => {
    if (!canSave) return;
    const grandparents: [ParentRef?, ParentRef?] = [gpToRef(gp1), gpToRef(gp2)];
    const parent: Parent = {
      id: value?.id ?? '__rental__',
      umaId,
      blueSpark: { stat: blueStat, stars: blueStars },
      pinkSpark: { aptitude: pinkAptitude, stars: pinkStars },
      whiteSparks,
      ...(greenSkillId !== '' ? { greenSpark: { skillId: greenSkillId, stars: greenStars } } : {}),
      ...(grandparents[0] || grandparents[1] ? { grandparents } : {}),
      source: 'friend_rental',
      importSource: 'manual',
    };
    onSave(parent);
  };

  return (
    <div className="inh-rental-editor">
      <label className="inh-rental-field">
        <span className="muted small">Parent uma</span>
        <select aria-label="Parent uma" value={umaId} onChange={(e) => setUmaId(e.target.value)}>
          <option value="">— pick uma —</option>
          {umaOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>

      <div className="inh-rental-row">
        <label className="inh-rental-field">
          <span className="muted small">Blue stat</span>
          <select aria-label="Blue stat" value={blueStat} onChange={(e) => setBlueStat(e.target.value as Stat)}>
            {STAT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <StarsSelect label="Blue stars" value={blueStars} onChange={setBlueStars} />
      </div>

      <div className="inh-rental-row">
        <label className="inh-rental-field">
          <span className="muted small">Pink aptitude</span>
          <select aria-label="Pink aptitude" value={pinkAptitude} onChange={(e) => setPinkAptitude(e.target.value)}>
            {APTITUDE_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <StarsSelect label="Pink stars" value={pinkStars} onChange={setPinkStars} />
      </div>

      <div className="inh-rental-row">
        <label className="inh-rental-field">
          <span className="muted small">Green (unique)</span>
          <select aria-label="Green skill" value={greenSkillId} onChange={(e) => setGreenSkillId(e.target.value)}>
            <option value="">— none —</option>
            {greenOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        {greenSkillId !== '' && <StarsSelect label="Green stars" value={greenStars} onChange={setGreenStars} />}
      </div>

      <div className="inh-rental-field">
        <span className="muted small">White sparks</span>
        <WhiteSparkList sparks={whiteSparks} onChange={setWhiteSparks} whiteOptions={whiteOptions} name={skillName} prefix="" />
      </div>

      <div className="inh-rental-gps">
        <GrandparentBlock index={1} value={gp1} onChange={setGp1} umaOptions={umaOptions} greenOptions={greenOptions} whiteOptions={whiteOptions} name={skillName} />
        <GrandparentBlock index={2} value={gp2} onChange={setGp2} umaOptions={umaOptions} greenOptions={greenOptions} whiteOptions={whiteOptions} name={skillName} />
      </div>

      <div className="inh-rental-actions">
        <button type="button" onClick={handleSave} disabled={!canSave}>
          Save
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
