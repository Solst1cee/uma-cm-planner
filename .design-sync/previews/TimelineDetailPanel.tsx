// Preview stories for TimelineDetailPanel — detail aside for the selected
// timeline entry (badges + date/type fields + source link + what it feeds M4 +
// hand-confirm instructions for unconfirmed entries). Pure props.
import { TimelineDetailPanel } from 'uma-cm-planner';

const cmConfirmed = {
  id: 'cm15',
  type: 'cm',
  title: 'Cancer Cup',
  dates: { start: '2026-07-08', finals: '2026-07-15' },
  cm: { cmNumber: 15, courseId: '10906', trackSummary: 'Hanshin · Turf · 2200m' },
  tier: 'official',
  status: 'confirmed',
  source: { kind: 'official_news', url: 'https://umamusume.com/news/829/' },
  server: 'global',
  dataVersion: '2026-07',
};

const patchUnconfirmed = {
  id: 'patch-32',
  type: 'patch',
  title: 'Trackblazer scenario update',
  dates: { start: '2026-07-01' },
  patch: { version: '3.2.0', summary: 'New training scenario + balance pass' },
  tier: 'datamined',
  status: 'unconfirmed',
  source: { kind: 'datamine', url: '' },
  server: 'global',
  dataVersion: '2026-07',
};

const bannerConfirmed = {
  id: 'banner-kitasan',
  type: 'banner',
  title: 'Kitasan Black',
  dates: { start: '2026-07-10', end: '2026-07-24' },
  banner: { kind: 'char', umaId: '100201' },
  tier: 'official',
  status: 'confirmed',
  source: { kind: 'official_news', url: 'https://umamusume.com/news/831/' },
  server: 'global',
  dataVersion: '2026-07',
};

export const ChampionsMeeting = () => <TimelineDetailPanel entry={cmConfirmed} />;
export const PatchUnconfirmed = () => <TimelineDetailPanel entry={patchUnconfirmed} />;
export const Banner = () => <TimelineDetailPanel entry={bannerConfirmed} />;
export const EmptySelection = () => <TimelineDetailPanel entry={null} />;
