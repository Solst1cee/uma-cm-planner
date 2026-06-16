// Preview stories for TimelineEntryCard — a selectable timeline entry card
// (tier badge + title + headline date + one-line summary). Pure props; the
// card derives its badge/date/summary from the entry via @/core/timeline.
import { TimelineEntryCard } from 'uma-cm-planner';

const noop = () => {};

const cmEntry = {
  id: 'cm15',
  type: 'cm',
  title: 'Cancer Cup',
  dates: { finals: '2026-07-15' },
  cm: { cmNumber: 15, courseId: '10906', trackSummary: 'Hanshin · Turf · 2200m' },
  tier: 'official',
  status: 'confirmed',
  source: { kind: 'official_news', url: '' },
  server: 'global',
  dataVersion: '2026-07',
};

const bannerEntry = {
  id: 'banner-kitasan',
  type: 'banner',
  title: 'Kitasan Black',
  dates: { start: '2026-07-10', end: '2026-07-24' },
  banner: { kind: 'char', umaId: '100201' },
  tier: 'official',
  status: 'confirmed',
  source: { kind: 'official_news', url: '' },
  server: 'global',
  dataVersion: '2026-07',
};

const patchEntry = {
  id: 'patch-32',
  type: 'patch',
  title: 'Trackblazer scenario update',
  dates: { start: '2026-07-01' },
  patch: { version: '3.2.0', summary: 'New training scenario' },
  tier: 'datamined',
  status: 'unconfirmed',
  source: { kind: 'datamine', url: '' },
  server: 'global',
  dataVersion: '2026-07',
};

const predictedEntry = {
  id: 'cm16',
  type: 'cm',
  title: 'Leo Cup (predicted)',
  dates: {},
  cm: { cmNumber: 16 },
  tier: 'prediction',
  status: 'unconfirmed',
  source: { kind: 'manual', url: '' },
  server: 'global',
  dataVersion: 'forecast',
};

// The current CM the Skill Planner targets — gets the "→ M4" tag + current styling.
export const CurrentCm = () => (
  <TimelineEntryCard entry={cmEntry} selected past={false} current onSelect={noop} />
);

export const Selectable = () => (
  <TimelineEntryCard entry={cmEntry} selected={false} past={false} current={false} onSelect={noop} />
);

export const CharacterBanner = () => (
  <TimelineEntryCard entry={bannerEntry} selected={false} past={false} current={false} onSelect={noop} />
);

export const PatchUnconfirmed = () => (
  <TimelineEntryCard entry={patchEntry} selected={false} past={false} current={false} onSelect={noop} />
);

export const Past = () => (
  <TimelineEntryCard entry={cmEntry} selected={false} past current={false} onSelect={noop} />
);

export const Predicted = () => (
  <TimelineEntryCard entry={predictedEntry} selected={false} past={false} current={false} onSelect={noop} />
);
