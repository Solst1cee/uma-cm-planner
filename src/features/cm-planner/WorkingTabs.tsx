import { useState, type ReactNode } from 'react';

export type TabKey = 'unique' | 'stamina' | 'accel' | 'skills' | 'minisim';

const PANEL_ID = 'cmp-working-tabpanel';

export function WorkingTabs({
  tabs,
  initial,
}: {
  tabs: { key: TabKey; label: string; node: ReactNode }[];
  initial?: TabKey;
}) {
  const [active, setActive] = useState<TabKey>(initial ?? tabs[0]!.key);
  const current = tabs.find((t) => t.key === active) ?? tabs[0]!;
  return (
    <section className="cmp-plan-card cmp-tabs-card">
      <div className="cmp-tabstrip" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            id={`cmp-tab-${t.key}`}
            role="tab"
            type="button"
            aria-selected={t.key === active}
            aria-controls={PANEL_ID}
            className={t.key === active ? 'on' : ''}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        id={PANEL_ID}
        className="cmp-tab-body"
        role="tabpanel"
        aria-labelledby={`cmp-tab-${current.key}`}
      >
        {current.node}
      </div>
    </section>
  );
}
