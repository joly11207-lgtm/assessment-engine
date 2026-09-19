import { z } from "zod";
import {
  COVER_STYLE_IDS,
  DISCOVERY_CATEGORY_IDS,
  HERO_VARIANT_IDS,
  PRESENTATION_BLOCK,
  PRESENTATION_THEME_IDS,
  SCORING_STRATEGY_CAPABILITIES,
  SCORING_STRATEGY_IDS,
  type ScoringCapabilityId,
  type ScoringStrategyId
} from "../engine/capabilities";

const supportedSchemaVersion = "1.0";
const supportedQuestionTypes = ["single-choice", "likert", "binary"] as const;

const idSchema = z.string().min(1).regex(/^[a-zA-Z0-9-_]+$/, "ids may only contain letters, numbers, hyphens, and underscores");

const weightedMapSchema = z.record(z.number().finite());

const optionSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  weights: weightedMapSchema.default({})
});

const questionSchema = z.object({
  id: idSchema,
  type: z.enum(supportedQuestionTypes),
  text: z.string().min(1),
  required: z.boolean().default(true),
  options: z.array(optionSchema).min(2)
});

const dimensionSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  description: z.string().optional(),
  min: z.number().finite(),
  max: z.number().finite()
});

const resultDefinitionSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  tags: z.array(z.string()).default([])
});

const discoveryMetadataSchema = z.object({
  category: z.enum(DISCOVERY_CATEGORY_IDS),
  shortTitle: z.string().min(1).max(24),
  estimatedMinutes: z.number().int().min(1).max(60),
  featured: z.boolean().default(false),
  badge: z.string().min(1).max(12).optional(),
  coverStyle: z.enum(COVER_STYLE_IDS),
  resultPreview: z.string().min(1).max(80).optional()
});

const resultProfileSchema = z.object({
  id: idSchema,
  resultId: idSchema,
  dimensionTargets: weightedMapSchema
});

const rankingEntitySchema = z.object({
  id: idSchema,
  resultId: idSchema,
  dimensionTargets: weightedMapSchema
});

const scoringStrategySchema = z.string().min(1).transform((value) => value as ScoringStrategyId);

const scoringStepSchema = z.object({
  strategy: scoringStrategySchema,
  topN: z.number().int().positive().optional()
});

const heroBlockSchema = z.object({
  type: z.literal(PRESENTATION_BLOCK.hero),
  title: z.string().min(1).optional(),
  variant: z.enum(HERO_VARIANT_IDS).default("standard"),
  showSecondary: z.boolean().default(true),
  showMatch: z.boolean().default(true),
  showTags: z.boolean().default(true)
});

const radarBlockSchema = z.object({
  type: z.literal(PRESENTATION_BLOCK.radar),
  title: z.string().min(1).optional(),
  max: z.literal(100).default(100)
});

const rankingBlockSchema = z.object({
  type: z.literal(PRESENTATION_BLOCK.ranking),
  title: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(20).default(5)
});

const spectrumBlockSchema = z.object({
  type: z.literal(PRESENTATION_BLOCK.spectrum),
  title: z.string().min(1).optional(),
  max: z.literal(100).default(100),
  endpoints: z
    .record(
      z.object({
        left: z.string().min(1),
        right: z.string().min(1)
      })
    )
    .default({})
});

const tagsBlockSchema = z.object({
  type: z.literal(PRESENTATION_BLOCK.tags),
  title: z.string().min(1).optional()
});

const strengthsBlockSchema = z.object({
  type: z.literal(PRESENTATION_BLOCK.strengths),
  title: z.string().min(1).optional()
});

const weaknessesBlockSchema = z.object({
  type: z.literal(PRESENTATION_BLOCK.weaknesses),
  title: z.string().min(1).optional()
});

const quoteBlockSchema = z.object({
  type: z.literal(PRESENTATION_BLOCK.quote),
  title: z.string().min(1).optional(),
  statements: z
    .array(
      z.object({
        resultId: idSchema,
        text: z.string().min(1)
      })
    )
    .default([]),
  fallback: z.string().min(1).optional()
});

const quadrantBlockSchema = z.object({
  type: z.literal(PRESENTATION_BLOCK.quadrant),
  title: z.string().min(1).optional(),
  xDimension: idSchema,
  yDimension: idSchema,
  labels: z
    .object({
      left: z.string().min(1).optional(),
      right: z.string().min(1).optional(),
      bottom: z.string().min(1).optional(),
      top: z.string().min(1).optional()
    })
    .default({})
});

const highlightFactSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("primary-title"),
    label: z.string().min(1).optional()
  }),
  z.object({
    source: z.literal("match-percentage"),
    label: z.string().min(1).optional()
  }),
  z.object({
    source: z.literal("top-ranking"),
    label: z.string().min(1).optional()
  }),
  z.object({
    source: z.literal("dimension-count-high"),
    label: z.string().min(1).optional(),
    threshold: z.number().min(0).max(100).default(70)
  }),
  z.object({
    source: z.literal("custom"),
    label: z.string().min(1),
    value: z.string().min(1)
  })
]);

const highlightBlockSchema = z.object({
  type: z.literal(PRESENTATION_BLOCK.highlight),
  title: z.string().min(1).optional(),
  facts: z.array(highlightFactSchema).min(1).max(4)
});

const compatibilityBlockSchema = z.object({
  type: z.literal(PRESENTATION_BLOCK.compatibility),
  title: z.string().min(1).optional(),
  showInvite: z.boolean().default(true)
});

const presentationBlockSchema = z.discriminatedUnion("type", [
  heroBlockSchema,
  radarBlockSchema,
  rankingBlockSchema,
  spectrumBlockSchema,
  tagsBlockSchema,
  strengthsBlockSchema,
  weaknessesBlockSchema,
  quoteBlockSchema,
  quadrantBlockSchema,
  highlightBlockSchema,
  compatibilityBlockSchema
]);

const shareCardSchema = z
  .object({
    enabled: z.boolean().default(false),
    layout: z.enum(["portrait", "square", "story"]).default("portrait"),
    headline: z.string().min(1).optional(),
    subtitle: z.string().min(1).optional(),
    showTags: z.boolean().default(true),
    showMatch: z.boolean().default(true),
    showRadarSummary: z.boolean().default(true),
    dimensionIds: z.array(idSchema).max(3).default([]),
    qrCode: z.boolean().default(true),
    brandingText: z.string().min(1).optional()
  })
  .strict();

const compatibilityModeSchema = z.enum(["symmetric", "directional"]);

const compatibilityDimensionSchema = z.object({
  id: idSchema,
  label: z.string().min(1)
});

const compatibilitySettingsSchema = z.object({
  enabled: z.boolean().default(false),
  mode: compatibilityModeSchema.default("symmetric"),
  allowPartialCoverage: z.boolean().default(true),
  dimensions: z.array(compatibilityDimensionSchema).default([])
});

const compatibilityPairSchema = z.object({
  id: idSchema,
  resultAId: idSchema,
  resultBId: idSchema,
  scores: z
    .record(idSchema, z.number().min(0).max(100))
    .refine((scores) => typeof scores.overall === "number", {
      message: "compatibility scores must include overall"
    }),
  strengths: z.array(z.string().min(1)).default([]),
  frictionPoints: z.array(z.string().min(1)).default([]),
  summary: z.string().min(1).optional(),
  advice: z.string().min(1).optional(),
  relationshipCopy: z.string().min(1).optional()
}).strict();

export const AssessmentPackageSchema = z
  .object({
    schemaVersion: z.string(),
    metadata: z.object({
      id: idSchema,
      version: idSchema,
      title: z.string().min(1),
      description: z.string().min(1),
      discovery: discoveryMetadataSchema
    }),
    dimensions: z.array(dimensionSchema).min(1),
    questions: z.array(questionSchema).min(1),
    scoring: z.object({
      pipeline: z.array(scoringStepSchema).min(1)
    }),
    results: z.object({
      catalog: z.array(resultDefinitionSchema).min(1),
      profiles: z.array(resultProfileSchema).default([]),
      entities: z.array(rankingEntitySchema).default([]),
      compatibility: compatibilitySettingsSchema.default({ enabled: false }),
      compatibilityPairs: z.array(compatibilityPairSchema).default([])
    }),
    presentation: z.object({
      theme: z.enum(PRESENTATION_THEME_IDS).default("editorial"),
      blocks: z.array(presentationBlockSchema).default([]),
      shareCard: shareCardSchema.default({ enabled: false })
    }),
    assets: z.record(z.string()).default({})
  })
  .superRefine((assessment, ctx) => {
    if (assessment.schemaVersion !== supportedSchemaVersion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["schemaVersion"],
        message: `invalid schema version "${assessment.schemaVersion}"`
      });
    }

    addDuplicateIssues(ctx, ["dimensions"], assessment.dimensions.map((item) => item.id), "duplicate dimension id");
    addDuplicateIssues(ctx, ["questions"], assessment.questions.map((item) => item.id), "duplicate question id");
    addDuplicateIssues(ctx, ["results", "catalog"], assessment.results.catalog.map((item) => item.id), "duplicate result id");
    addDuplicateIssues(
      ctx,
      ["results", "compatibilityPairs"],
      assessment.results.compatibilityPairs.map((item) => item.id),
      "duplicate compatibility pair id"
    );

    const dimensionIds = new Set(assessment.dimensions.map((dimension) => dimension.id));
    const resultIds = new Set(assessment.results.catalog.map((result) => result.id));
    const compatibilityDimensionIds = new Set(assessment.results.compatibility.dimensions.map((dimension) => dimension.id));

    assessment.dimensions.forEach((dimension, index) => {
      if (dimension.max <= dimension.min) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dimensions", index],
          message: `dimension "${dimension.id}" must have max greater than min`
        });
      }
    });

    assessment.questions.forEach((question, questionIndex) => {
      if (!question.id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions", questionIndex, "id"],
          message: "missing question ID"
        });
      }
      addDuplicateIssues(
        ctx,
        ["questions", questionIndex, "options"],
        question.options.map((option) => option.id),
        `question "${question.id}" has duplicate option id`
      );
      question.options.forEach((option, optionIndex) => {
        if (!option.id) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["questions", questionIndex, "options", optionIndex, "id"],
            message: `question "${question.id}" has missing option ID`
          });
        }
        Object.entries(option.weights).forEach(([dimensionId, weight]) => {
          if (!Number.isFinite(weight)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["questions", questionIndex, "options", optionIndex, "weights", dimensionId],
              message: `invalid weight for dimension "${dimensionId}"`
            });
          }
          if (!dimensionIds.has(dimensionId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["questions", questionIndex, "options", optionIndex, "weights", dimensionId],
              message: `question "${question.id}" references unknown dimension "${dimensionId}"`
            });
          }
        });
      });
    });

    const availableCapabilities = new Set<ScoringCapabilityId>();
    if (assessment.results.profiles.length > 0) {
      availableCapabilities.add("profiles");
    }
    if (assessment.results.entities.length > 0) {
      availableCapabilities.add("entities");
    }

    assessment.scoring.pipeline.forEach((step, index) => {
      const strategyCapabilities = SCORING_STRATEGY_CAPABILITIES[step.strategy];
      if (!SCORING_STRATEGY_IDS.includes(step.strategy) || !strategyCapabilities) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scoring", "pipeline", index, "strategy"],
          message: `unsupported scoring strategy "${step.strategy}"`
        });
        return;
      }

      const missingCapabilities = strategyCapabilities.requires.filter(
        (capability) => !availableCapabilities.has(capability)
      );
      if (missingCapabilities.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scoring", "pipeline", index, "strategy"],
          message: `scoring strategy "${step.strategy}" requires unavailable capabilities: ${missingCapabilities.join(", ")}`
        });
        return;
      }

      strategyCapabilities.provides.forEach((capability) => availableCapabilities.add(capability));
    });

    assessment.results.catalog.forEach((result, index) => {
      if (!result.title || !result.summary) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["results", "catalog", index],
          message: `missing required result data for "${result.id}"`
        });
      }
    });

    assessment.results.profiles.forEach((profile, profileIndex) => {
      if (!resultIds.has(profile.resultId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["results", "profiles", profileIndex, "resultId"],
          message: `profile "${profile.id}" references unknown result ID "${profile.resultId}"`
        });
      }
      validateDimensionTargets(ctx, ["results", "profiles", profileIndex, "dimensionTargets"], profile.dimensionTargets, dimensionIds);
    });

    assessment.results.entities.forEach((entity, entityIndex) => {
      if (!resultIds.has(entity.resultId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["results", "entities", entityIndex, "resultId"],
          message: `entity "${entity.id}" references unknown result ID "${entity.resultId}"`
        });
      }
      validateDimensionTargets(ctx, ["results", "entities", entityIndex, "dimensionTargets"], entity.dimensionTargets, dimensionIds);
    });

    addDuplicateIssues(
      ctx,
      ["results", "compatibility", "dimensions"],
      assessment.results.compatibility.dimensions.map((dimension) => dimension.id),
      "duplicate compatibility dimension id"
    );

    if (assessment.results.compatibilityPairs.length > 0 && !assessment.results.compatibility.enabled) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["results", "compatibility", "enabled"],
        message: "compatibility pairs require compatibility to be enabled"
      });
    }

    const compatibilityPairKeys = new Set<string>();
    assessment.results.compatibilityPairs.forEach((pair, pairIndex) => {
      [pair.resultAId, pair.resultBId].forEach((resultId) => {
        if (!resultIds.has(resultId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["results", "compatibilityPairs", pairIndex],
            message: `compatibility pair "${pair.id}" references unknown result ID "${resultId}"`
          });
        }
      });

      const mode = assessment.results.compatibility.mode;
      const pairKey = compatibilityPairKey(pair.resultAId, pair.resultBId, mode);
      if (compatibilityPairKeys.has(pairKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["results", "compatibilityPairs", pairIndex],
          message: `duplicate ${mode} compatibility pair "${pair.resultAId}" and "${pair.resultBId}"`
        });
      }
      compatibilityPairKeys.add(pairKey);

      Object.keys(pair.scores).forEach((scoreId) => {
        if (scoreId !== "overall" && !compatibilityDimensionIds.has(scoreId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["results", "compatibilityPairs", pairIndex, "scores", scoreId],
            message: `compatibility pair "${pair.id}" references unknown compatibility dimension "${scoreId}"`
          });
        }
      });
      if (!pair.summary && !pair.relationshipCopy) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["results", "compatibilityPairs", pairIndex, "summary"],
          message: `compatibility pair "${pair.id}" requires summary or relationshipCopy`
        });
      }
    });

    if (assessment.results.compatibility.enabled && !assessment.results.compatibility.allowPartialCoverage) {
      const resultIdList = assessment.results.catalog.map((result) => result.id);
      const mode = assessment.results.compatibility.mode;
      const expectedKeys = expectedCompatibilityPairKeys(resultIdList, mode);
      const actualKeys = new Set(
        assessment.results.compatibilityPairs.map((pair) => compatibilityPairKey(pair.resultAId, pair.resultBId, mode))
      );
      const missingKeys = expectedKeys.filter((key) => !actualKeys.has(key));
      if (missingKeys.length > 0 || actualKeys.size !== expectedKeys.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["results", "compatibilityPairs"],
          message: `compatibility coverage defines ${actualKeys.size} of ${expectedKeys.length} expected ${mode} pairs`
        });
      }
    }

    assessment.presentation.blocks.forEach((block, blockIndex) => {
      if (block.type === PRESENTATION_BLOCK.compatibility && !assessment.results.compatibility.enabled) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["presentation", "blocks", blockIndex, "type"],
          message: "compatibility block requires enabled compatibility data"
        });
      }

      if (block.type === PRESENTATION_BLOCK.spectrum) {
        Object.keys(block.endpoints).forEach((dimensionId) => {
          if (!dimensionIds.has(dimensionId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["presentation", "blocks", blockIndex, "endpoints", dimensionId],
              message: `spectrum block references unknown dimension "${dimensionId}"`
            });
          }
        });
      }

      if (block.type === PRESENTATION_BLOCK.quote) {
        addDuplicateIssues(
          ctx,
          ["presentation", "blocks", blockIndex, "statements"],
          block.statements.map((statement) => statement.resultId),
          "duplicate quote result ID"
        );
        block.statements.forEach((statement, statementIndex) => {
          if (!resultIds.has(statement.resultId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["presentation", "blocks", blockIndex, "statements", statementIndex, "resultId"],
              message: `quote block references unknown result ID "${statement.resultId}"`
            });
          }
        });
      }

      if (block.type === PRESENTATION_BLOCK.quadrant) {
        [block.xDimension, block.yDimension].forEach((dimensionId) => {
          if (!dimensionIds.has(dimensionId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["presentation", "blocks", blockIndex],
              message: `quadrant block references unknown dimension "${dimensionId}"`
            });
          }
        });
      }
    });

    assessment.presentation.shareCard.dimensionIds.forEach((dimensionId, dimensionIndex) => {
      if (!dimensionIds.has(dimensionId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["presentation", "shareCard", "dimensionIds", dimensionIndex],
          message: `share card references unknown dimension "${dimensionId}"`
        });
      }
    });
  });

export type AssessmentPackage = z.infer<typeof AssessmentPackageSchema>;
export type Question = AssessmentPackage["questions"][number];
export type ScoringStep = AssessmentPackage["scoring"]["pipeline"][number];
export type PresentationBlockConfig = AssessmentPackage["presentation"]["blocks"][number];

export function validateAssessmentPackage(input: unknown): { success: true; data: AssessmentPackage } | { success: false; errors: string[] } {
  const result = AssessmentPackageSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    })
  };
}

function addDuplicateIssues(ctx: z.RefinementCtx, path: (string | number)[], ids: string[], message: string) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  ids.forEach((id) => {
    if (seen.has(id)) {
      duplicates.add(id);
    }
    seen.add(id);
  });
  duplicates.forEach((id) => {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path,
      message: `${message} "${id}"`
    });
  });
}

function validateDimensionTargets(
  ctx: z.RefinementCtx,
  path: (string | number)[],
  targets: Record<string, number>,
  dimensionIds: Set<string>
) {
  Object.entries(targets).forEach(([dimensionId, value]) => {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, dimensionId],
        message: `invalid target value for dimension "${dimensionId}"`
      });
    }
    if (!dimensionIds.has(dimensionId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, dimensionId],
        message: `references unknown dimension "${dimensionId}"`
      });
    }
  });
}

function compatibilityPairKey(resultAId: string, resultBId: string, mode: "symmetric" | "directional") {
  if (mode === "directional") {
    return `${resultAId}->${resultBId}`;
  }
  return [resultAId, resultBId].sort().join("<->");
}

function expectedCompatibilityPairKeys(resultIds: string[], mode: "symmetric" | "directional") {
  const keys: string[] = [];
  resultIds.forEach((resultAId, leftIndex) => {
    resultIds.forEach((resultBId, rightIndex) => {
      if (mode === "symmetric" && rightIndex < leftIndex) {
        return;
      }
      keys.push(compatibilityPairKey(resultAId, resultBId, mode));
    });
  });
  return keys;
}
