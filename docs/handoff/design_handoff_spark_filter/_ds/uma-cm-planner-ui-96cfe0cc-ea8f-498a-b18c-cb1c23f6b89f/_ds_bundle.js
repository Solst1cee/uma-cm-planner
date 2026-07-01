/* @ds-bundle: {"namespace":"UmaCmPlanner","components":[{"name":"BuildCards","sourcePath":"components/sp-optimizer/BuildCards/BuildCards.jsx"},{"name":"GameIcon","sourcePath":"components/data/GameIcon/GameIcon.jsx"},{"name":"PlanHeaderPanel","sourcePath":"components/skill-planner/PlanHeaderPanel/PlanHeaderPanel.jsx"},{"name":"SearchPicker","sourcePath":"components/parents/SearchPicker/SearchPicker.jsx"},{"name":"SkillPicker","sourcePath":"components/skill-planner/SkillPicker/SkillPicker.jsx"},{"name":"TimelineDetailPanel","sourcePath":"components/meta-intel/TimelineDetailPanel/TimelineDetailPanel.jsx"},{"name":"TimelineEntryCard","sourcePath":"components/meta-intel/TimelineEntryCard/TimelineEntryCard.jsx"}],"sourceHashes":{"components/sp-optimizer/BuildCards/BuildCards.jsx":"103d1551ddde","components/sp-optimizer/BuildCards/BuildCards.d.ts":"4304e531609e","components/sp-optimizer/BuildCards/BuildCards.prompt.md":"ffa2e905514c","components/data/GameIcon/GameIcon.jsx":"c486ca0a36ad","components/data/GameIcon/GameIcon.d.ts":"f1b4b1b4f7f2","components/data/GameIcon/GameIcon.prompt.md":"6556937211da","components/skill-planner/PlanHeaderPanel/PlanHeaderPanel.jsx":"ff8c8b1d6d0d","components/skill-planner/PlanHeaderPanel/PlanHeaderPanel.d.ts":"d5a7455177e9","components/skill-planner/PlanHeaderPanel/PlanHeaderPanel.prompt.md":"f00275479e9e","components/parents/SearchPicker/SearchPicker.jsx":"b3f56aed8cc3","components/parents/SearchPicker/SearchPicker.d.ts":"84bb2aa4a17f","components/parents/SearchPicker/SearchPicker.prompt.md":"f723f92abe7e","components/skill-planner/SkillPicker/SkillPicker.jsx":"7b6b40c85ca9","components/skill-planner/SkillPicker/SkillPicker.d.ts":"6ee818914043","components/skill-planner/SkillPicker/SkillPicker.prompt.md":"7c8b51cc1e78","components/meta-intel/TimelineDetailPanel/TimelineDetailPanel.jsx":"1f8d657f1e7c","components/meta-intel/TimelineDetailPanel/TimelineDetailPanel.d.ts":"4e7f755526c3","components/meta-intel/TimelineDetailPanel/TimelineDetailPanel.prompt.md":"dcb70c32f879","components/meta-intel/TimelineEntryCard/TimelineEntryCard.jsx":"3719536381ee","components/meta-intel/TimelineEntryCard/TimelineEntryCard.d.ts":"057dd8cf40f5","components/meta-intel/TimelineEntryCard/TimelineEntryCard.prompt.md":"27577c4fe0b7"},"inlinedExternals":[],"builtBy":"cc-design-sync"} */
"use strict";
var UmaCmPlanner = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // <define:import.meta.env>
  var define_import_meta_env_default;
  var init_define_import_meta_env = __esm({
    "<define:import.meta.env>"() {
      define_import_meta_env_default = { MODE: "development", DEV: true, PROD: false, SSR: false, BASE_URL: "/" };
    }
  });

  // shim:react-shim
  var require_react_shim = __commonJS({
    "shim:react-shim"(exports, module) {
      init_define_import_meta_env();
      var R = window.React;
      function jsx(t, p, k) {
        return R.createElement(t, k === void 0 ? p : Object.assign({ key: k }, p));
      }
      module.exports = R;
      module.exports.jsx = jsx;
      module.exports.jsxs = jsx;
      module.exports.jsxDEV = jsx;
      module.exports.Fragment = R.Fragment;
    }
  });

  // .design-sync/entry.ts
  var entry_exports = {};
  __export(entry_exports, {
    BuildCards: () => BuildCards,
    GameDataProvider: () => GameDataProvider,
    GameIcon: () => GameIcon,
    PlanHeaderPanel: () => PlanHeaderPanel,
    SearchPicker: () => SearchPicker,
    SkillPicker: () => SkillPicker,
    TimelineDetailPanel: () => TimelineDetailPanel,
    TimelineEntryCard: () => TimelineEntryCard
  });
  init_define_import_meta_env();

  // src/features/data/gameData.ts
  init_define_import_meta_env();
  var import_react = __toESM(require_react_shim());

  // src/core/timeline.ts
  init_define_import_meta_env();
  function effectiveDate(e) {
    return e.dates.finals ?? e.dates.start ?? e.dates.end ?? "";
  }
  function projectCmSchedule(entries) {
    const rows = [];
    for (const e of entries) {
      if (e.type !== "cm" || e.cm?.cmNumber === void 0 || !e.cm.courseId) continue;
      rows.push({
        date: effectiveDate(e),
        cmId: `CM${e.cm.cmNumber}`,
        cmNumber: e.cm.cmNumber,
        name: e.title,
        courseId: e.cm.courseId
      });
    }
    return rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  }
  function timelineBadge(e) {
    if (e.status === "confirmed") return { symbol: "\u2713", label: "confirmed" };
    if (e.tier === "datamined") return { symbol: "\u25C6", label: "datamined" };
    return { symbol: "~", label: "predicted" };
  }

  // src/core/fixtures.ts
  init_define_import_meta_env();
  var FIXTURE_SKILLS = [
    {
      skillId: "200012",
      iconId: "10011",
      nameEn: "Right Turns \u25CB",
      nameJp: "\u53F3\u56DE\u308A\u25CB",
      baseSpCost: 90,
      rarity: "white",
      variantSkillIds: ["200014"],
      conditions: "rotation==1",
      server: "global",
      dataVersion: "fixture"
    },
    {
      skillId: "200014",
      iconId: "10012",
      nameEn: "Right Turns \u25CE",
      nameJp: "\u53F3\u56DE\u308A\u25CE",
      baseSpCost: 110,
      rarity: "gold",
      prereqSkillId: "200012",
      variantSkillIds: ["200012"],
      conditions: "rotation==1",
      server: "global",
      dataVersion: "fixture"
    },
    {
      skillId: "200331",
      iconId: "20012",
      nameEn: "Professor of Curvature",
      nameJp: "\u5F27\u7DDA\u306E\u30D7\u30ED\u30D5\u30A7\u30C3\u30B5\u30FC",
      baseSpCost: 160,
      rarity: "gold",
      prereqSkillId: "200332",
      variantSkillIds: ["200332"],
      conditions: "corner_random==1",
      server: "global",
      dataVersion: "fixture"
    },
    {
      skillId: "200332",
      iconId: "20011",
      nameEn: "Corner Adept \u25CB",
      nameJp: "\u30B3\u30FC\u30CA\u30FC\u5DE7\u8005\u25CB",
      baseSpCost: 110,
      rarity: "white",
      variantSkillIds: ["200331"],
      conditions: "corner_random==1",
      server: "global",
      dataVersion: "fixture"
    },
    {
      skillId: "210061",
      iconId: "20142",
      nameEn: "Shooting for the Top",
      nameJp: "\u4E00\u756A\u661F",
      baseSpCost: 0,
      rarity: "white",
      scenarioId: 4,
      // Trackblazer (Climax) — internal id, see provenance §3.1
      conditions: "",
      server: "global",
      dataVersion: "fixture"
    },
    {
      skillId: "900021",
      iconId: "20011",
      nameEn: "I'm Not Giving Up the Lead\u2026! (inherited)",
      nameJp: "\u5148\u982D\u306E\u666F\u8272\u306F\u8B72\u3089\u306A\u3044\u2026\uFF01\uFF08\u7D99\u627F\uFF09",
      baseSpCost: 0,
      rarity: "inherited_unique",
      conditions: "is_lastspurt==1",
      server: "global",
      dataVersion: "fixture"
    },
    {
      skillId: "201242",
      iconId: "20011",
      nameEn: "JP-Only Example \u25CB",
      nameJp: "JP\u9650\u5B9A\u4F8B\u25CB",
      baseSpCost: 100,
      rarity: "white",
      conditions: "",
      server: "jp",
      // must never appear in Global calculations (P4)
      dataVersion: "fixture"
    }
  ];
  var FIXTURE_CARDS = [
    {
      cardId: "30028",
      nameEn: "[Feel the Burn, Princess!]",
      charName: "Kitasan Black",
      rarity: "SSR",
      type: "speed",
      perLevel: [
        { limitBreak: 0, hintFrequency: 30, hintLevels: 2, specialtyPriority: 50 },
        { limitBreak: 1, hintFrequency: 33, hintLevels: 2, specialtyPriority: 65 },
        { limitBreak: 2, hintFrequency: 36, hintLevels: 2, specialtyPriority: 80 },
        { limitBreak: 3, hintFrequency: 40, hintLevels: 2, specialtyPriority: 100 },
        { limitBreak: 4, hintFrequency: 40, hintLevels: 2, specialtyPriority: 120 }
      ],
      skills: [
        { skillId: "200331", sourceType: "chain" },
        { skillId: "200332", sourceType: "hint_pool" },
        { skillId: "200012", sourceType: "hint_pool" },
        { skillId: "200014", sourceType: "random_event" }
      ],
      hintPoolSize: 2,
      server: "global",
      dataVersion: "fixture"
    },
    {
      cardId: "30016",
      nameEn: "[Tracen Academy]",
      charName: "Tazuna Hayakawa",
      rarity: "SSR",
      type: "friend",
      perLevel: [
        { limitBreak: 0, hintFrequency: 0, hintLevels: 0, specialtyPriority: 0 },
        { limitBreak: 1, hintFrequency: 0, hintLevels: 0, specialtyPriority: 0 },
        { limitBreak: 2, hintFrequency: 0, hintLevels: 0, specialtyPriority: 0 },
        { limitBreak: 3, hintFrequency: 0, hintLevels: 0, specialtyPriority: 0 },
        { limitBreak: 4, hintFrequency: 0, hintLevels: 0, specialtyPriority: 0 }
      ],
      skills: [{ skillId: "200012", sourceType: "date_event" }],
      hintPoolSize: 0,
      server: "global",
      dataVersion: "fixture"
    },
    {
      cardId: "10001",
      nameEn: "[R Example]",
      charName: "Special Week",
      rarity: "R",
      type: "stamina",
      perLevel: [
        { limitBreak: 0, hintFrequency: 0, hintLevels: 0, specialtyPriority: 0 },
        { limitBreak: 1, hintFrequency: 5, hintLevels: 0, specialtyPriority: 0 },
        { limitBreak: 2, hintFrequency: 10, hintLevels: 1, specialtyPriority: 20 },
        { limitBreak: 3, hintFrequency: 12, hintLevels: 1, specialtyPriority: 20 },
        { limitBreak: 4, hintFrequency: 15, hintLevels: 1, specialtyPriority: 35 }
      ],
      skills: [
        { skillId: "200332", sourceType: "hint_pool" },
        { skillId: "200012", sourceType: "hint_pool" },
        { skillId: "200014", sourceType: "hint_pool" },
        { skillId: "210061", sourceType: "hint_pool" },
        { skillId: "900021", sourceType: "hint_pool" },
        { skillId: "201242", sourceType: "hint_pool" },
        { skillId: "100151", sourceType: "hint_pool" },
        { skillId: "100152", sourceType: "hint_pool" },
        { skillId: "100153", sourceType: "hint_pool" },
        { skillId: "100154", sourceType: "hint_pool" },
        { skillId: "100155", sourceType: "hint_pool" },
        { skillId: "100156", sourceType: "hint_pool" }
      ],
      hintPoolSize: 12,
      server: "global",
      dataVersion: "fixture"
    }
  ];
  var FIXTURE_SPARK_RATES = {
    baseProcPctByStars: {
      blue: [70, 80, 90],
      pink: [1, 3, 5],
      green: [5, 10, 15],
      whiteSkill: [3, 6, 9],
      whiteRace: [1, 2, 3],
      whiteScenario: [3, 6, 9]
    },
    inspirationEvents: 2,
    affinityScaling: "per_member_multiplicative_pct",
    pink: {
      careerStartStepThresholds: [1, 4, 7, 10],
      careerStartMaxSteps: 4,
      careerStartCap: "A",
      sToSRequiresInRunProcAtA: true
    },
    blueCareerStartByStars: [5, 12, 21],
    blueInRunRollRange: { 1: [1, 10], 2: [1, 16], 3: [1, 28] },
    blueInRunRollRangeProvisional: true,
    hintDiscountCumulativePct: [10, 20, 30, 35, 40],
    fastLearnerMultiplier: 0.9,
    dataVersion: "fixture"
  };
  var FIXTURE_PLAN = {
    id: "fixture-plan",
    name: "Fixture Cup",
    planNumber: 1,
    cmRef: { cmId: "CM0", cmNumber: 0, courseId: "10606", surface: "turf", distance: 2400 },
    scenarioId: 4,
    umaId: "100201",
    uniqueSkillId: "",
    role: "ace",
    strategy: "late",
    statProfile: { stats: { spd: 0, sta: 0, pow: 0, gut: 0, wit: 0 }, mood: 0 },
    sparkGoals: { pink: [{ aptKey: { kind: "distance", key: "long" }, target: "A" }], blue: {} },
    wishlist: [
      { skillId: "200331", priority: 1, source: "targeted" },
      { skillId: "200014", priority: 2, source: "targeted" },
      { skillId: "210061", priority: 3, source: "targeted" }
    ],
    lockedDeckSlots: [],
    parents: {},
    patch: { version: "test" },
    server: "global",
    dataVersion: "test"
  };

  // src/features/data/gameData.ts
  var BASE_URL = define_import_meta_env_default.BASE_URL;
  var FIXTURE_CM_PRESETS = [
    {
      name: FIXTURE_PLAN.name,
      date: "2026-07",
      server: "global",
      dataVersion: "fixture",
      courseId: FIXTURE_PLAN.cmRef.courseId,
      surface: FIXTURE_PLAN.cmRef.surface,
      distance: FIXTURE_PLAN.cmRef.distance
    }
  ];
  var FIXTURE_DATASETS = {
    skills: FIXTURE_SKILLS,
    cards: FIXTURE_CARDS,
    sparkRates: FIXTURE_SPARK_RATES,
    cmPresets: FIXTURE_CM_PRESETS,
    // fixtures.ts is frozen and has no uma fixture; in fixture mode the parent
    // pickers degrade to raw ids, same as a missing umas.json.
    umas: [],
    // No bundled icons in fixture mode — GameIcon falls back to its placeholder.
    iconManifest: null,
    // No timeline in fixture mode — M3 views degrade to empty.
    timeline: []
  };
  async function fetchJson(file) {
    const res = await fetch(`${define_import_meta_env_default.BASE_URL}data/${file}`);
    if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
    return await res.json();
  }
  async function loadDatasets() {
    const [skills, cards, sparkRates, cmPresets] = await Promise.all([
      fetchJson("skills.json"),
      fetchJson("support_cards.json"),
      fetchJson("spark_rates.json"),
      fetchJson("cm_presets.json")
    ]);
    const umas = await fetchJson("umas.json").catch((err) => {
      console.warn("[gameData] umas.json unavailable \u2014 parent pickers fall back to raw ids.", err);
      return [];
    });
    const iconManifest = await fetchJson(
      "icons/icon-manifest.json"
    ).catch((err) => {
      console.warn("[gameData] icon-manifest.json unavailable \u2014 icons fall back to text.", err);
      return null;
    });
    const timelineJson = await fetchJson("timeline.json").catch(
      (err) => {
        console.warn("[gameData] timeline.json unavailable \u2014 M3 timeline degrades to empty.", err);
        return { entries: [] };
      }
    );
    const timeline = timelineJson.entries;
    return { skills, cards, sparkRates, cmPresets, umas, iconManifest, timeline };
  }
  var GameDataContext = (0, import_react.createContext)(null);
  function GameDataProvider({ children }) {
    const [state, setState] = (0, import_react.useState)({
      status: "loading",
      data: FIXTURE_DATASETS
      // placeholder while loading; gated by status
    });
    (0, import_react.useEffect)(() => {
      let cancelled = false;
      loadDatasets().then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      }).catch(() => {
        if (!cancelled) setState({ status: "fixture", data: FIXTURE_DATASETS });
      });
      return () => {
        cancelled = true;
      };
    }, []);
    const value = (0, import_react.useMemo)(() => {
      const { skills, cards, sparkRates, cmPresets, umas, iconManifest, timeline } = state.data;
      return {
        status: state.status,
        skills,
        cards,
        sparkRates,
        cmPresets,
        umas,
        iconManifest,
        timeline,
        cmSchedule: projectCmSchedule(timeline),
        skillById: new Map(skills.map((s) => [s.skillId, s])),
        cardById: new Map(cards.map((c) => [c.cardId, c])),
        umaById: new Map(umas.map((u) => [u.umaId, u]))
      };
    }, [state]);
    return (0, import_react.createElement)(GameDataContext.Provider, { value }, children);
  }
  function useGameData() {
    const ctx = (0, import_react.useContext)(GameDataContext);
    if (!ctx) throw new Error("useGameData must be used inside <GameDataProvider>");
    return ctx;
  }

  // src/features/data/GameIcon.tsx
  init_define_import_meta_env();
  var import_react2 = __toESM(require_react_shim());

  // src/core/icons.ts
  init_define_import_meta_env();
  function has(ids, id) {
    return Array.isArray(ids) && ids.includes(id);
  }
  function skillIconPath(iconId, m) {
    if (!has(m.skill, iconId)) return void 0;
    return `data/icons/skill/${iconId}.${m.format}`;
  }
  function cardIconPath(cardId, m) {
    if (!has(m.card, cardId)) return void 0;
    return `data/icons/support/${cardId}.${m.format}`;
  }
  function umaIconPath(umaId, m) {
    if (!has(m.uma, umaId)) return void 0;
    return `data/icons/uma/${umaId}.${m.format}`;
  }
  function uiIconPath(id, m) {
    if (!has(m.ui, id)) return void 0;
    return `data/icons/ui/${id}.${m.format}`;
  }

  // src/features/data/GameIcon.tsx
  function relativePathFor(kind, id, manifest) {
    switch (kind) {
      case "skill":
        return skillIconPath(id, manifest);
      case "card":
        return cardIconPath(id, manifest);
      case "uma":
        return umaIconPath(id, manifest);
      case "ui":
        return uiIconPath(id, manifest);
    }
  }
  function GameIcon({
    kind,
    id,
    size = 22,
    width,
    height,
    alt,
    className
  }) {
    const { iconManifest } = useGameData();
    const [broken, setBroken] = (0, import_react2.useState)(false);
    const relative = iconManifest ? relativePathFor(kind, id, iconManifest) : void 0;
    (0, import_react2.useEffect)(() => {
      setBroken(false);
    }, [relative]);
    const boxWidth = width ?? size;
    const boxHeight = height ?? size;
    const boxStyle = { width: boxWidth, height: boxHeight };
    if (relative === void 0 || broken) {
      return /* @__PURE__ */ React.createElement(
        "span",
        {
          className: `game-icon game-icon-ph ${className ?? ""}`.trim(),
          style: boxStyle,
          "aria-hidden": "true",
          "data-kind": kind
        }
      );
    }
    return /* @__PURE__ */ React.createElement(
      "img",
      {
        className: `game-icon ${className ?? ""}`.trim(),
        src: `${BASE_URL}${relative}`,
        width: boxWidth,
        height: boxHeight,
        style: boxStyle,
        loading: "lazy",
        decoding: "async",
        alt,
        onError: () => setBroken(true)
      }
    );
  }

  // src/features/meta-intel/TimelineEntryCard.tsx
  init_define_import_meta_env();
  function laneSummary(e) {
    if (e.type === "cm") {
      return e.cm?.trackSummary ?? (e.cm?.cmNumber !== void 0 ? `CM${e.cm.cmNumber}` : "Champions Meeting");
    }
    if (e.type === "banner") {
      return e.banner?.kind === "support" ? "Support banner" : "Character banner";
    }
    return e.patch?.version !== void 0 ? `Patch ${e.patch.version}` : "Patch";
  }
  function TimelineEntryCard({
    entry,
    selected,
    past,
    current,
    onSelect
  }) {
    const badge = timelineBadge(entry);
    const date = effectiveDate(entry) || "TBD";
    const className = "tl-card" + (selected ? " selected" : "") + (past ? " past" : "") + (current ? " current" : "");
    return /* @__PURE__ */ React.createElement("button", { type: "button", className, "aria-pressed": selected, onClick: onSelect }, /* @__PURE__ */ React.createElement("span", { className: `tl-badge ${badge.label}` }, badge.symbol, " ", badge.label), /* @__PURE__ */ React.createElement("span", { className: "tl-card-title" }, entry.title), /* @__PURE__ */ React.createElement("span", { className: "tl-card-date muted small" }, date), /* @__PURE__ */ React.createElement("span", { className: "tl-card-summary small" }, laneSummary(entry)), current && entry.type === "cm" && /* @__PURE__ */ React.createElement("span", { className: "tl-m4-tag", title: "The CM the Skill Planner targets" }, "\u2192 M4"));
  }

  // src/features/meta-intel/TimelineDetailPanel.tsx
  init_define_import_meta_env();
  var LANE_NAME = {
    cm: "Champions Meeting",
    banner: "Banner",
    patch: "Patch"
  };
  function TimelineDetailPanel({ entry }) {
    if (entry === null) {
      return /* @__PURE__ */ React.createElement("aside", { className: "panel tl-detail", "aria-label": "Entry detail" }, /* @__PURE__ */ React.createElement("p", { className: "muted" }, "Select an entry to see its dates, source, and what it feeds."));
    }
    const badge = timelineBadge(entry);
    const isCm = entry.type === "cm";
    return /* @__PURE__ */ React.createElement("aside", { className: "panel tl-detail", "aria-label": "Entry detail" }, /* @__PURE__ */ React.createElement("h3", null, entry.title), /* @__PURE__ */ React.createElement("p", { className: "tl-detail-meta" }, /* @__PURE__ */ React.createElement("span", { className: "badge" }, LANE_NAME[entry.type]), /* @__PURE__ */ React.createElement("span", { className: `tl-badge ${badge.label}` }, badge.symbol, " ", badge.label), /* @__PURE__ */ React.createElement("span", { className: "badge" }, entry.server.toUpperCase())), /* @__PURE__ */ React.createElement("dl", { className: "tl-detail-fields" }, entry.dates.start !== void 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("dt", null, "Signup"), /* @__PURE__ */ React.createElement("dd", null, entry.dates.start)), entry.dates.finals !== void 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("dt", null, "Finals"), /* @__PURE__ */ React.createElement("dd", null, entry.dates.finals)), entry.dates.end !== void 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("dt", null, "Ends"), /* @__PURE__ */ React.createElement("dd", null, entry.dates.end)), isCm && entry.cm?.cmNumber !== void 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("dt", null, "CM #"), /* @__PURE__ */ React.createElement("dd", null, entry.cm.cmNumber)), isCm && entry.cm?.courseId !== void 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("dt", null, "Course"), /* @__PURE__ */ React.createElement("dd", null, entry.cm.courseId)), isCm && entry.cm?.trackSummary !== void 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("dt", null, "Track"), /* @__PURE__ */ React.createElement("dd", null, entry.cm.trackSummary)), entry.type === "banner" && entry.banner?.kind !== void 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("dt", null, "Banner"), /* @__PURE__ */ React.createElement("dd", null, entry.banner.kind === "support" ? "Support card" : "Character")), entry.type === "patch" && entry.patch?.version !== void 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("dt", null, "Version"), /* @__PURE__ */ React.createElement("dd", null, entry.patch.version)), entry.type === "patch" && entry.patch?.summary !== void 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("dt", null, "Summary"), /* @__PURE__ */ React.createElement("dd", null, entry.patch.summary))), entry.source.url !== "" ? /* @__PURE__ */ React.createElement("p", { className: "tl-detail-source small" }, "Source:", " ", /* @__PURE__ */ React.createElement(
      "a",
      {
        href: entry.source.url,
        target: "_blank",
        rel: "noreferrer",
        "aria-label": `${entry.source.kind} \u2014 opens in a new tab`
      },
      entry.source.kind,
      " \u2197"
    )) : /* @__PURE__ */ React.createElement("p", { className: "tl-detail-source muted small" }, "Source: ", entry.source.kind, " (no link yet)"), isCm && entry.cm?.cmNumber !== void 0 && entry.cm.courseId !== void 0 && /* @__PURE__ */ React.createElement("p", { className: "tl-feeds small" }, "\u2192 Feeds Skill Planner \xA70 as CM", entry.cm.cmNumber, " (course ", entry.cm.courseId, ")."), entry.status !== "confirmed" && /* @__PURE__ */ React.createElement("p", { className: "tl-unconfirmed small" }, "Not yet confirmed (", badge.label, "). To confirm, hand-edit", " ", /* @__PURE__ */ React.createElement("code", null, "data-overrides/timeline_overrides.json"), ": set", " ", /* @__PURE__ */ React.createElement("code", null, 'status: "confirmed"'), ", stamp an official ", /* @__PURE__ */ React.createElement("code", null, "/news/<id>/"), " link, then run ", /* @__PURE__ */ React.createElement("code", null, "pnpm data:build"), "."));
  }

  // src/features/parents/SearchPicker.tsx
  init_define_import_meta_env();
  var import_react3 = __toESM(require_react_shim());
  var MAX_RESULTS = 30;
  function SearchPicker({
    label,
    placeholder,
    items,
    onPick
  }) {
    const [query, setQuery] = (0, import_react3.useState)("");
    const results = (0, import_react3.useMemo)(() => {
      const q = query.trim().toLowerCase();
      if (q === "") return [];
      return items.filter(
        (i) => i.name.toLowerCase().includes(q) || (i.sub?.toLowerCase().includes(q) ?? false)
      ).slice(0, MAX_RESULTS);
    }, [items, query]);
    return /* @__PURE__ */ React.createElement("div", { className: "picker" }, /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, label), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "search",
        value: query,
        onChange: (e) => setQuery(e.target.value),
        placeholder
      }
    )), query.trim() !== "" && /* @__PURE__ */ React.createElement("ul", { className: "picker-results", "aria-label": `${label} results` }, results.length === 0 && /* @__PURE__ */ React.createElement("li", { className: "muted" }, "No matches."), results.map((item) => /* @__PURE__ */ React.createElement("li", { key: item.id }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "picker-row",
        disabled: item.disabled,
        onClick: () => {
          onPick(item.id);
          setQuery("");
        }
      },
      item.icon,
      /* @__PURE__ */ React.createElement("span", { className: "picker-name" }, item.name, item.sub !== void 0 && /* @__PURE__ */ React.createElement("span", { className: "muted small" }, " ", item.sub)),
      item.badge !== void 0 && /* @__PURE__ */ React.createElement("span", { className: `badge ${item.badgeClass ?? ""}` }, item.badge),
      item.disabled && /* @__PURE__ */ React.createElement("span", { className: "muted small" }, "added")
    )))));
  }

  // src/features/sp-optimizer/BuildCards.tsx
  init_define_import_meta_env();
  function BuildCards({ result }) {
    const { skillById } = useGameData();
    if (result.baskets.length === 0) {
      return /* @__PURE__ */ React.createElement("p", { className: "muted" }, "No feasible baskets \u2014 lower the budget floor or add candidates.");
    }
    return /* @__PURE__ */ React.createElement("div", { className: "sp-cards" }, /* @__PURE__ */ React.createElement("p", { className: "small muted" }, result.mode === "exact" ? "Exact ranking (every feasible basket simulated)." : "Shortlisted estimate (proxy-narrowed, then simulated)."), result.baskets.map((b, i) => /* @__PURE__ */ React.createElement("article", { key: b.skills.join(","), className: "sp-card" }, /* @__PURE__ */ React.createElement("header", null, /* @__PURE__ */ React.createElement("span", { className: "sp-rank" }, "#", i + 1), /* @__PURE__ */ React.createElement("span", { className: "sp-descriptor" }, b.descriptor)), /* @__PURE__ */ React.createElement("ul", { className: "sp-card-skills" }, b.skills.map((id) => {
      const skill = skillById.get(id);
      return /* @__PURE__ */ React.createElement("li", { key: id }, skill && /* @__PURE__ */ React.createElement(GameIcon, { kind: "skill", id: skill.iconId, size: 20, alt: "" }), skill?.nameEn ?? `Skill ${id}`);
    })), /* @__PURE__ */ React.createElement("footer", { className: "small" }, b.spUsed, " SP used \xB7", " ", b.spLeft < 0 ? /* @__PURE__ */ React.createElement("span", { className: "sp-over" }, "over budget by ", -b.spLeft, " SP") : `${b.spLeft} SP left`))));
  }

  // src/features/skill-planner/SkillPicker.tsx
  init_define_import_meta_env();
  var import_react4 = __toESM(require_react_shim());

  // src/features/skill-planner/skillFamilies.ts
  init_define_import_meta_env();
  var EMPTY_SKILL_IDS = /* @__PURE__ */ new Set();
  var DOUBLE_CIRCLE = "\u25CE";
  var CIRCLE = "\u25CB";
  var CROSS = "\xD7";
  function inheritedUniqueFor(skill, skillById) {
    if (skill.rarity !== "unique") return null;
    const guessedInheritedId = skill.skillId.replace(/^1/, "9");
    const guessed = skillById.get(guessedInheritedId);
    if (guessed?.rarity === "inherited_unique") return guessed;
    for (const candidate of skillById.values()) {
      if (candidate.rarity === "inherited_unique" && candidate.server === skill.server && candidate.nameEn === skill.nameEn) {
        return candidate;
      }
    }
    return null;
  }
  function wishlistSkillRecord(skillId, skillById) {
    const skill = skillById.get(skillId);
    if (!skill) return null;
    return inheritedUniqueFor(skill, skillById) ?? skill;
  }
  function wishlistSkillId(skillId, skillById) {
    return wishlistSkillRecord(skillId, skillById)?.skillId ?? skillId;
  }
  function areSkillVariants(a, b) {
    if (a.skillId === b.skillId) return true;
    return (a.variantSkillIds ?? []).includes(b.skillId) || (b.variantSkillIds ?? []).includes(a.skillId);
  }
  function skillVariantRank(skill) {
    let score = 0;
    if (skill.rarity === "gold") score += 3e3;
    if (skill.nameEn.includes(DOUBLE_CIRCLE)) score += 2e3;
    if (skill.nameEn.includes(CIRCLE)) score += 1e3;
    if (skill.nameEn.includes(CROSS)) score -= 1e3;
    score += Math.min(skill.baseSpCost, 999);
    return score;
  }
  function isBlockedBySelectedVariant(candidate, selectedSkillIds, skillById) {
    if ((candidate.variantSkillIds ?? []).length === 0) return false;
    const candidateRank = skillVariantRank(candidate);
    for (const selectedId of selectedSkillIds) {
      const selected = wishlistSkillRecord(selectedId, skillById);
      if (!selected || !areSkillVariants(candidate, selected)) continue;
      if (skillVariantRank(selected) >= candidateRank) return true;
    }
    return false;
  }
  function resetProjectedSkill(item, skillId) {
    const next = {
      ...item,
      skillId,
      manualAdd: true
    };
    delete next.projectedL;
    delete next.projectedLStale;
    return next;
  }
  function addOrReplaceWishlistSkill(wishlist, rawSkillId, skillById, hiddenSkillIds = EMPTY_SKILL_IDS) {
    const resolvedSkillId = wishlistSkillId(rawSkillId, skillById);
    if (hiddenSkillIds.has(resolvedSkillId)) return wishlist;
    const candidate = skillById.get(resolvedSkillId);
    if (!candidate) return wishlist;
    let replaced = false;
    const next = wishlist.map((item) => {
      const existing = wishlistSkillRecord(item.skillId, skillById);
      if (!existing || !areSkillVariants(existing, candidate)) return item;
      replaced = true;
      return resetProjectedSkill(item, candidate.skillId);
    });
    if (replaced) return next;
    return [
      ...wishlist,
      { skillId: candidate.skillId, priority: 1, source: "targeted", manualAdd: true }
    ];
  }

  // src/features/skill-planner/SkillPicker.tsx
  var MAX_RESULTS2 = 30;
  var EMPTY_SKILL_IDS2 = /* @__PURE__ */ new Set();
  function SkillPicker({
    addedSkillIds,
    hiddenSkillIds = EMPTY_SKILL_IDS2,
    onPick
  }) {
    const { skills, skillById } = useGameData();
    const [query, setQuery] = (0, import_react4.useState)("");
    const [activeIndex, setActiveIndex] = (0, import_react4.useState)(0);
    const results = (0, import_react4.useMemo)(() => {
      const q = query.trim().toLowerCase();
      if (q === "") return [];
      return skills.filter((s) => s.server === "global" && s.rarity !== "unique" && !hiddenSkillIds.has(s.skillId) && !isBlockedBySelectedVariant(s, addedSkillIds, skillById) && s.nameEn.toLowerCase().includes(q)).slice(0, MAX_RESULTS2);
    }, [addedSkillIds, hiddenSkillIds, query, skillById, skills]);
    (0, import_react4.useEffect)(() => {
      setActiveIndex(0);
    }, [query]);
    (0, import_react4.useEffect)(() => {
      if (results.length === 0) {
        if (activeIndex !== 0) setActiveIndex(0);
        return;
      }
      if (activeIndex >= results.length) setActiveIndex(results.length - 1);
    }, [activeIndex, results.length]);
    const pick = (skillId) => {
      onPick(skillId);
      setQuery("");
    };
    return /* @__PURE__ */ React.createElement("div", { className: "picker" }, /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", { className: "visually-hidden" }, "Search skills by name"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "search",
        value: query,
        onChange: (e) => setQuery(e.target.value),
        onKeyDown: (e) => {
          if (results.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((index) => Math.min(index + 1, results.length - 1));
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            const skill = results[activeIndex];
            if (skill && !addedSkillIds.has(skill.skillId)) pick(skill.skillId);
          }
        },
        placeholder: "+ Search skills by name..."
      }
    )), query.trim() !== "" && /* @__PURE__ */ React.createElement("ul", { className: "picker-results", "aria-label": "Skill search results" }, results.length === 0 && /* @__PURE__ */ React.createElement("li", { className: "muted" }, "No matching skills."), results.map((skill, index) => {
      const added = addedSkillIds.has(skill.skillId);
      return /* @__PURE__ */ React.createElement("li", { key: skill.skillId }, /* @__PURE__ */ React.createElement(
        "button",
        {
          type: "button",
          className: `picker-row cmp-skill-plate cmp-skill-rarity-${skill.rarity} ${index === activeIndex ? "is-active" : ""}`.trim(),
          disabled: added,
          "aria-selected": index === activeIndex,
          onClick: () => {
            pick(skill.skillId);
          }
        },
        /* @__PURE__ */ React.createElement(GameIcon, { kind: "skill", id: skill.iconId, size: 24, alt: "" }),
        /* @__PURE__ */ React.createElement("span", { className: "picker-name" }, skill.nameEn),
        /* @__PURE__ */ React.createElement("span", { className: "muted small" }, skill.baseSpCost, " SP"),
        added && /* @__PURE__ */ React.createElement("span", { className: "muted small" }, "added")
      ));
    })));
  }

  // src/features/skill-planner/PlanHeaderPanel.tsx
  init_define_import_meta_env();
  var import_react5 = __toESM(require_react_shim());
  var SCENARIOS = [
    { id: 1, label: "URA Finals" },
    { id: 2, label: "Unity Cup" },
    { id: 4, label: "Trackblazer \u2014 default (latest)" }
  ];
  var PRIORITY_STARS = { 1: "\u2605", 2: "\u2605\u2605", 3: "\u2605\u2605\u2605" };
  function nextPriority(p) {
    return p === 3 ? 1 : p + 1;
  }
  function cmNumberFromName(name) {
    const m = name.match(/CM\s*0*(\d+)/i);
    return m ? Number(m[1]) : 0;
  }
  function presetMatchesPlan(preset, plan) {
    return preset.name === plan.name && preset.courseId === plan.cmRef.courseId && preset.surface === plan.cmRef.surface && preset.distance === plan.cmRef.distance;
  }
  function presetLabel(preset) {
    const base = `${preset.name} (${preset.date})`;
    return preset.server === "jp" ? `${base} (JP history)` : base;
  }
  function PlanHeaderPanel({
    plan,
    onChange
  }) {
    const { cmPresets, skillById } = useGameData();
    const [customMode, setCustomMode] = (0, import_react5.useState)(false);
    const matchedPreset = (0, import_react5.useMemo)(
      () => cmPresets.findIndex((p) => presetMatchesPlan(p, plan)),
      [cmPresets, plan]
    );
    const showCustom = customMode || matchedPreset < 0;
    const addedSkillIds = (0, import_react5.useMemo)(
      () => new Set(plan.wishlist.flatMap((t) => {
        const resolvedSkillId = wishlistSkillId(t.skillId, skillById);
        return resolvedSkillId !== t.skillId ? [t.skillId, resolvedSkillId] : [t.skillId];
      })),
      [plan.wishlist, skillById]
    );
    const applyPreset = (value) => {
      if (value === "custom") {
        setCustomMode(true);
        return;
      }
      const preset = cmPresets[Number(value)];
      if (!preset) return;
      const cmNumber = cmNumberFromName(preset.name);
      setCustomMode(false);
      onChange({
        ...plan,
        name: preset.name,
        cmRef: {
          cmId: `CM${cmNumber}`,
          cmNumber,
          courseId: preset.courseId,
          surface: preset.surface,
          distance: preset.distance,
          season: preset.season,
          condition: preset.ground
        }
      });
    };
    const setCmRef = (patch) => {
      onChange({ ...plan, cmRef: { ...plan.cmRef, ...patch } });
    };
    return /* @__PURE__ */ React.createElement("section", { className: "panel", "aria-labelledby": "plan-h" }, /* @__PURE__ */ React.createElement("h2", { id: "plan-h" }, "Plan"), /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "Plan name"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        value: plan.name,
        onChange: (e) => onChange({ ...plan, name: e.target.value })
      }
    )), /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "Champions Meeting"), /* @__PURE__ */ React.createElement(
      "select",
      {
        value: showCustom ? "custom" : String(matchedPreset),
        onChange: (e) => applyPreset(e.target.value)
      },
      cmPresets.map((p, i) => /* @__PURE__ */ React.createElement("option", { key: `${p.name}-${p.date}`, value: String(i) }, presetLabel(p))),
      /* @__PURE__ */ React.createElement("option", { value: "custom" }, "Custom race\u2026")
    )), showCustom && /* @__PURE__ */ React.createElement("div", { className: "race-fields" }, /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "Course id"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        inputMode: "numeric",
        value: plan.cmRef.courseId,
        onChange: (e) => setCmRef({ courseId: e.target.value })
      }
    )), /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "Surface"), /* @__PURE__ */ React.createElement(
      "select",
      {
        value: plan.cmRef.surface,
        onChange: (e) => setCmRef({ surface: e.target.value })
      },
      /* @__PURE__ */ React.createElement("option", { value: "turf" }, "Turf"),
      /* @__PURE__ */ React.createElement("option", { value: "dirt" }, "Dirt")
    )), /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "Distance (m)"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        min: 1e3,
        max: 4e3,
        step: 100,
        value: plan.cmRef.distance,
        onChange: (e) => setCmRef({ distance: Number(e.target.value) })
      }
    ))), /* @__PURE__ */ React.createElement("label", { className: "field" }, /* @__PURE__ */ React.createElement("span", null, "Scenario"), /* @__PURE__ */ React.createElement(
      "select",
      {
        value: String(plan.scenarioId ?? ""),
        onChange: (e) => {
          onChange({ ...plan, scenarioId: Number(e.target.value) });
        }
      },
      SCENARIOS.map((s) => /* @__PURE__ */ React.createElement("option", { key: s.id, value: String(s.id) }, s.label))
    )), /* @__PURE__ */ React.createElement("h3", null, "Target skills"), plan.wishlist.length === 0 && /* @__PURE__ */ React.createElement("p", { className: "muted" }, "No target skills yet \u2014 search below to add (1\u20137+ is fine)."), /* @__PURE__ */ React.createElement("ul", { className: "target-list", "aria-label": "Target skills" }, plan.wishlist.map((target) => {
      const skill = skillById.get(target.skillId);
      const name = skill?.nameEn ?? target.skillId;
      return /* @__PURE__ */ React.createElement("li", { key: target.skillId, className: "target-row" }, /* @__PURE__ */ React.createElement(
        "button",
        {
          type: "button",
          className: `star-btn prio-${target.priority}`,
          "aria-label": `Priority ${target.priority} for ${name} \u2014 tap to cycle`,
          onClick: () => onChange({
            ...plan,
            wishlist: plan.wishlist.map(
              (t) => t.skillId === target.skillId ? { ...t, priority: nextPriority(t.priority) } : t
            )
          })
        },
        PRIORITY_STARS[target.priority]
      ), skill && /* @__PURE__ */ React.createElement(GameIcon, { kind: "skill", id: skill.iconId, size: 22, alt: "" }), /* @__PURE__ */ React.createElement("span", { className: "target-name" }, name), skill && /* @__PURE__ */ React.createElement("span", { className: "muted small" }, skill.baseSpCost, " SP"), /* @__PURE__ */ React.createElement(
        "button",
        {
          type: "button",
          className: "icon-btn",
          "aria-label": `Remove ${name}`,
          onClick: () => onChange({
            ...plan,
            wishlist: plan.wishlist.filter(
              (t) => t.skillId !== target.skillId
            )
          })
        },
        "\u2715"
      ));
    })), /* @__PURE__ */ React.createElement(
      SkillPicker,
      {
        addedSkillIds,
        onPick: (skillId) => onChange({
          ...plan,
          wishlist: addOrReplaceWishlistSkill(plan.wishlist, skillId, skillById)
        })
      }
    ));
  }
  return __toCommonJS(entry_exports);
})();
window.UmaCmPlanner=UmaCmPlanner.__dsMainNs?Object.assign({},UmaCmPlanner,UmaCmPlanner.__dsMainNs,{__dsMainNs:undefined}):UmaCmPlanner;
