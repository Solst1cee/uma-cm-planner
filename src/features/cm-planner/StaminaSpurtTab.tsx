/** Stamina Calculator tab — estimates full-spurt rate + the stamina required to hit a
 *  target spurt rate, broken down by base / downhill-saving / opponent-debuff scenarios.
 *
 *  Uses planToOverlayBuild (unique + wishlist recovery/green + guts) so all stamina
 *  management skills are included in the simulation. Downhill saving is no longer a
 *  toggle — it is always shown as a separate breakdown row so the user can read the
 *  benefit directly. Debuffs are injected as forced events (the vacuum has no opponents).
 *
 *  The sim runs on demand (Run button), NOT on mount, to avoid cold-start overhead.
 */
import { useMemo, useRef, useState } from 'react';
import { planToOverlayBuild } from '@/core/simBuild';
import type { CmPlan } from '@/core/types';
import type { SimBuild, SimRaceParams, VacuumResult } from '@/sim';
import type { VacuumOpts } from '@/sim/types';
import { SimClient } from '@/sim/client';
import { GameIcon } from '@/features/data/GameIcon';
import { requiredStaminaForSpurt, hpStats, histogram } from '@/core/staminaSpurt';
import { buildInjectedDebuffs, STAMINA_DEBUFF_ICON } from './staminaDebuffs';

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

// Histogram geometry: narrow + tall, with margins for the axis labels/ticks.
const PLOT_W = 190;
const PLOT_H = 130;
const HM = { top: 8, right: 8, bottom: 26, left: 34 };
const SVG_W = PLOT_W + HM.left + HM.right;
const SVG_H = PLOT_H + HM.top + HM.bottom;

interface Required {
  sta: number;
  reachable: boolean;
}

/** Format a required-stamina result: the value, or "> hi" when even max stamina misses. */
function fmtRequired(r: Required): string {
  return r.reachable ? String(r.sta) : `> ${STA_RANGE.hi}`;
}

/** SVG bar histogram of per-sample finish HP, with labelled axes.
 *  The lowest bin (zero/near-zero HP = ran out) is error-red; others use the accent. */
function FinalHpHistogram({ finalHp }: { finalHp: number[] }) {
  const bins = histogram(finalHp, HIST_BINS);
  const stats = hpStats(finalHp);
  const maxCount = Math.max(...bins.map((b) => b.count), 1);
  const barW = PLOT_W / HIST_BINS;
  const baseY = HM.top + PLOT_H;

  return (
    <figure className="cmp-stamina-hist">
      <figcaption className="small cmp-stamina-hist-title">Finish HP distribution</figcaption>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        role="img"
        aria-label="Histogram of finish HP across simulation runs"
        className="cmp-stamina-hist-svg"
      >
        {/* axes */}
        <line x1={HM.left} y1={HM.top} x2={HM.left} y2={baseY} className="cmp-hist-axis" />
        <line x1={HM.left} y1={baseY} x2={HM.left + PLOT_W} y2={baseY} className="cmp-hist-axis" />
        {/* y-axis: max count tick + title */}
        <text x={HM.left - 4} y={HM.top + 6} className="cmp-hist-tick" textAnchor="end">{maxCount}</text>
        <text x={HM.left - 4} y={baseY} className="cmp-hist-tick" textAnchor="end">0</text>
        <text
          transform={`translate(9 ${HM.top + PLOT_H / 2}) rotate(-90)`}
          className="cmp-hist-axis-label"
          textAnchor="middle"
        >
          Runs
        </text>
        {/* bars */}
        {bins.map((b, i) => {
          const barH = (b.count / maxCount) * PLOT_H;
          const isRunOut = i === 0 && b.x0 === 0;
          return (
            <rect
              key={i}
              x={HM.left + i * barW + 1}
              y={baseY - barH}
              width={Math.max(0, barW - 2)}
              height={barH}
              className={isRunOut ? 'cmp-hist-bar cmp-hist-bar--out' : 'cmp-hist-bar'}
            />
          );
        })}
        {/* x-axis: min/max HP ticks + title */}
        <text x={HM.left} y={baseY + 11} className="cmp-hist-tick" textAnchor="start">{Math.round(stats.min)}</text>
        <text x={HM.left + PLOT_W} y={baseY + 11} className="cmp-hist-tick" textAnchor="end">{Math.round(stats.max)}</text>
        <text x={HM.left + PLOT_W / 2} y={baseY + 22} className="cmp-hist-axis-label" textAnchor="middle">
          Finish HP
        </text>
      </svg>
      <p className="muted small cmp-stamina-hist-stats">
        min {Math.round(stats.min)} · median {Math.round(stats.median)} · max {Math.round(stats.max)}
      </p>
    </figure>
  );
}

interface StaminaSpurtResult {
  spurtRate: number;
  survival: number;
  base: Required; // no downhill, no debuffs
  downhill: Required; // downhill saving, no debuffs
  final: { sta: number; rate: number; reachable: boolean }; // downhill + debuffs
  whiteDebuffs: number;
  goldDebuffs: number;
  finalHp: number[];
}

export function StaminaSpurtTab({
  plan,
  deps,
}: {
  plan: CmPlan;
  deps?: StaminaSpurtDeps;
}) {
  const [open, setOpen] = useState(true);
  const [threshold, setThreshold] = useState(95);
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
    // The "realistic" scenario = downhill saving ON + the expected debuffs; the current
    // readout (spurt rate, survival, histogram) and the headline requirement use it.
    const optsFinal: VacuumOpts = {
      downhill: true,
      injectedDebuffs: buildInjectedDebuffs(whiteDebuffs, goldDebuffs, distance),
    };

    const withSta = (sta: number, o: VacuumOpts): Promise<number> => {
      const b: SimBuild = { ...baseBuild, stats: { ...baseBuild.stats, sta } };
      return Promise.resolve(d.vacuum(b, b, race, n, 1, o)).then((r) => r.aFullSpurtRate * 100);
    };

    try {
      // Current stats under the realistic scenario (downhill + debuffs).
      const cur = await Promise.resolve(d.vacuum(baseBuild, baseBuild, race, n, 1, optsFinal));

      // Required-stamina breakdown: base → with downhill → with debuffs (final).
      const base = await requiredStaminaForSpurt((sta) => withSta(sta, {}), threshold, STA_RANGE);
      const downhill = await requiredStaminaForSpurt(
        (sta) => withSta(sta, { downhill: true }),
        threshold,
        STA_RANGE,
      );
      const final = await requiredStaminaForSpurt(
        (sta) => withSta(sta, optsFinal),
        threshold,
        STA_RANGE,
      );

      if (token.current !== t) return;
      setResult({
        spurtRate: cur.aFullSpurtRate * 100,
        survival: cur.aStaminaSurvival * 100,
        base: { sta: base.sta, reachable: base.reachable },
        downhill: { sta: downhill.sta, reachable: downhill.reachable },
        final,
        whiteDebuffs,
        goldDebuffs,
        finalHp: cur.aFinalHp,
      });
      setStatus('done');
    } catch {
      if (token.current === t) setStatus('idle');
    }
  };

  if (spd === 0) {
    return (
      <section className="cmp-plan-card cmp-stamina-card">
        <header className="cmp-plan-card-head">Stamina Calculator</header>
        <div className="cmp-stamina-tab">
          <p className="muted small">Set a speed stat to simulate stamina.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="cmp-plan-card cmp-stamina-card">
      <header
        className="cmp-plan-card-head cmp-collapse-head"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
      >
        <span className="cmp-stamina-title">Stamina Calculator</span>
        <span className="cmp-collapse-caret" data-open={open || undefined} aria-hidden="true" />
      </header>

      {open && (
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
              <GameIcon kind="skill" id={STAMINA_DEBUFF_ICON.white} size={18} alt="" className="cmp-debuff-icon" />
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
              <GameIcon kind="skill" id={STAMINA_DEBUFF_ICON.gold} size={18} alt="" className="cmp-debuff-icon" />
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

          {result && (
            <>
              <dl className="cmp-stamina-details">
                <dt>Spurt rate</dt>
                <dd className="cmp-stamina-num">{result.spurtRate.toFixed(0)}%</dd>
                <dt>Stamina survival</dt>
                <dd className="cmp-stamina-num">{result.survival.toFixed(0)}%</dd>
                <dt>Stamina needed for {threshold}%</dt>
                <dd className="cmp-stamina-num">
                  {fmtRequired(result.final)}
                  {result.final.reachable && (
                    <span className="muted small"> (spurt {result.final.rate.toFixed(0)}%)</span>
                  )}
                </dd>
              </dl>

              <div className="cmp-stamina-breakdown">
                <span className="cmp-stamina-breakdown-title small">Breakdown</span>
                <div className="cmp-stamina-breakdown-row small">
                  <span>Base (no downhill)</span>
                  <span className="cmp-stamina-num">{fmtRequired(result.base)}</span>
                </div>
                <div className="cmp-stamina-breakdown-row small">
                  <span>With downhill saving</span>
                  <span className="cmp-stamina-num">{fmtRequired(result.downhill)}</span>
                </div>
                <div className="cmp-stamina-breakdown-row small">
                  <span>
                    With debuffs ({result.whiteDebuffs}W / {result.goldDebuffs}G)
                  </span>
                  <span className="cmp-stamina-num">{fmtRequired(result.final)}</span>
                </div>
              </div>

              {result.finalHp.length > 0 && <FinalHpHistogram finalHp={result.finalHp} />}
            </>
          )}
        </div>
      )}
    </section>
  );
}
