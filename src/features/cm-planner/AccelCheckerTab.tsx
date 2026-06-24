/** Accel-timing checker tab (Task 11, M4 main-page redesign).
 *
 *  For each skill in the focused build (unique + wishlist), runs `skillImpact`
 *  (400 samples) to derive the MEDIAN activation position across firing runs,
 *  then classifies it via `classifyAccelTiming` against the course's final-straight
 *  start (`fs`) sourced from the engine's CourseData.straights.
 *
 *  Note on skill scope: all wishlist + unique skills are shown regardless of
 *  effect type. Filtering to speed/accel effects would require async per-skill
 *  `loadSkillTechnicalDetail` calls (effect types live only in the runtime bundle,
 *  not in skills.json). Showing all skills makes the table universally useful —
 *  stamina/recovery skills rarely fire in the final straight anyway, so their
 *  'early' or 'none' labels are informative.
 *
 *  `fs` (final-straight start) is derived from the last `frontType === 1` straight
 *  in CourseData.straights (the straight terminating at course.distance). Lazy-
 *  imported to keep the engine bundle out of the initial chunk.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { planToOverlayBuild } from '@/core/simBuild';
import type { CmPlan } from '@/core/types';
import type { SimBuild, SimRaceParams, SkillImpact } from '@/sim';
import { SimClient } from '@/sim/client';
import { IMPACT_SAMPLES } from './useSkillTrace';
import { classifyAccelTiming, type AccelTiming } from './accelCheck';

// --- types ---

export interface AccelSkillDeps {
  skillImpact: (b: SimBuild, r: SimRaceParams, id: string, n: number) => SkillImpact | Promise<SkillImpact>;
}

interface SkillRow {
  skillId: string;
  medianPos: number | null;
  timing: AccelTiming;
  status: 'pending' | 'done';
}

// --- LRU cache shared with useSkillTrace (same key shape) ---
const cache = new Map<string, SkillImpact>();
const CACHE_MAX = 30;

function cacheGet(sig: string): SkillImpact | undefined {
  const v = cache.get(sig);
  if (v !== undefined) { cache.delete(sig); cache.set(sig, v); }
  return v;
}
function cacheSet(sig: string, impact: SkillImpact) {
  cache.delete(sig);
  cache.set(sig, impact);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function impactSig(skillId: string, build: SimBuild, race: SimRaceParams): string {
  return `accel|${skillId}|${race.courseId}|${build.umaId}|${build.strategy}|${build.stats.spd}/${build.stats.sta}/${build.stats.pow}/${build.stats.gut}/${build.stats.wit}`;
}

// --- median helper ---
function medianPos(impact: SkillImpact): number | null {
  // Collect first activation position per firing sample.
  const positions: number[] = [];
  for (const s of impact.samples) {
    const pos = s.positions[0];
    if (pos !== undefined) positions.push(pos);
  }
  if (positions.length === 0) return null;
  positions.sort((a, b) => a - b);
  const mid = Math.floor(positions.length / 2);
  return positions.length % 2 === 1
    ? (positions[mid] ?? null)
    : ((positions[mid - 1]! + positions[mid]!) / 2);
}

// --- singleton SimClient for production use ---
let prodClient: SimClient | null = null;
function realDeps(): AccelSkillDeps {
  prodClient ??= new SimClient();
  return { skillImpact: prodClient.skillImpact.bind(prodClient) };
}

// --- component ---

interface AccelCheckerTabProps {
  plan: CmPlan;
  /** Injected deps for testing (mirrors useSkillTrace pattern). */
  deps?: AccelSkillDeps;
}

export function AccelCheckerTab({ plan, deps }: AccelCheckerTabProps) {
  const spd = plan.statProfile.stats.spd;
  const build = useMemo(() => planToOverlayBuild(plan), [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    plan.cmRef.courseId,
    plan.umaId,
    plan.strategy,
    plan.statProfile.stats.spd,
    plan.statProfile.stats.sta,
    plan.statProfile.stats.pow,
    plan.statProfile.stats.gut,
    plan.statProfile.stats.wit,
    plan.statProfile.mood,
    plan.uniqueSkillId,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(plan.wishlist),
  ]);

  const race: SimRaceParams = useMemo(
    () => ({ courseId: plan.cmRef.courseId }),
    [plan.cmRef.courseId],
  );

  // Skill ids to check: unique (if set) + wishlist, deduped.
  const skillIds = useMemo(() => {
    const ids = [plan.uniqueSkillId, ...plan.wishlist.map((w) => w.skillId)].filter(Boolean);
    return [...new Set(ids)];
  }, [plan.uniqueSkillId, plan.wishlist]);

  // Final-straight start (fs) from course geometry.
  const [fs, setFs] = useState<number | null>(null);
  const courseId = plan.cmRef.courseId;
  useEffect(() => {
    let cancelled = false;
    void import('@/sim/courseData').then((m) => {
      if (cancelled) return;
      const cd = m.courseDataFor(courseId);
      // The final straight ends at course.distance; frontType === 1 = home straight.
      const finalStraight = [...(cd.straights ?? [])].find(
        (s) => s.frontType === 1 && s.end === cd.distance,
      ) ?? [...(cd.straights ?? [])].find((s) => s.frontType === 1);
      setFs(finalStraight?.start ?? null);
    }).catch(() => { /* geometry unavailable — leave fs null */ });
    return () => { cancelled = true; };
  }, [courseId]);

  // Per-skill rows: start as pending, resolve as impact arrives.
  const [rows, setRows] = useState<SkillRow[]>([]);
  const token = useRef(0);
  const depsRef = useRef(deps);
  depsRef.current = deps;

  // Build a stable sig over the full set of inputs.
  const sig = `${build.umaId}|${build.strategy}|${build.stats.spd}/${build.stats.sta}/${build.stats.pow}/${build.stats.gut}/${build.stats.wit}|${race.courseId}|${skillIds.join(',')}`;

  useEffect(() => {
    if (spd === 0 || skillIds.length === 0) {
      setRows([]);
      return;
    }

    const myToken = (token.current += 1);
    const merged = depsRef.current ?? realDeps();

    // Initialise all rows as pending.
    setRows(skillIds.map((id) => ({ skillId: id, medianPos: null, timing: 'none', status: 'pending' })));

    // Resolve each skill's impact independently (parallel fetches / cache hits).
    for (const skillId of skillIds) {
      const cacheSig = impactSig(skillId, build, race);
      // Only use the LRU cache for the production client (not injected deps), so
      // test doubles always get called and never receive stale cached values.
      const usingCache = !deps;
      const cached = usingCache ? cacheGet(cacheSig) : undefined;

      const resolve = (impact: SkillImpact) => {
        if (token.current !== myToken) return;
        const pos = medianPos(impact);
        if (usingCache && cached === undefined) cacheSet(cacheSig, impact);
        setRows((prev) =>
          prev.map((r) =>
            r.skillId === skillId
              ? {
                  skillId,
                  medianPos: pos,
                  timing: fs !== null ? classifyAccelTiming(pos, fs, plan.cmRef.distance) : 'none',
                  status: 'done',
                }
              : r,
          ),
        );
      };

      if (cached) {
        resolve(cached);
      } else {
        void Promise.resolve(merged.skillImpact(build, race, skillId, IMPACT_SAMPLES))
          .then(resolve)
          .catch(() => {
            if (token.current !== myToken) return;
            setRows((prev) =>
              prev.map((r) =>
                r.skillId === skillId
                  ? { ...r, status: 'done', timing: 'none', medianPos: null }
                  : r,
              ),
            );
          });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, spd, fs]);

  // Re-classify rows when fs loads (may arrive after rows are computed).
  useEffect(() => {
    if (fs === null) return;
    setRows((prev) =>
      prev.map((r) =>
        r.status === 'done'
          ? { ...r, timing: classifyAccelTiming(r.medianPos, fs, plan.cmRef.distance) }
          : r,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fs]);

  if (spd === 0) {
    return (
      <div className="cmp-accel-tab">
        <p className="muted small">Set a speed stat to simulate accel timing.</p>
      </div>
    );
  }

  if (skillIds.length === 0) {
    return (
      <div className="cmp-accel-tab">
        <p className="muted small">Add skills to the plan to see accel timing.</p>
      </div>
    );
  }

  return (
    <div className="cmp-accel-tab">
      <table className="cmp-accel-table" aria-label="Accel timing">
        <thead>
          <tr>
            <th scope="col">Skill</th>
            <th scope="col">Timing</th>
            <th scope="col">Position</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.skillId} data-timing={row.timing}>
              <td className="cmp-accel-skill">{row.skillId}</td>
              <td className="cmp-accel-timing">
                {row.status === 'pending' ? (
                  <span className="muted small">…</span>
                ) : (
                  <TimingLabel timing={row.timing} />
                )}
              </td>
              <td className="cmp-accel-pos">
                {row.status === 'pending' ? '—' : row.medianPos !== null ? `${Math.round(row.medianPos)} m` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TIMING_LABELS: Record<AccelTiming, string> = {
  optimal: 'Optimal (final straight)',
  mid:     'Mid race',
  early:   'Too early',
  none:    'Won\'t fire',
};

function TimingLabel({ timing }: { timing: AccelTiming }) {
  return <span className={`cmp-accel-badge cmp-accel-badge--${timing}`}>{TIMING_LABELS[timing]}</span>;
}
