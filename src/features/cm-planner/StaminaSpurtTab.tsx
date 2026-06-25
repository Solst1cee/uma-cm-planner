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
import { useEffect, useMemo, useRef, useState } from 'react';
import { planToOverlayBuild } from '@/core/simBuild';
import type { CmPlan } from '@/core/types';
import type { SimBuild, SimRaceParams, VacuumResult } from '@/sim';
import type { VacuumOpts } from '@/sim/types';
import { SimClient } from '@/sim/client';
import { GameIcon } from '@/features/data/GameIcon';
import { requiredStaminaForSpurt, hpStats, histogram } from '@/core/staminaSpurt';
import { buildInjectedDebuffs, STAMINA_DEBUFF_ICON } from './staminaDebuffs';
import { HeaderHelp } from './HeaderHelp';

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

/** Format a single required-stamina result: the value, or "> hi" when even max stamina misses. */
function fmtRequired(r: Required): string {
  return r.reachable ? String(r.sta) : `> ${STA_RANGE.hi}`;
}

/** Format a required-stamina RANGE (lo = fewer stamina e.g. with downhill, hi = more).
 *  Downhill saving is RNG-gated in-race, so its benefit is a range, not one number. */
function fmtRange(lo: Required, hi: Required): string {
  if (lo.reachable && hi.reachable && lo.sta === hi.sta) return String(lo.sta);
  return `${fmtRequired(lo)}–${fmtRequired(hi)}`;
}

/** A rounded HP value coloured by sign: green when positive (HP left), red when negative (ran out). */
function HpNum({ n }: { n: number }) {
  return <span className={n >= 0 ? 'cmp-hp-pos' : 'cmp-hp-neg'}>{Math.round(n)}</span>;
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
    </figure>
  );
}

interface StaminaSpurtResult {
  spurtTarget: number;
  survivalTarget: number;
  spurtRate: number;
  survival: number;
  spurtReq: Required; // stamina to hit the full-spurt target (conservative: with debuffs, no downhill)
  spurtHp: number[]; // finish HP sampled AT spurtReq.sta
  survivalReq: Required; // stamina to hit the survival target (same conservative scenario)
  survivalHp: number[]; // finish HP sampled AT survivalReq.sta
  baseNo: Required; // full-spurt, no downhill, no debuffs (breakdown base)
  downNo: Required; // full-spurt, downhill saving, no debuffs (low end of the downhill range)
  whiteDebuffs: number;
  goldDebuffs: number;
  hasDebuffs: boolean;
  finalHp: number[]; // current build (histogram)
}

export function StaminaSpurtTab({
  plan,
  deps,
  onStaleChange,
  spurtTarget: spurtTargetProp,
  onSpurtTargetChange,
  survivalTarget: survivalTargetProp,
  onSurvivalTargetChange,
}: {
  plan: CmPlan;
  deps?: StaminaSpurtDeps;
  onStaleChange?: (stale: boolean) => void;
  /** Target full-spurt-rate % (0–100). Drives the full-spurt required-stamina readout. */
  spurtTarget?: number;
  onSpurtTargetChange?: (pct: number) => void;
  /** Target stamina-survival % (0–100). Drives the survival required-stamina readout AND the
   *  Skill/Accel stamina-out warning. Both fall back to local state when standalone (tests). */
  survivalTarget?: number;
  onSurvivalTargetChange?: (pct: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const [spurtLocal, setSpurtLocal] = useState(95);
  const [survivalLocal, setSurvivalLocal] = useState(95);
  const spurtTarget = spurtTargetProp ?? spurtLocal;
  const setSpurtTarget = onSpurtTargetChange ?? setSpurtLocal;
  const survivalTarget = survivalTargetProp ?? survivalLocal;
  const setSurvivalTarget = onSurvivalTargetChange ?? setSurvivalLocal;
  const [whiteDebuffs, setWhiteDebuffs] = useState(0);
  const [goldDebuffs, setGoldDebuffs] = useState(0);
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [result, setResult] = useState<StaminaSpurtResult | null>(null);
  const [runSig, setRunSig] = useState<string | null>(null);
  const token = useRef(0);

  const aptitudeSig = JSON.stringify(plan.sparkGoals.pink);
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
      aptitudeSig,
      JSON.stringify(plan.wishlist),
    ],
  );

  const race = useMemo<SimRaceParams>(
    () => ({ courseId: plan.cmRef.courseId }),
    [plan.cmRef.courseId],
  );

  const distance = plan.cmRef.distance;
  const spd = plan.statProfile.stats.spd;

  // Inputs that affect the result — when they change after a run, prompt a re-run.
  const sig = useMemo(
    () =>
      JSON.stringify([
        baseBuild.stats,
        [...baseBuild.skills].sort(),
        baseBuild.strategy,
        baseBuild.aptitudes,
        baseBuild.mood ?? null,
        race.courseId,
        spurtTarget,
        survivalTarget,
        whiteDebuffs,
        goldDebuffs,
      ]),
    [baseBuild, race.courseId, spurtTarget, survivalTarget, whiteDebuffs, goldDebuffs],
  );
  const isStale = runSig !== null && sig !== runSig;

  // Report stale state up so the tabstrip can flag this tab (fires only when it flips).
  const onStaleRef = useRef(onStaleChange);
  onStaleRef.current = onStaleChange;
  useEffect(() => {
    onStaleRef.current?.(isStale);
  }, [isStale]);

  const run = async () => {
    const t = (token.current += 1);
    setRunSig(sig);
    let d: StaminaSpurtDeps;
    try {
      d = deps ?? realDeps();
    } catch {
      return; // no worker (jsdom) — leave state unchanged
    }
    setStatus('running');
    const n = d.nsamples ?? NSAMPLES;
    const spurtTh = spurtTarget;
    const survivalTh = survivalTarget;
    const hasDebuffs = whiteDebuffs + goldDebuffs > 0;
    const debuffOpts: VacuumOpts = {
      injectedDebuffs: buildInjectedDebuffs(whiteDebuffs, goldDebuffs, distance),
    };

    // A single stamina probe samples both the chosen metric's rate AND the finish-HP
    // distribution at that stamina (so each target can show the buffer it leaves).
    const probe = (metric: 'spurt' | 'survival', o: VacuumOpts) => (sta: number) => {
      const b: SimBuild = { ...baseBuild, stats: { ...baseBuild.stats, sta } };
      return Promise.resolve(d.vacuum(b, b, race, n, 1, o)).then((r) => ({
        rate: (metric === 'spurt' ? r.aFullSpurtRate : r.aStaminaSurvival) * 100,
        finalHp: r.aFinalHp,
      }));
    };
    const reqSpurt = (o: VacuumOpts) => requiredStaminaForSpurt(probe('spurt', o), spurtTh, STA_RANGE);
    const reqSurvival = (o: VacuumOpts) =>
      requiredStaminaForSpurt(probe('survival', o), survivalTh, STA_RANGE);

    try {
      // Current readout (spurt rate / survival / histogram): the build as-is WITH the
      // expected debuffs but WITHOUT downhill — the reliable floor (don't bank on downhill RNG).
      const cur = await Promise.resolve(d.vacuum(baseBuild, baseBuild, race, n, 1, debuffOpts));

      // Full-spurt requirements. Downhill is a RANGE (downNo..baseNo): in-race downhill
      // mode is RNG-gated, so the saving lands somewhere between full-downhill and none.
      const baseNo = await reqSpurt({});
      const downNo = await reqSpurt({ downhill: true });
      // The conservative full-spurt requirement = with expected debuffs (skip the sim when none).
      const spurtReq = hasDebuffs ? await reqSpurt(debuffOpts) : baseNo;
      // The survival requirement, same conservative scenario (with debuffs if any).
      const survivalReq = await reqSurvival(hasDebuffs ? debuffOpts : {});

      if (token.current !== t) return;
      setResult({
        spurtTarget: spurtTh,
        survivalTarget: survivalTh,
        spurtRate: cur.aFullSpurtRate * 100,
        survival: cur.aStaminaSurvival * 100,
        spurtReq: { sta: spurtReq.sta, reachable: spurtReq.reachable },
        spurtHp: spurtReq.finalHp,
        survivalReq: { sta: survivalReq.sta, reachable: survivalReq.reachable },
        survivalHp: survivalReq.finalHp,
        baseNo: { sta: baseNo.sta, reachable: baseNo.reachable },
        downNo: { sta: downNo.sta, reachable: downNo.reachable },
        whiteDebuffs,
        goldDebuffs,
        hasDebuffs,
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
        <HeaderHelp label="How the Stamina Calculator works">
          <p className="cmp-help-title">Stamina Calculator</p>
          <p>
            Simulates your full build (unique + wishlist skills, incl. recovery, green stat-ups, and
            guts) over many races to estimate stamina. All numbers are Monte-Carlo estimates.
          </p>
          <ul>
            <li><b>Spurt rate</b> — share of runs that sustain a full max-speed last spurt to the line.</li>
            <li><b>Stamina survival</b> — share of runs that finish without hitting 0 HP.</li>
            <li>
              <b>Stamina needed for X% full spurt / Y% survival</b> — the stamina stat to reach each
              target, found by re-simulating across stamina values. Full spurt is the stricter bar,
              so it needs more stamina than survival. The indented <b>finish HP</b> is the HP buffer
              you&apos;d run with at that stamina (survival sits near 0 — that&apos;s the margin).
            </li>
            <li>
              <b>Downhill saving</b> — downhill mode (in-race RNG) lowers HP use, so its benefit is a
              range: <b>0</b> (never activates) to the full saving.
            </li>
            <li>
              <b>Debuffs</b> — expected opponent stamina debuffs (white / gold) injected as an estimate;
              the vacuum sim has no real opponents.
            </li>
            <li><b>Finish HP</b> — distribution of HP left at the line; the red bar = ran out.</li>
          </ul>
        </HeaderHelp>
        <button
          type="button"
          className="cmp-run-btn"
          disabled={status === 'running'}
          aria-label={status === 'running' ? 'Running' : status === 'idle' ? 'Run' : 'Re-run'}
          onClick={(e) => {
            e.stopPropagation();
            void run();
          }}
        >
          {status === 'running' ? '…' : status === 'idle' ? 'Run' : 'Re-run'}
        </button>
        {isStale && <span className="cmp-stale small">Changed detected!, please re-run</span>}
        <span className="cmp-collapse-caret" data-open={open || undefined} aria-hidden="true" />
      </header>

      {open && (
        <div className="cmp-stamina-tab">
          <div className="cmp-stamina-controls">
            <label className="cmp-sr-ctl small">
              <span className="cmp-sr-label">Target full spurt (%)</span>
              <span className="cmp-sr-input">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={spurtTarget}
                  onChange={(e) => e.target.value !== '' && setSpurtTarget(Number(e.target.value))}
                  aria-label="Target full spurt rate (%)"
                />
              </span>
            </label>
            <label className="cmp-sr-ctl small">
              <span className="cmp-sr-label">Target survival (%)</span>
              <span className="cmp-sr-input">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={survivalTarget}
                  onChange={(e) => e.target.value !== '' && setSurvivalTarget(Number(e.target.value))}
                  aria-label="Target stamina survival (%)"
                />
              </span>
            </label>
            <label className="cmp-sr-ctl small">
              <span className="cmp-sr-label">
                <GameIcon kind="skill" id={STAMINA_DEBUFF_ICON.white} size={18} alt="" className="cmp-debuff-icon" />
                white debuffs
              </span>
              <span className="cmp-sr-input">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={whiteDebuffs}
                  onChange={(e) => setWhiteDebuffs(Number(e.target.value) || 0)}
                  aria-label="Expected white stamina debuffs"
                />
              </span>
            </label>
            <label className="cmp-sr-ctl small">
              <span className="cmp-sr-label">
                <GameIcon kind="skill" id={STAMINA_DEBUFF_ICON.gold} size={18} alt="" className="cmp-debuff-icon" />
                gold debuffs
              </span>
              <span className="cmp-sr-input">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={goldDebuffs}
                  onChange={(e) => setGoldDebuffs(Number(e.target.value) || 0)}
                  aria-label="Expected gold stamina debuffs"
                />
              </span>
            </label>
          </div>

          {result && (
            <>
              <hr className="cmp-stamina-sep" />
              {(() => {
                const saving =
                  result.baseNo.reachable && result.downNo.reachable
                    ? result.baseNo.sta - result.downNo.sta
                    : 0;
                const cost =
                  result.hasDebuffs && result.spurtReq.reachable && result.baseNo.reachable
                    ? result.spurtReq.sta - result.baseNo.sta
                    : 0;
                const spurtHp = result.spurtHp.length > 0 ? hpStats(result.spurtHp) : null;
                const survHp = result.survivalHp.length > 0 ? hpStats(result.survivalHp) : null;
                return (
                  <>
                    <div className="cmp-stamina-results">
                      <span className="cmp-sr-label">Spurt rate</span>
                      <span className="cmp-sr-delta" />
                      <span className="cmp-stamina-num">{result.spurtRate.toFixed(0)}%</span>

                      <span className="cmp-sr-label">Stamina survival</span>
                      <span className="cmp-sr-delta" />
                      <span className="cmp-stamina-num">{result.survival.toFixed(0)}%</span>

                      <span className="cmp-sr-label">
                        Stamina needed for {result.spurtTarget}% full spurt rate
                      </span>
                      <span className="cmp-sr-delta" />
                      <span className="cmp-stamina-num">{fmtRequired(result.spurtReq)}</span>
                      {spurtHp && (
                        <span className="cmp-sr-subline small">
                          finish HP — min <HpNum n={spurtHp.min} /> · median <HpNum n={spurtHp.median} /> ·
                          mean <HpNum n={spurtHp.mean} /> · max <HpNum n={spurtHp.max} />
                        </span>
                      )}

                      <span className="cmp-sr-label">
                        Stamina needed for {result.survivalTarget}% stamina survival
                      </span>
                      <span className="cmp-sr-delta" />
                      <span className="cmp-stamina-num">{fmtRequired(result.survivalReq)}</span>
                      {survHp && (
                        <span className="cmp-sr-subline small">
                          finish HP — min <HpNum n={survHp.min} /> · median <HpNum n={survHp.median} /> ·
                          mean <HpNum n={survHp.mean} /> · max <HpNum n={survHp.max} />
                        </span>
                      )}
                    </div>

                    <p className="cmp-stamina-breakdown-title small">Breakdown (full spurt)</p>
                    <div className="cmp-stamina-results cmp-stamina-breakdown-grid">
                      <span className="cmp-sr-label">Base (no downhill)</span>
                      <span className="cmp-sr-delta" />
                      <span className="cmp-stamina-num">{fmtRequired(result.baseNo)}</span>

                      <span className="cmp-sr-label">Downhill saving</span>
                      <span className="cmp-sr-delta cmp-sr-save">{saving > 0 ? `0 to −${saving}` : ''}</span>
                      <span className="cmp-stamina-num">{fmtRange(result.downNo, result.baseNo)}</span>

                      {result.hasDebuffs && (
                        <>
                          <span className="cmp-sr-label">
                            Debuffs ({result.whiteDebuffs}W / {result.goldDebuffs}G)
                          </span>
                          <span className="cmp-sr-delta cmp-sr-cost">{cost > 0 ? `+${cost}` : ''}</span>
                          <span className="cmp-stamina-num">{fmtRequired(result.spurtReq)}</span>
                        </>
                      )}
                    </div>
                  </>
                );
              })()}

              {result.finalHp.length > 0 && <FinalHpHistogram finalHp={result.finalHp} />}
            </>
          )}
        </div>
      )}
    </section>
  );
}
