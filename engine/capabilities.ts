export const SCORING_CAPABILITY_IDS = [
  "rawDimensions",
  "normalizedDimensions",
  "profiles",
  "entities",
  "matches",
  "rankings"
] as const;

export type ScoringCapabilityId = (typeof SCORING_CAPABILITY_IDS)[number];

interface ScoringStrategyCapability {
  requires: readonly ScoringCapabilityId[];
  provides: readonly ScoringCapabilityId[];
}

export const SCORING_STRATEGY_CAPABILITIES = {
  "weighted-dimension": {
    requires: [],
    provides: ["rawDimensions"]
  },
  normalize: {
    requires: ["rawDimensions"],
    provides: ["normalizedDimensions"]
  },
  "profile-match": {
    requires: ["normalizedDimensions", "profiles"],
    provides: ["matches"]
  },
  "entity-ranking": {
    requires: ["normalizedDimensions", "entities"],
    provides: ["rankings"]
  }
} as const satisfies Record<string, ScoringStrategyCapability>;

export type ScoringStrategyId = keyof typeof SCORING_STRATEGY_CAPABILITIES;

export const SCORING_STRATEGY_IDS = Object.keys(SCORING_STRATEGY_CAPABILITIES) as ScoringStrategyId[];

export const PRESENTATION_BLOCK = {
  hero: "hero",
  radar: "radar",
  ranking: "ranking",
  spectrum: "spectrum",
  tags: "tags",
  strengths: "strengths",
  weaknesses: "weaknesses",
  quote: "quote",
  quadrant: "quadrant",
  highlight: "highlight",
  compatibility: "compatibility"
} as const;

export const PRESENTATION_BLOCK_IDS = Object.values(PRESENTATION_BLOCK);

export type PresentationBlockId = (typeof PRESENTATION_BLOCK_IDS)[number];

export const RESERVED_PRESENTATION_BLOCK_IDS = ["share-card"] as const;

export const PRESENTATION_THEME = {
  editorial: "editorial",
  aurora: "aurora",
  midnight: "midnight",
  playful: "playful",
  warm: "warm",
  electric: "electric"
} as const;

export const PRESENTATION_THEME_IDS = [
  PRESENTATION_THEME.editorial,
  PRESENTATION_THEME.aurora,
  PRESENTATION_THEME.midnight,
  PRESENTATION_THEME.playful,
  PRESENTATION_THEME.warm,
  PRESENTATION_THEME.electric
] as const;

export type PresentationThemeId = (typeof PRESENTATION_THEME_IDS)[number];

export const HERO_VARIANT = {
  standard: "standard",
  poster: "poster",
  identity: "identity",
  scoreFocus: "score-focus"
} as const;

export const HERO_VARIANT_IDS = [
  HERO_VARIANT.standard,
  HERO_VARIANT.poster,
  HERO_VARIANT.identity,
  HERO_VARIANT.scoreFocus
] as const;

export type HeroVariantId = (typeof HERO_VARIANT_IDS)[number];

export const DISCOVERY_CATEGORY = {
  personality: "personality",
  love: "love",
  career: "career",
  interest: "interest",
  city: "city",
  literature: "literature",
  trending: "trending"
} as const;

export const DISCOVERY_CATEGORY_IDS = [
  DISCOVERY_CATEGORY.personality,
  DISCOVERY_CATEGORY.love,
  DISCOVERY_CATEGORY.career,
  DISCOVERY_CATEGORY.interest,
  DISCOVERY_CATEGORY.city,
  DISCOVERY_CATEGORY.literature,
  DISCOVERY_CATEGORY.trending
] as const;

export type DiscoveryCategoryId = (typeof DISCOVERY_CATEGORY_IDS)[number];

export const COVER_STYLE = {
  aurora: "aurora",
  ink: "ink",
  warm: "warm",
  electric: "electric",
  paper: "paper",
  night: "night"
} as const;

export const COVER_STYLE_IDS = [
  COVER_STYLE.aurora,
  COVER_STYLE.ink,
  COVER_STYLE.warm,
  COVER_STYLE.electric,
  COVER_STYLE.paper,
  COVER_STYLE.night
] as const;

export type CoverStyleId = (typeof COVER_STYLE_IDS)[number];
