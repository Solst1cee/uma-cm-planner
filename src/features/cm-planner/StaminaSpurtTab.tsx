/** Stamina spurt analysis tab — estimates full-spurt rate + required stamina for a
 *  target spurt rate, with optional downhill mode and opponent-stamina-debuff injection.
 *
 *  Uses planToOverlayBuild (unique + wishlist recovery/green + guts) so all stamina
 *  management skills are included in the simulation.
 *
 *  The sim runs on demand (Run button), NOT on mount, to avoid cold-start overhead.
 */
import { useMemo, useRef, useState } from 'react';
import { planToOverlayBuild } from '@/core/simBuild';
import type { CmPlan } from '@/core/types';
import type { SimBuild, SimRaceParams, VacuumResult } from '@/sim';
import type { VacuumOpts } from '@/sim/types';
import { SimClient } from '@/sim/client';
import { requiredStaminaForSpurt, hpStats, histogram } from '@/core/staminaSpurt';
import { buildInjectedDebuffs } from './staminaDebuffs';

export interface StaminaSpurtDeps {
  vacuum: (
    a: SimBuild,
    b: SimBuild,
    race: SimRaceParams,
    n: number,
    seed?: number,
    opts?: VacuumOpts,
  ) => VacuumResult | Promise<VacuumResult>;
  nsamples?: number;
}

let client: SimClient | null = null;
function realDeps(): StaminaSpurtDeps {
  client ??= new SimClient();
  return { vacuum: client.vacuum.bind(client) };
}

const NSAMPLES = 60;
const STA_RANGE = { lo: 100, hi: 1200 };
const HIST_BINS = 14;
const HIST_W = 280;
const HIST_H = 60;

/** SVG bar histogram of per-sample finish HP.
 *  The lowest bin (zero or near-zero HP = ran out) is marked in error-red;
 *  all other bins use the accent colour. Min/max/median stats printed below. */
function FinalHpHistogram({ finalHp }: { finalHp: number[] }) {
  const bins = histogram(finalHp, HIST_BINS);
  const stats = hpStats(finalHp);
  const maxCount = Math.max(...bins.map((b) => b.count), 1);
  const barW = HIST_W / HIST_BINS;

  return (
    <figure className="cmp-stamina-hist">
      <figcaption className="small" style={{ marginBottom: 4, fontWeight: 600 }}>
        Finish HP distribution
      </figcaption>
      <svg
        viewBox={`0 0 ${HIST_W} ${HIST_H}`}
        role="img"
        aria-label="Histogram of finish HP across simulation runs"
        style={{ display: 'block', width: '100%', height: HIST_H, background: 'var(--bg-2,#eef3f9)' }}
        preserveAspectRatio="none"
      >
        {bins.map((b, i) => {
          const barH = (b.count / maxCount) * HIST_H;
          const isRunOut = i === 0 && b.x0 === 0;
          return (
            <rect
              key={i}
              x={i * barW + 1}
              y={HIST_H - barH}
              width={Math.max(0, barW - 2)}
              height={barH}
              fill={isRunOut ? 'var(--error,#c2414b)' : 'var(--accent,#3478f6)'}
              opacity={0.85}
            />
          );
        })}
      </svg>
      <p className="muted small" style={{ margin: '3px 0 0' }}>
        min {Math.round(stats.min)} · median {Math.round(stats.median)} · max {Math.round(stats.max)}
      </p>
    </figure>
  );
}

interface StaminaSpurtResult {
  spurtRate: number;
  survival: number;
  needed: { sta: number; rate: number; reachable: boolean };
  baseNeeded: number; // no downhill, no debuffs — for the breakdown
  finalHp: number[]; // per-sample finish HP for runner A
}

export function StaminaSpurtTab({
  plan,
  deps,
}: {
  plan: CmPlan;
  deps?: StaminaSpurtDeps;
}) {
  const [threshold, setThreshold] = useState(95);
  const [downhill, setDownhill] = useState(false);
  const [whiteDebuffs, setWhiteDebuffs] = useState(0);
  const [goldDebuffs, setGoldDebuffs] = useState(0);
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [result, setResult] = useState<StaminaSpurtResult | null>(null);
  const token = useRef(0);

  // Mirror StaminaCheckerTab's dep list so wishlist edits re-run cleanly.
  const baseBuild = useMemo(
    () => planToOverlayBuild(plan),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
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
      JSON.stringify(plan.wishlist),
    ],
  );

  const race = useMemo<SimRaceParams>(
    () => ({ courseId: plan.cmRef.courseId }),
    [plan.cmRef.courseId],
  );

  const distance = plan.cmRef.distance;
  const spd = plan.statProfile.stats.spd;

  const run = async () => {
    const t = (token.current += 1);
    let d: StaminaSpurtDeps;
    try {
      d = deps ?? realDeps();
    } catch {
      return; // no worker (jsdom) — leave state unchanged
    }
    setStatus('running');
    const n = d.nsamples ?? NSAMPLES;
    const opts: VacuumOpts = {
      downhill,
      injectedDebuffs: buildInjectedDebuffs(whiteDebuffs, goldDebuffs, distance),
    };

    const withSta = (sta: number, o: VacuumOpts): Promise<number> => {
      const b: SimBuild = { ...baseBuild, stats: { ...baseBuild.stats, sta } };
      return Promise.resolve(d.vacuum(b, b, race, n, 1, o)).then((r) => r.aFullSpurtRate * 100);
    };

    try {
      // 1. Current spurt rate + survival under the requested conditions
      const cur = await Promise.resolve(d.vacuum(baseBuild, baseBuild, race, n, 1, opts));

      // 2. Required stamina WITH downhill + debuffs to hit threshold
      const needed = await requiredStaminaForSpurt(
        (sta) => withSta(sta, opts),
        threshold,
        STA_RANGE,
      );

      // 3. Required stamina WITHOUT downhill/debuffs (for the breakdown delta)
      const base = await requiredStaminaForSpurt(
        (sta) => withSta(sta, {}),
        threshold,
        STA_RANGE,
      );

      if (token.current !== t) return;
      setResult({
        spurtRate: cur.aFullSpurtRate * 100,
        survival: cur.aStaminaSurvival * 100,
        needed,
        baseNeeded: base.sta,
        finalHp: cur.aFinalHp,
      });
      setStatus('done');
    } catch {
      if (token.current === t) setStatus('idle');
    }
  };

  if (spd === 0) {
    return (
      <div className="cmp-stamina-tab">
        <p className="muted small">Set a speed stat to simulate stamina.</p>
      </div>
    );
  }

  return (
    <div className="cmp-stamina-tab">
      <div className="cmp-stamina-controls">
        <label className="small">
          target spurt&nbsp;
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={threshold}
            onChange={(e) => e.target.value !== '' && setThreshold(Number(e.target.value))}
            aria-label="Target spurt rate (%)"
          />
          %
        </label>
        <label className="small">
          <input
            type="checkbox"
            checked={downhill}
            onChange={(e) => setDownhill(e.target.checked)}
            aria-label="Downhill saving mode"
          />{' '}
          Downhill saving mode
        </label>
        <label className="small">
          white debuffs{' '}
          <input
            type="number"
            min={0}
            step={1}
            value={whiteDebuffs}
            onChange={(e) => setWhiteDebuffs(Number(e.target.value) || 0)}
            aria-label="Expected white stamina debuffs"
          />
        </label>
        <label className="small">
          gold debuffs{' '}
          <input
            type="number"
            min={0}
            step={1}
            value={goldDebuffs}
            onChange={(e) => setGoldDebuffs(Number(e.target.value) || 0)}
            aria-label="Expected gold stamina debuffs"
          />
        </label>
        <button
          type="button"
          className="cmp-run-btn"
          onClick={() => void run()}
          disabled={status === 'running'}
        >
          {status === 'running' ? '…' : status === 'idle' ? 'Run' : 'Re-run'}
        </button>
      </div>
      <p className="muted small">
        Simulates your full build (incl. recovery, green, and guts). Debuffs are an injected
        estimate — the vacuum has no opponents.
      </p>
      {result && (
        <>
          <dl className="cmp-stamina-details">
            <dt>Spurt rate</dt>
            <dd>{result.spurtRate.toFixed(0)}%</dd>
            <dt>Stamina survival</dt>
            <dd>{result.survival.toFixed(0)}%</dd>
            <dt>Stamina needed for {threshold}%</dt>
            <dd>
              {result.needed.reachable
                ? result.needed.sta
                : `> ${STA_RANGE.hi} (unreachable)`}{' '}
              {result.needed.reachable && `(spurt ${result.needed.rate.toFixed(0)}%)`}
            </dd>
            <dt>breakdown</dt>
            <dd className="muted small">
              base {result.baseNeeded} → with downhill/debuffs {result.needed.sta}
            </dd>
          </dl>
          {result.finalHp.length > 0 && (
            <FinalHpHistogram finalHp={result.finalHp} />
          )}
        </>
      )}
    </div>
  );
}
