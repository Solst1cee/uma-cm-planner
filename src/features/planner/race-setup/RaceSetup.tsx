/**
 * Race-setup chooser (M4 §0). Preset ⇄ Custom:
 *  - Preset: pick a CM (CM15/CM16) — auto-fills track + conditions.
 *  - Custom: Track → Surface → Distance cascade (from the engine course catalog)
 *    + Ground / Weather / Season.
 * Emits the resolved RaceSelection via onChange (incl. the initial on mount).
 *
 * Note: only Track + distance (→ courseId) changes the rendered track geometry;
 * ground/weather/season feed the sim later, not the static track diagram.
 */
import { useEffect, useRef, useState } from 'react';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';
import { PRESETS, type Ground, type Season, type Weather } from './presets';
import { TRACKS, coursesForTrackSurface, surfacesForTrack } from './trackCatalog';
import {
  courseToSelection,
  describeSelection,
  presetToSelection,
  type RaceSelection,
} from './selection';

const GROUNDS: Ground[] = ['firm', 'good', 'soft', 'heavy'];
const WEATHERS: Weather[] = ['sunny', 'cloudy', 'rainy', 'snowy'];
const SEASONS: Season[] = ['spring', 'summer', 'fall', 'winter'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface RaceSetupProps {
  initial?: RaceSelection;
  onChange: (sel: RaceSelection) => void;
  deps?: { loadCatalog: () => Promise<CourseCatalogEntry[]> };
}

const defaultLoadCatalog = (): Promise<CourseCatalogEntry[]> =>
  import('@/sim/courseCatalog').then((m) => m.courseCatalog());

export function RaceSetup({ initial, onChange, deps }: RaceSetupProps) {
  const loadCatalog = deps?.loadCatalog ?? defaultLoadCatalog;
  const [initialSel] = useState<RaceSelection>(() => initial ?? presetToSelection(PRESETS[0]!));

  const [mode, setMode] = useState<'preset' | 'custom'>(initialSel.presetCmId ? 'preset' : 'custom');
  const [presetCmId, setPresetCmId] = useState(initialSel.presetCmId ?? PRESETS[0]!.cmId);
  const [sel, setSel] = useState<RaceSelection>(initialSel);

  const [catalog, setCatalog] = useState<CourseCatalogEntry[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [trackId, setTrackId] = useState<number>(
    () => TRACKS.find((t) => t.name === initialSel.racetrack)?.raceTrackId ?? TRACKS[0]!.raceTrackId,
  );
  const [surface, setSurface] = useState<'turf' | 'dirt'>(initialSel.surface);
  const [courseId, setCourseId] = useState<string>(initialSel.courseId);
  const [ground, setGround] = useState<Ground>(initialSel.ground);
  const [weather, setWeather] = useState<Weather>(initialSel.weather);
  const [season, setSeason] = useState<Season>(initialSel.season);

  const emit = (next: RaceSelection) => {
    setSel(next);
    onChange(next);
  };

  // Emit the initial selection once, so the parent/track start from it.
  const emitted = useRef(false);
  useEffect(() => {
    if (emitted.current) return;
    emitted.current = true;
    onChange(initialSel);
  }, [initialSel, onChange]);

  // Lazy-load the course catalog the first time custom mode is shown.
  useEffect(() => {
    if (mode !== 'custom' || catalog) return;
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
  }, [mode, catalog, loadCatalog]);

  const choosePreset = (cmId: string) => {
    const p = PRESETS.find((x) => x.cmId === cmId) ?? PRESETS[0]!;
    setPresetCmId(p.cmId);
    emit(presetToSelection(p));
  };

  const goCustom = () => {
    // Seed the custom fields from the current selection so it continues from here.
    setTrackId(TRACKS.find((t) => t.name === sel.racetrack)?.raceTrackId ?? trackId);
    setSurface(sel.surface);
    setCourseId(sel.courseId);
    setGround(sel.ground);
    setWeather(sel.weather);
    setSeason(sel.season);
    setMode('custom');
  };

  const goPreset = () => {
    setMode('preset');
    choosePreset(presetCmId);
  };

  // Recompute + emit a custom selection from the current fields (+ overrides).
  const updateCustom = (
    over: Partial<{
      trackId: number;
      surface: 'turf' | 'dirt';
      courseId: string;
      ground: Ground;
      weather: Weather;
      season: Season;
    }>,
  ) => {
    if (!catalog) return;
    const tId = over.trackId ?? trackId;
    let surf = over.surface ?? surface;
    let cId = over.courseId ?? courseId;
    const g = over.ground ?? ground;
    const w = over.weather ?? weather;
    const s = over.season ?? season;

    if (over.trackId !== undefined) {
      surf = surfacesForTrack(catalog, tId)[0] ?? 'turf';
      cId = coursesForTrackSurface(catalog, tId, surf)[0]?.courseId ?? '';
    } else if (over.surface !== undefined) {
      cId = coursesForTrackSurface(catalog, tId, surf)[0]?.courseId ?? '';
    }

    setTrackId(tId);
    setSurface(surf);
    setCourseId(cId);
    setGround(g);
    setWeather(w);
    setSeason(s);

    const course = catalog.find((c) => c.courseId === cId);
    if (course) emit(courseToSelection(course, { ground: g, weather: w, season: s }));
  };

  const surfaceOptions = catalog ? surfacesForTrack(catalog, trackId) : [];
  const distanceOptions = catalog ? coursesForTrackSurface(catalog, trackId, surface) : [];

  return (
    <section className="panel cmp-setup" aria-labelledby="setup-h">
      <h2 id="setup-h">Race setup</h2>

      <div className="cmp-mode" role="group" aria-label="Setup mode">
        <button type="button" className="chip" aria-pressed={mode === 'preset'} onClick={goPreset}>
          Preset
        </button>
        <button type="button" className="chip" aria-pressed={mode === 'custom'} onClick={goCustom}>
          Custom
        </button>
      </div>

      {mode === 'preset' ? (
        <label className="cmp-field">
          <span className="cmp-field-label">CM preset</span>
          <select
            aria-label="CM preset"
            value={presetCmId}
            onChange={(e) => choosePreset(e.target.value)}
          >
            {PRESETS.map((p) => (
              <option key={p.cmId} value={p.cmId}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      ) : catalogError ? (
        <p className="muted">Track list unavailable: {catalogError}</p>
      ) : !catalog ? (
        <p className="muted small">Loading tracks…</p>
      ) : (
        <div className="cmp-custom">
          <label className="cmp-field">
            <span className="cmp-field-label">Track</span>
            <select
              aria-label="Track"
              value={String(trackId)}
              onChange={(e) => updateCustom({ trackId: Number(e.target.value) })}
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
              value={surface}
              onChange={(e) => updateCustom({ surface: e.target.value as 'turf' | 'dirt' })}
            >
              {surfaceOptions.map((s) => (
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
              value={courseId}
              onChange={(e) => updateCustom({ courseId: e.target.value })}
            >
              {distanceOptions.map((c) => (
                <option key={c.courseId} value={c.courseId}>
                  {c.distance.toLocaleString('en-US')}m ({cap(c.distanceClass)})
                </option>
              ))}
            </select>
          </label>

          <label className="cmp-field">
            <span className="cmp-field-label">Ground</span>
            <select
              aria-label="Ground"
              value={ground}
              onChange={(e) => updateCustom({ ground: e.target.value as Ground })}
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
              value={weather}
              onChange={(e) => updateCustom({ weather: e.target.value as Weather })}
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
              value={season}
              onChange={(e) => updateCustom({ season: e.target.value as Season })}
            >
              {SEASONS.map((s) => (
                <option key={s} value={s}>
                  {cap(s)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="cmp-conditions" aria-label="Race conditions">
        {describeSelection(sel).map((chip) => (
          <span key={chip} className="cmp-chip">
            {chip}
          </span>
        ))}
      </div>
      <p className="muted small">
        Track + distance set the course; ground / weather / season feed the simulation (they
        don&apos;t change the track diagram).
      </p>
    </section>
  );
}
