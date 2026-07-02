/**
 * Header planning-horizon lens: Current | CM ▾ | All JP segmented control
 * (ThemeToggle's ds-seg/ds-miniseg pattern), a foresight-calibration "?"
 * tooltip, and — exported alongside — the HorizonBanner hypothetical-horizon
 * strip shown when `horizon.kind === 'allJp'`. Self-contained: both read
 * useAvailability()/useGameData() directly, no props.
 */
import { useRef, useState } from 'react';
import { useAvailability } from '@/app/useAvailability';
import { useGameData } from '@/features/data/gameData';
import { useDismissOnOutside } from '@/features/cm-planner/useDismissOnOutside';
import type { ForesightInfo } from '@/core/types';

function foresightSentence(foresight: ForesightInfo | null | undefined): string {
  if (!foresight) return 'Foresight projection unavailable — too few shared CMs.';
  const years = Math.round((foresight.gapDays / 365.25) * 10) / 10;
  return (
    `JP is ${foresight.gapDays} days (~${years}y) ahead of Global; ` +
    `Global has been running at ${foresight.pace.toFixed(2)}× JP's pace ` +
    `over the last ${foresight.windowSteps} shared CMs.`
  );
}

export function HorizonControl() {
  const { horizon, setHorizon, futureCms } = useAvailability();
  const { foresight } = useGameData();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useDismissOnOutside(containerRef, menuOpen, () => setMenuOpen(false), { esc: true });

  const chosenCm = horizon.kind === 'cm' ? futureCms.find((c) => c.cmNumber === horizon.cmNumber) : undefined;
  const cmLabel = chosenCm ? `${chosenCm.title}${chosenCm.predicted ? ' ~' : ''}` : 'CM';

  const pick = (cmNumber: number) => {
    setHorizon({ kind: 'cm', cmNumber });
    setMenuOpen(false);
  };

  return (
    <div className="horizon-control" ref={containerRef}>
      <div className="ds-seg ds-miniseg" role="group" aria-label="Planning horizon">
        <button
          type="button"
          className={horizon.kind === 'current' ? 'on' : undefined}
          aria-pressed={horizon.kind === 'current'}
          onClick={() => {
            setHorizon({ kind: 'current' });
            setMenuOpen(false);
          }}
        >
          Current
        </button>
        <button
          type="button"
          className={horizon.kind === 'cm' ? 'on' : undefined}
          aria-pressed={horizon.kind === 'cm'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {cmLabel}
        </button>
        <button
          type="button"
          className={horizon.kind === 'allJp' ? 'on' : undefined}
          aria-pressed={horizon.kind === 'allJp'}
          onClick={() => {
            setHorizon({ kind: 'allJp' });
            setMenuOpen(false);
          }}
        >
          All JP
        </button>
      </div>
      {menuOpen && (
        <ul className="horizon-menu">
          {futureCms.length === 0 && <li className="horizon-menu-empty">No upcoming CMs on the timeline.</li>}
          {futureCms.map((cm) => (
            <li key={cm.cmNumber}>
              <button type="button" onClick={() => pick(cm.cmNumber)}>
                {`${cm.cmNumber} ${cm.title} · ${cm.predicted ? '~' : ''}${cm.date}`}
              </button>
            </li>
          ))}
        </ul>
      )}
      <span className="horizon-help" title={foresightSentence(foresight)} aria-label={foresightSentence(foresight)}>
        ?
      </span>
    </div>
  );
}

/** Hypothetical-horizon warning strip — visible only under `horizon.kind === 'allJp'`. */
export function HorizonBanner() {
  const { horizon, planCmISO } = useAvailability();
  if (horizon.kind !== 'allJp') return null;
  return (
    <div className="horizon-banner" role="alert">
      Hypothetical horizon — includes JP content not achievable by {planCmISO}; results are for
      scouting, not this CM.
    </div>
  );
}
