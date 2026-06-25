// src/features/inheritance/UmaPlanCard.tsx
/** M1 "Your uma plan" card (handoff README §"1. Your uma plan panel").
 *  Provider-free: the portrait + each picker item's icon are passed in as
 *  ReactNodes by the page (GameIcon needs the GameData provider, which this
 *  component must not require so it stays unit-testable). */
import { useState, type ReactNode } from 'react';
import { SearchPicker, type SearchItem } from '@/features/parents/SearchPicker';
import type { AptChip } from './umaPlanApt';

export interface UmaPlanCardProps {
  name: string;
  epithet?: string;
  portrait: ReactNode;
  aptChips: AptChip[];
  umaItems: SearchItem[];
  onPickUma: (umaId: string) => void;
}

export function UmaPlanCard({ name, epithet, portrait, aptChips, umaItems, onPickUma }: UmaPlanCardProps) {
  const [picking, setPicking] = useState(false);
  return (
    <div className="panel inh-uma-card">
      <div className="inh-uma-main">
        <span className="inh-uma-portrait">{portrait}</span>
        <div className="inh-uma-meta">
          <span className="inh-uma-name">{name}</span>
          {epithet && <span className="inh-uma-epithet">{epithet}</span>}
        </div>
        <button type="button" className="cmp-small-btn inh-uma-change" onClick={() => setPicking((p) => !p)}>
          {picking ? 'Close' : 'Change'}
        </button>
      </div>
      {aptChips.length > 0 && (
        <div className="spark-chips inh-uma-apts">
          {aptChips.map((c) => (
            <span key={c.label} className="badge spark-pink">
              {c.label} {c.grade}
            </span>
          ))}
        </div>
      )}
      {picking && (
        <div className="inh-uma-picker">
          <SearchPicker
            label="Swap plan uma"
            placeholder="Search uma…"
            items={umaItems}
            onPick={(id) => {
              onPickUma(id);
              setPicking(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
