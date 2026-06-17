/**
 * Race-setup chooser (M4 §0) — ONE panel. The track controls (Track / Surface /
 * Distance / Ground / Weather / Season) are always shown. A Preset dropdown
 * fills them from a CM; editing any field so it no longer matches that CM resets
 * the preset to "— Custom —". Emits the resolved RaceSelection via onChange.
 *
 * Note: only Track + distance (→ courseId) changes the rendered track geometry;
 * ground / weather / season feed the simulation later, not the static diagram.
 */
import { useEffect, useRef, useState } from 'react';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';
import { PRESETS, type Ground, type RacePreset, type Season, type Weather } from './presets';
import { TRACKS, coursesForTrackSurface, surfacesForTrack } from './trackCatalog';
import {
  cap,
  courseToSelection,
  formatDistanceWithLayout,
  presetToSelection,
  type RaceSelection,
} from './selection';

const GROUNDS: Ground[] = ['firm', 'good', 'soft', 'heavy'];
const WEATHERS: Weather[] = ['sunny', 'cloudy', 'rainy', 'snowy'];
const SEASONS: Season[] = ['spring', 'summer', 'fall', 'winter'];

interface Fields {
  trackId: number;
  surface: 'turf' | 'dirt';
  courseId: string;
  ground: Ground;
  weather: Weather;
  season: Season;
}

function fieldsFromPreset(p: RacePreset): Fields {
  return {
    trackId: TRACKS.find((t) => t.name === p.racetrack)?.raceTrackId ?? TRACKS[0]!.raceTrackId,
    surface: p.surface,
    courseId: p.courseId,
    ground: p.ground,
    weather: p.weather,
    season: p.season,
  };
}

/** The preset whose course + conditions exactly match the current fields, if any. */
function matchPreset(f: Fields): RacePreset | undefined {
  return PRESETS.find(
    (p) =>
      p.courseId === f.courseId &&
      p.ground === f.ground &&
      p.weather === f.weather &&
      p.season === f.season,
  );
}

function resolveSelection(f: Fields, catalog: CourseCatalogEntry[] | null): RaceSelection | null {
  const m = matchPreset(f);
  if (m) return presetToSelection(m);
  const course = catalog?.find((c) => c.courseId === f.courseId);
  if (course) return courseToSelection(course, { ground: f.ground, weather: f.weather, season: f.season });
  return null;
}

interface RaceSetupProps {
  onChange: (sel: RaceSelection) => void;
  selection?: RaceSelection;
  deps?: { loadCatalog: () => Promise<CourseCatalogEntry[]> };
}

const defaultLoadCatalog = (): Promise<CourseCatalogEntry[]> =>
  import('@/sim/courseCatalog').then((m) => m.courseCatalog());

function fieldsFromSelection(selection: RaceSelection): Fields {
  return {
    trackId: TRACKS.find((track) => track.name === selection.racetrack)?.raceTrackId ?? TRACKS[0]!.raceTrackId,
    surface: selection.surface,
    courseId: selection.courseId,
    ground: selection.ground,
    weather: selection.weather,
    season: selection.season,
  };
}

function sameFields(a: Fields, b: Fields): boolean {
  return (
    a.trackId === b.trackId &&
    a.surface === b.surface &&
    a.courseId === b.courseId &&
    a.ground === b.ground &&
    a.weather === b.weather &&
    a.season === b.season
  );
}

export function RaceSetup({ onChange, selection, deps }: RaceSetupProps) {
  const loadCatalog = deps?.loadCatalog ?? defaultLoadCatalog;
  const [fields, setFields] = useState<Fields>(() =>
    selection ? fieldsFromSelection(selection) : fieldsFromPreset(PRESETS[0]!),
  );
  const [catalog, setCatalog] = useState<CourseCatalogEntry[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  // Emit the initial selection once (matched preset needs no catalog).
  const emitted = useRef(false);
  useEffect(() => {
    if (selection || emitted.current) return;
    emitted.current = true;
    const sel = resolveSelection(fields, null);
    if (sel) onChange(sel);
  }, [fields, onChange, selection]);

  useEffect(() => {
    if (!selection) return;
    const next = fieldsFromSelection(selection);
    setFields((current) => (sameFields(current, next) ? current : next));
  }, [selection]);

  // Load the course catalog (powers the Track → Surface → Distance cascade).
  useEffect(() => {
    let cancelled = false;
    loadCatalog()
      .then((c) => {
        if (!cancelled) setCatalog(c);
      })
      .catch((e: unknown) => {
        if (!cancelled) setCatalogError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [loadCatalog]);

  const apply = (next: Fields) => {
    const sel = resolveSelection(next, catalog);
    if (!sel) return; // unresolvable (empty/malformed catalog) — keep fields ↔ emitted selection in sync
    setFields(next);
    onChange(sel);
  };

  const onPreset = (cmId: string) => {
    const p = PRESETS.find((x) => x.cmId === cmId);
    if (p) apply(fieldsFromPreset(p)); // '' (— Custom —) keeps the current fields
  };

  const onTrack = (trackId: number) => {
    if (!catalog || catalog.length === 0) return;
    const surface = surfacesForTrack(catalog, trackId)[0] ?? 'turf';
    const courseId = coursesForTrackSurface(catalog, trackId, surface)[0]?.courseId ?? '';
    apply({ ...fields, trackId, surface, courseId });
  };

  const onSurface = (surface: 'turf' | 'dirt') => {
    if (!catalog || catalog.length === 0) return;
    const courseId = coursesForTrackSurface(catalog, fields.trackId, surface)[0]?.courseId ?? '';
    apply({ ...fields, surface, courseId });
  };

  const matched = matchPreset(fields);
  const sel = resolveSelection(fields, catalog) ?? presetToSelection(PRESETS[0]!);
  const ready = catalog != null && catalog.length > 0;
  const surfaceOptions = catalog ? surfacesForTrack(catalog, fields.trackId) : [];
  const distanceOptions = catalog ? coursesForTrackSurface(catalog, fields.trackId, fields.surface) : [];

  return (
    <section className="cmp-plan-card cmp-setup" aria-labelledby="setup-h">
      <header
        className="cmp-plan-card-head cmp-collapse-head"
        id="setup-h"
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
        <span>Race setup</span>
        <span className="cmp-collapse-caret" data-open={open || undefined} aria-hidden="true" />
      </header>

      {open && (
      <div className="cmp-plan-card-body cmp-setup-body">

      <div className="cmp-custom">
        <label className="cmp-field cmp-preset">
          <span className="cmp-field-label">Preset</span>
          <select aria-label="CM preset" value={matched?.cmId ?? ''} onChange={(e) => onPreset(e.target.value)}>
            <option value="">— Custom —</option>
            {PRESETS.map((p) => (
              <option key={p.cmId} value={p.cmId}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="cmp-field">
          <span className="cmp-field-label">Track</span>
          <select
            aria-label="Track"
            value={String(fields.trackId)}
            disabled={!ready}
            onChange={(e) => onTrack(Number(e.target.value))}
          >
            {TRACKS.map((t) => (
              <option key={t.raceTrackId} value={String(t.raceTrackId)}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="cmp-field">
          <span className="cmp-field-label">Surface</span>
          <select
            aria-label="Surface"
            value={fields.surface}
            disabled={!ready}
            onChange={(e) => onSurface(e.target.value as 'turf' | 'dirt')}
          >
            {(surfaceOptions.length ? surfaceOptions : [fields.surface]).map((s) => (
              <option key={s} value={s}>
                {cap(s)}
              </option>
            ))}
          </select>
        </label>

        <label className="cmp-field">
          <span className="cmp-field-label">Distance</span>
          <select
            aria-label="Distance"
            value={fields.courseId}
            disabled={!ready}
            onChange={(e) => apply({ ...fields, courseId: e.target.value })}
          >
            {distanceOptions.length ? (
              distanceOptions.map((c) => (
                <option key={c.courseId} value={c.courseId}>
                  {formatDistanceWithLayout(courseToSelection(c, { ground: fields.ground, weather: fields.weather, season: fields.season }))}
                </option>
              ))
            ) : (
              <option value={fields.courseId}>{formatDistanceWithLayout(sel)}</option>
            )}
          </select>
        </label>

        <label className="cmp-field">
          <span className="cmp-field-label">Ground</span>
          <select
            aria-label="Ground"
            value={fields.ground}
            onChange={(e) => apply({ ...fields, ground: e.target.value as Ground })}
          >
            {GROUNDS.map((g) => (
              <option key={g} value={g}>
                {cap(g)}
              </option>
            ))}
          </select>
        </label>

        <label className="cmp-field">
          <span className="cmp-field-label">Weather</span>
          <select
            aria-label="Weather"
            value={fields.weather}
            onChange={(e) => apply({ ...fields, weather: e.target.value as Weather })}
          >
            {WEATHERS.map((w) => (
              <option key={w} value={w}>
                {cap(w)}
              </option>
            ))}
          </select>
        </label>

        <label className="cmp-field">
          <span className="cmp-field-label">Season</span>
          <select
            aria-label="Season"
            value={fields.season}
            onChange={(e) => apply({ ...fields, season: e.target.value as Season })}
          >
            {SEASONS.map((s) => (
              <option key={s} value={s}>
                {cap(s)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {catalogError && <p className="muted small">Track list unavailable: {catalogError}</p>}
      </div>
      )}
    </section>
  );
}
