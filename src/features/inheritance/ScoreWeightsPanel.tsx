// src/features/inheritance/ScoreWeightsPanel.tsx
/** M1.6 — provider-free scoring weights panel (mirrors euophrys Weights.jsx). */
import { useState } from 'react';
import type { UmaTiersScenario } from '@/vendor/uma-tiers/index';
import {
  TYPE_TABS,
  type TypeKey,
  setStatWeight,
  setStatField,
  setGeneral,
  setGeneralArray,
  setUmaBonus,
} from './weightsPanelModel';

interface Props {
  scenario: UmaTiersScenario;
  onChange: (next: UmaTiersScenario) => void;
  onReset: () => void;
}

/** Labels for the 7 stat-weight inputs (index matches stats array). */
const STAT_WEIGHT_LABELS = [
  'Speed', 'Stamina', 'Power', 'Guts', 'Wit', 'Skill Pts', 'Energy',
] as const;

/** Labels for the 5 uma bonus inputs (spd/sta/pow/guts/wis). */
const UMA_BONUS_LABELS = ['Speed', 'Stamina', 'Power', 'Guts', 'Wisdom'] as const;

/** Races labels: G1 / G2-3 / OP (3 editable slots; races[3] is fixed by scenario). */
const RACE_LABELS = ['G1', 'G2-3', 'OP'] as const;

export function ScoreWeightsPanel({ scenario, onChange, onReset }: Props) {
  const [currentState, setCurrentState] = useState<TypeKey>('speed');
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(true);

  const activeType = scenario[currentState] as {
    stats: number[];
    cap: number;
    minimum: number;
    prioritize?: boolean;
    onlySummer?: boolean;
  };

  return (
    <div className="inh-deck inh-weights">
      {/* Card head with collapse */}
      <div
        className="inh-deck-head"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen((v) => !v)}
      >
        <span style={{ flex: 1 }}>Scoring weights</span>
        <span className="inh-weights-caret" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </div>

      {open && (
        <div className="inh-deck-body inh-weights-body">
          {/* Type tabs */}
          <div className="inh-weights-tabs" role="group" aria-label="Training type">
            {TYPE_TABS.map(({ key, label }) => (
              <button
                key={key}
                aria-pressed={currentState === key}
                className={`inh-weights-tab${currentState === key ? ' is-active' : ''}`}
                onClick={() => setCurrentState(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Customize settings toggle */}
          <div className="inh-weights-customize-row">
            <button
              className="inh-weights-toggle"
              aria-expanded={show}
              onClick={() => setShow((v) => !v)}
            >
              Customize settings {show ? '▴' : '▾'}
            </button>
          </div>

          {show && (
            <div className="inh-weights-customize">
              {/* Bond Rate */}
              <div className="inh-weights-field">
                <label htmlFor="inh-wt-bond-rate">Bond rate</label>
                <input
                  id="inh-wt-bond-rate"
                  type="number"
                  aria-label="Bond rate"
                  min={1}
                  max={40}
                  step={0.5}
                  value={scenario.general.bondPerDay}
                  onChange={(e) => onChange(setGeneral(scenario, 'bondPerDay', parseFloat(e.target.value)))}
                />
              </div>

              {/* Races: 4 numbers */}
              <div className="inh-weights-field-group">
                <span className="inh-weights-group-label">Optional races</span>
                <div className="inh-weights-row">
                  {RACE_LABELS.map((label, i) => (
                    <div key={label} className="inh-weights-field inh-weights-field-sm">
                      <label htmlFor={`inh-wt-race-${i}`}>{label}</label>
                      <input
                        id={`inh-wt-race-${i}`}
                        type="number"
                        aria-label={`${label} races`}
                        min={0}
                        max={30}
                        step={1}
                        value={(scenario.general.races as number[])[i] ?? 0}
                        onChange={(e) =>
                          onChange(setGeneralArray(scenario, 'races', i, Number(e.target.value)))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Multiplier + Spec Bonus */}
              <div className="inh-weights-row">
                <div className="inh-weights-field">
                  <label htmlFor="inh-wt-multi">Multiplier</label>
                  <input
                    id="inh-wt-multi"
                    type="number"
                    aria-label="Multiplier"
                    min={1}
                    max={2.2}
                    step={0.05}
                    value={scenario.general.multi}
                    onChange={(e) => onChange(setGeneral(scenario, 'multi', parseFloat(e.target.value)))}
                  />
                </div>
                <div className="inh-weights-field">
                  <label htmlFor="inh-wt-bonus-spec">Spec bonus</label>
                  <input
                    id="inh-wt-bonus-spec"
                    type="number"
                    aria-label="Spec bonus"
                    min={-1}
                    max={95}
                    step={5}
                    value={scenario.general.bonusSpec}
                    onChange={(e) =>
                      onChange(setGeneral(scenario, 'bonusSpec', parseFloat(e.target.value)))
                    }
                  />
                </div>
              </div>

              {/* 7 Stat Weights for the active type */}
              <div className="inh-weights-field-group">
                <span className="inh-weights-group-label">Stat weights</span>
                <div className="inh-weights-stat-weights">
                  {STAT_WEIGHT_LABELS.map((label, i) => {
                    const statVal = activeType.stats[i] ?? 0;
                    const inputId = `inh-wt-stat-${currentState}-${i}`;
                    const ariaLabel = `${label} weight`;
                    return (
                      <div key={label} className="inh-weights-field inh-weights-field-sm">
                        <label htmlFor={inputId}>{ariaLabel}</label>
                        <input
                          id={inputId}
                          type="number"
                          aria-label={ariaLabel}
                          min={0}
                          max={3}
                          step={0.1}
                          value={statVal}
                          onChange={(e) =>
                            onChange(setStatWeight(scenario, currentState, i, parseFloat(e.target.value)))
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Motivation slider */}
              <div className="inh-weights-field">
                <label htmlFor="inh-wt-motivation">
                  Motivation ({Math.round(scenario.general.motivation * 100)}%)
                </label>
                <input
                  id="inh-wt-motivation"
                  type="range"
                  aria-label="Motivation"
                  min={-0.2}
                  max={0.2}
                  step={0.05}
                  value={scenario.general.motivation}
                  onChange={(e) =>
                    onChange(setGeneral(scenario, 'motivation', parseFloat(e.target.value)))
                  }
                />
              </div>

              {/* Stat Cap slider */}
              <div className="inh-weights-field">
                <label htmlFor="inh-wt-cap">
                  Stat cap ({activeType.cap})
                </label>
                <input
                  id="inh-wt-cap"
                  type="range"
                  aria-label="Stat cap"
                  min={300}
                  max={1000}
                  step={20}
                  value={activeType.cap}
                  onChange={(e) =>
                    onChange(setStatField(scenario, currentState, 'cap', Number(e.target.value)))
                  }
                />
              </div>

              {/* Min Train Score slider */}
              <div className="inh-weights-field">
                <label htmlFor="inh-wt-minimum">
                  Min train score ({activeType.minimum})
                </label>
                <input
                  id="inh-wt-minimum"
                  type="range"
                  aria-label="Min train score"
                  min={0}
                  max={50}
                  step={1}
                  value={activeType.minimum}
                  onChange={(e) =>
                    onChange(setStatField(scenario, currentState, 'minimum', Number(e.target.value)))
                  }
                />
              </div>

              {/* Prioritize + Only-Summer (non-friend types only) */}
              {currentState !== 'friend' && (
                <div className="inh-weights-checkboxes">
                  <label className="inh-weights-checkbox-label">
                    <input
                      type="checkbox"
                      aria-label="Prioritize"
                      checked={activeType.prioritize ?? false}
                      onChange={(e) =>
                        onChange(setStatField(scenario, currentState, 'prioritize', e.target.checked))
                      }
                    />
                    Prioritize
                  </label>
                  <label className="inh-weights-checkbox-label">
                    <input
                      type="checkbox"
                      aria-label="Only summer"
                      checked={activeType.onlySummer ?? false}
                      onChange={(e) =>
                        onChange(setStatField(scenario, currentState, 'onlySummer', e.target.checked))
                      }
                    />
                    Only summer
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Uma's Bonuses — always shown, outside the show gate */}
          <div className="inh-weights-uma-bonuses">
            <span className="inh-weights-group-label">Uma's Bonuses</span>
            <div className="inh-weights-row">
              {UMA_BONUS_LABELS.map((label, i) => {
                const bonusVal = scenario.general.umaBonus[i] ?? 1;
                const inputId = `inh-wt-uma-bonus-${i}`;
                const ariaLabel = `${label} uma bonus`;
                return (
                  <div key={label} className="inh-weights-field inh-weights-field-sm">
                    <label htmlFor={inputId}>{label}</label>
                    <input
                      id={inputId}
                      type="number"
                      aria-label={ariaLabel}
                      min={0.7}
                      max={1.3}
                      step={0.01}
                      value={bonusVal}
                      onChange={(e) =>
                        onChange(setUmaBonus(scenario, i, parseFloat(e.target.value)))
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reset + caption */}
          <div className="inh-weights-footer">
            <button className="inh-weights-reset" onClick={onReset}>
              Reset to defaults
            </button>
            <p className="inh-weights-caption">
              Training power · URA scenario · via{' '}
              <a
                href="https://euophrys.github.io/uma-tiers/#/global"
                target="_blank"
                rel="noreferrer"
              >
                euophrys
              </a>{' '}
              — affects the Effect score only.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
