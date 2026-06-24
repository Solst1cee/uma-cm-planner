import { useState, type ReactNode } from 'react';

export type TabKey = 'unique' | 'stamina' | 'accel' | 'skills' | 'minisim';

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
            role="tab"
            type="button"
            aria-selected={t.key === active}
            className={t.key === active ? 'on' : ''}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="cmp-tab-body" role="tabpanel">
        {current.node}
      </div>
    </section>
  );
}
