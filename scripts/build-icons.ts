/**
 * public/data/icons/ — a curated, Global-only WebP icon subset (plan §4
 * "Image assets" sourcing decision; docs/provenance.md §2). Bundled for full
 * offline use (P2); NOT hotlinked, NOT the 415 MB wholesale dump.
 *
 * Source dump: spikes/repos/uma-tools/icons/ (GITIGNORED — present only on a
 * local dev machine, never in CI). The icon PNGs are Cygames property included
 * under the fair-use/asset-exclusion notice (NOTICE.md), outside the GPL grant.
 *
 * Inputs (read AFTER skills/cards/umas JSON are written by build-all):
 *   public/data/skills.json   → iconId (deduped; ~56 distinct cover all 578)
 *   public/data/support_cards.json → cardId
 *   public/data/umas.json     → umaId + charaId
 *
 * Outputs (git-tracked, generated — never hand-edit, P5):
 *   public/data/icons/skill/<iconId>.webp     (56)
 *   public/data/icons/support/<cardId>.webp   (220)
 *   public/data/icons/uma/<umaId>.webp        (84)
 *   public/data/icons/icon-manifest.json      (contract, below)
 *
 * Filename templates in the source dump (provenance §2 / spikes/image-ui-research.json):
 *   skill   → skill/utx_ico_skill_<iconId.padStart(5,'0')>.png
 *   support → support/support_card_s_<cardId>.png   (256px, has rarity badge)
 *             ⚠ 30024 / 30061 ship ONLY as uppercase `Support_card_s_…` →
 *             lowercase on output (case-sensitive-host 404 hazard).
 *   uma     → chara/trained_chr_icon_<charaId>_<iconAssetId>_02.png (gold frame) when
 *             present, else fall back to chara/chr_icon_<charaId>.png (base
 *             portrait). Some Global alt outfits use a different icon asset id.
 *
 * GUARD: if the spikes dump is absent (CI), LOG a warning and SKIP — existing
 * committed public/data/icons/ stays intact, and data:build's other 5 outputs
 * still build. Regeneration requires the local dump.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import sharp from 'sharp';
import type { SkillRecord, SupportCardRecord, UmaRecord } from '@/core/types';
import { PUBLIC_DATA_DIR, readJson, REPO_ROOT, writeJsonDeterministic } from './lib/io';
import { computeRankSpriteMap, rankIconFilename, rankLabelsOrdered } from './lib/rank-sprites';

/** Source PNG dump (gitignored). See docs/provenance.md §2 + §7. */
export const ICON_DUMP_DIR = join(REPO_ROOT, 'spikes', 'repos', 'uma-tools', 'icons');

/**
 * Rank-rating badge atlas (gitignored vendored input). Single sprite sheet
 * `Rank_tex.png` from daftuyda/UmaTools (provenance §2.1); the per-badge rects
 * live in `scripts/lib/rank-sprites.ts`. Refresh: download
 * https://raw.githubusercontent.com/daftuyda/UmaTools/main/assets/Rank_tex.png
 * to this path, then `pnpm data:build` (or `tsx scripts/build-icons.ts`).
 */
export const RANK_ATLAS_FILE = join(REPO_ROOT, 'spikes', 'repos', 'daftuyda-umatools', 'Rank_tex.png');

/**
 * Coloured stat-tile sources (gitignored vendored input): `stat-{spd,sta,pow,
 * gut,wit}.png`, the in-game `utx_ico_obtain_00..04` sprites (glyph on a colour
 * tile) extracted from the Global client (provenance §2.1). When present, these
 * OVERRIDE the white-glyph `status_0n.png` for the `stat-*` UI icons; absent →
 * fall back to the white dump source (CI keeps the committed coloured webps).
 */
export const COLOR_STAT_ICON_DIR = join(REPO_ROOT, 'spikes', 'assets', 'stat-icons-colored');
const ICONS_OUT_DIR = join(PUBLIC_DATA_DIR, 'icons');
// Build into a sibling staging dir and swap on success, so a partial/corrupt
// dump that throws mid-build can never destroy the committed icons.
const ICONS_STAGING_DIR = join(PUBLIC_DATA_DIR, 'icons.staging');

/** WebP quality (plan §4: sharp q80, visually near-lossless on flat game art). */
const WEBP_QUALITY = 80;
const ICON_SWAP_RETRIES = 5;

/** Cards that exist in the dump ONLY as uppercase `Support_card_s_…` (provenance §2). */
const UPPERCASE_SUPPORT_CARD_IDS: ReadonlySet<string> = new Set(['30024', '30061']);

/** Global card_data ids whose trained icon asset id differs from the UmaRecord umaId. */
const UMA_TRAINED_ICON_ID_OVERRIDES: Readonly<Record<string, string>> = {
  '100402': '100430',
  '100502': '100520',
  '101402': '101416',
  '101502': '101510',
  '101702': '101743',
  '101802': '101826',
  '102002': '102020',
  '102202': '102226',
  '102402': '102426',
  '102602': '102613',
  '103702': '103713',
  '103802': '103826',
  '104502': '104540',
  '105202': '105210',
  '105602': '105623',
  '106002': '106050',
  '106102': '106150',
};

export interface IconManifest {
  dataVersion: string;
  format: 'webp';
  /** Available skill iconIds (sorted). */
  skill: string[];
  /** Available support cardIds (sorted). */
  card: string[];
  /** Available uma umaIds (sorted). */
  uma: string[];
  /** Available small UI icon ids. */
  ui: string[];
  /** Available rank-rating badge labels (G … LS24, ascending order). */
  rank: string[];
  /** umaIds that fell back to the base chr_icon (no outfit-specific trained icon). */
  _fallbackUmas: string[];
}

const UI_ICON_SOURCES: Record<string, string> = {
  'apt-G': 'utx_ico_statusrank_00.png',
  'apt-F': 'utx_ico_statusrank_01.png',
  'apt-E': 'utx_ico_statusrank_02.png',
  'apt-D': 'utx_ico_statusrank_03.png',
  'apt-C': 'utx_ico_statusrank_04.png',
  'apt-B': 'utx_ico_statusrank_05.png',
  'apt-A': 'utx_ico_statusrank_06.png',
  'apt-S': 'utx_ico_statusrank_07.png',
  'stat-spd': 'status_00.png',
  'stat-sta': 'status_01.png',
  'stat-pow': 'status_02.png',
  'stat-gut': 'status_03.png',
  'stat-wit': 'status_04.png',
  'mood--2': 'global/utx_ico_motivation_m_00.png',
  'mood--1': 'global/utx_ico_motivation_m_01.png',
  'mood-0': 'global/utx_ico_motivation_m_02.png',
  'mood-1': 'global/utx_ico_motivation_m_03.png',
  'mood-2': 'global/utx_ico_motivation_m_04.png',
};

// ---------------------------------------------------------------------------
// Pure source-filename resolvers (unit-tested in build-icons.test.ts)
// ---------------------------------------------------------------------------

/** skill/utx_ico_skill_<iconId padded to ≥5>.png (the two 7-digit ids are a no-op pad). */
export function skillSourceFile(iconId: string): string {
  return `skill/utx_ico_skill_${iconId.padStart(5, '0')}.png`;
}

/**
 * support/support_card_s_<cardId>.png — but 30024 / 30061 only exist uppercase
 * in the dump, so resolve those to the capital-S filename (output is always
 * lowercased by the caller).
 */
export function supportSourceFile(cardId: string): string {
  const stem = UPPERCASE_SUPPORT_CARD_IDS.has(cardId)
    ? `Support_card_s_${cardId}`
    : `support_card_s_${cardId}`;
  return `support/${stem}.png`;
}

/**
 * uma source resolver with the trained → base fallback. `trainedExists` answers
 * whether the relative trained icon path exists (injected so this stays
 * pure/testable). Returns the relative source path + whether the base chr_icon
 * fallback was used.
 */
export function umaSourceFile(
  umaId: string,
  charaId: string,
  trainedExists: (relPath: string) => boolean,
): { source: string; fallback: boolean } {
  const iconAssetId = UMA_TRAINED_ICON_ID_OVERRIDES[umaId] ?? umaId;
  const trained = `chara/trained_chr_icon_${charaId}_${iconAssetId}_02.png`;
  if (UMA_TRAINED_ICON_ID_OVERRIDES[umaId]) return { source: trained, fallback: false };
  if (trainedExists(trained)) return { source: trained, fallback: false };
  return { source: `chara/chr_icon_${charaId}.png`, fallback: true };
}

// ---------------------------------------------------------------------------
// Build (impure: reads the dump, converts via sharp, writes WebP + manifest)
// ---------------------------------------------------------------------------

/** Convert one source PNG → WebP at the given output path (deterministic given same input). */
async function convertToWebp(sourceAbs: string, outAbs: string): Promise<void> {
  await sharp(sourceAbs).webp({ quality: WEBP_QUALITY, effort: 4 }).toFile(outAbs);
}

/**
 * Slice the Rank_tex.png atlas into one WebP per rank badge (G … LS24) under
 * `outDir`. Returns the ordered label list for the manifest. Throws if the
 * gitignored atlas is absent (consistent with the other source-missing guards;
 * the whole build already self-skips when the icon dump is absent in CI).
 */
async function sliceRankIcons(outDir: string): Promise<string[]> {
  if (!existsSync(RANK_ATLAS_FILE)) {
    throw new Error(
      `build-icons: missing rank atlas ${RANK_ATLAS_FILE}. Download Rank_tex.png from ` +
        'daftuyda/UmaTools (provenance §2.1) to that path, then rebuild.',
    );
  }
  mkdirSync(outDir, { recursive: true });
  const rects = computeRankSpriteMap();
  for (const [label, r] of Object.entries(rects)) {
    await sharp(RANK_ATLAS_FILE)
      .extract({ left: r.x, top: r.y, width: r.w, height: r.h })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toFile(join(outDir, `${rankIconFilename(label)}.webp`));
  }
  return rankLabelsOrdered();
}

/** Remove + recreate an output kind dir so a rebuild can't leave stale icons behind. */
function freshDir(abs: string): void {
  rmSync(abs, { recursive: true, force: true });
  mkdirSync(abs, { recursive: true });
}

export async function buildIcons(opts: { dataVersion: string }): Promise<void> {
  if (!existsSync(ICON_DUMP_DIR)) {
    console.warn(
      `build-icons: source dump ${ICON_DUMP_DIR} is absent — SKIPPING icon regeneration. ` +
        'CI/Pages builds use the committed public/data/icons/; regeneration needs the local ' +
        'uma-tools dump (gitignored, provenance §2/§7). The other public/data outputs are unaffected.',
    );
    return;
  }

  const skills = readJson<SkillRecord[]>(join(PUBLIC_DATA_DIR, 'skills.json'));
  const cards = readJson<SupportCardRecord[]>(join(PUBLIC_DATA_DIR, 'support_cards.json'));
  const umas = readJson<UmaRecord[]>(join(PUBLIC_DATA_DIR, 'umas.json'));

  const trainedExists = (relPath: string): boolean => existsSync(join(ICON_DUMP_DIR, relPath));
  const srcAbs = (relPath: string): string => join(ICON_DUMP_DIR, relPath);

  // --- skill icons (dedup by iconId; ~56 distinct, not 578) -----------------
  const skillIconIds = [...new Set(skills.map((s) => s.iconId))].sort(
    (a, b) => Number(a) - Number(b),
  );
  freshDir(ICONS_STAGING_DIR);
  mkdirSync(join(ICONS_STAGING_DIR, 'skill'), { recursive: true });
  for (const iconId of skillIconIds) {
    const src = srcAbs(skillSourceFile(iconId));
    if (!existsSync(src)) {
      throw new Error(`build-icons: missing skill icon source ${src} (iconId ${iconId}).`);
    }
    await convertToWebp(src, join(ICONS_STAGING_DIR, 'skill', `${iconId}.webp`));
  }

  // --- support card chips (keyed by cardId; lowercase the 2 case-variants) --
  const cardIds = [...new Set(cards.map((c) => c.cardId))].sort((a, b) => Number(a) - Number(b));
  mkdirSync(join(ICONS_STAGING_DIR, 'support'), { recursive: true });
  for (const cardId of cardIds) {
    const src = srcAbs(supportSourceFile(cardId));
    if (!existsSync(src)) {
      throw new Error(`build-icons: missing support card source ${src} (cardId ${cardId}).`);
    }
    // Output is always lowercase <cardId>.webp regardless of source case.
    await convertToWebp(src, join(ICONS_STAGING_DIR, 'support', `${cardId}.webp`));
  }

  // --- uma portraits (trained _02 → base chr_icon fallback) -----------------
  const umaIds = [...new Set(umas.map((u) => u.umaId))].sort((a, b) => Number(a) - Number(b));
  const charaByUmaId = new Map(umas.map((u) => [u.umaId, u.charaId]));
  const fallbackUmas: string[] = [];
  mkdirSync(join(ICONS_STAGING_DIR, 'uma'), { recursive: true });
  for (const umaId of umaIds) {
    const charaId = charaByUmaId.get(umaId);
    if (charaId === undefined) {
      throw new Error(`build-icons: uma ${umaId} has no charaId in umas.json.`);
    }
    const { source, fallback } = umaSourceFile(umaId, charaId, trainedExists);
    const src = srcAbs(source);
    if (!existsSync(src)) {
      throw new Error(`build-icons: missing uma portrait source ${src} (umaId ${umaId}).`);
    }
    if (fallback) fallbackUmas.push(umaId);
    await convertToWebp(src, join(ICONS_STAGING_DIR, 'uma', `${umaId}.webp`));
  }

  const uiIconEntries = Object.entries(UI_ICON_SOURCES).sort(([a], [b]) => a.localeCompare(b));
  const uiIconIds = uiIconEntries.map(([id]) => id);
  mkdirSync(join(ICONS_STAGING_DIR, 'ui'), { recursive: true });
  for (const [id, relPath] of uiIconEntries) {
    // Prefer the coloured stat tile (utx_ico_obtain_*) when the vendored source
    // is present; otherwise fall back to the white-glyph dump source.
    const coloredStat = join(COLOR_STAT_ICON_DIR, `${id}.png`);
    const src = id.startsWith('stat-') && existsSync(coloredStat) ? coloredStat : srcAbs(relPath);
    if (!existsSync(src)) {
      throw new Error(`build-icons: missing UI icon source ${src} (id ${id}).`);
    }
    await convertToWebp(src, join(ICONS_STAGING_DIR, 'ui', `${id}.webp`));
  }

  // --- rank-rating badges (sliced from the single Rank_tex.png atlas) -------
  const rankLabels = await sliceRankIcons(join(ICONS_STAGING_DIR, 'rank'));

  const manifest: IconManifest = {
    dataVersion: opts.dataVersion,
    format: 'webp',
    skill: skillIconIds,
    card: cardIds,
    uma: umaIds,
    ui: uiIconIds,
    rank: rankLabels,
    _fallbackUmas: fallbackUmas,
  };
  writeJsonDeterministic(join(ICONS_STAGING_DIR, 'icon-manifest.json'), manifest);

  // Atomic swap: only now, with every file converted and the manifest written,
  // do we replace the committed icons. A throw above leaves them untouched.
  await swapIconsDir();

  const onDiskBytes = dirBytes(ICONS_OUT_DIR);
  console.log(
    `public/data/icons written: ${skillIconIds.length} skill, ${cardIds.length} support, ` +
      `${umaIds.length} uma (${fallbackUmas.length} chr_icon fallbacks), ${rankLabels.length} rank, ` +
      `${(onDiskBytes / 1024 / 1024).toFixed(2)} MB total.`,
  );
  if (fallbackUmas.length > 0) {
    console.log(`  fallback umas (no trained _02 icon): ${fallbackUmas.join(', ')}`);
  }
}

async function swapIconsDir(): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= ICON_SWAP_RETRIES; attempt += 1) {
    try {
      rmSync(ICONS_OUT_DIR, { recursive: true, force: true });
      renameSync(ICONS_STAGING_DIR, ICONS_OUT_DIR);
      return;
    } catch (err) {
      lastError = err;
      if (attempt === ICON_SWAP_RETRIES) break;
      await sleep(150 * (attempt + 1));
    }
  }
  try {
    rmSync(ICONS_OUT_DIR, { recursive: true, force: true });
    cpSync(ICONS_STAGING_DIR, ICONS_OUT_DIR, { recursive: true });
    rmSync(ICONS_STAGING_DIR, { recursive: true, force: true });
  } catch {
    throw lastError;
  }
}

/** Recursive on-disk byte size of a directory (for the build summary). */
function dirBytes(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    total += entry.isDirectory() ? dirBytes(abs) : statSync(abs).size;
  }
  return total;
}

const isMain = (process.argv[1] ?? '').replace(/\\/g, '/').endsWith('scripts/build-icons.ts');
if (isMain) {
  // Standalone run uses the same dataVersion convention as build-all.
  import('./fetch-borrowed')
    .then(({ UPSTREAM_COMMIT }) =>
      buildIcons({ dataVersion: `global-${UPSTREAM_COMMIT.slice(0, 8)}` }),
    )
    .catch((err: unknown) => {
      console.error(err);
      process.exitCode = 1;
    });
}
