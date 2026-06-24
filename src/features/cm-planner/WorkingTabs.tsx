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
  const [visited, setVisited] = useState<Set<TabKey>>(() => new Set([initial ?? tabs[0]!.key]));

  const select = (key: TabKey) => {
    setActive(key);
    setVisited((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  };

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
            aria-controls={`${PANEL_ID}-${t.key}`}
            className={t.key === active ? 'on' : ''}
            onClick={() => select(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs
        .filter((t) => visited.has(t.key))
        .map((t) => (
          <div
            key={t.key}
            id={`${PANEL_ID}-${t.key}`}
            className="cmp-tab-body"
            role="tabpanel"
            aria-labelledby={`cmp-tab-${t.key}`}
            hidden={t.key !== active}
          >
            {t.node}
          </div>
        ))}
    </section>
  );
}
