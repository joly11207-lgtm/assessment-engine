import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { registeredAssessments } from "../registry/assessmentRegistry";
import { validateAssessmentPackage } from "../schema/assessmentSchema";

const demoPersonality = registeredAssessments.find((assessment) => assessment.metadata.id === "demo-personality");
assert.ok(demoPersonality);

describe("assessment schema validation", () => {
  it("accepts a valid fixture", () => {
    const result = validateAssessmentPackage(demoPersonality);
    assert.equal(result.success, true);
  });

  it("accepts every existing fixture pipeline", () => {
    registeredAssessments.forEach((assessment) => {
      assert.equal(validateAssessmentPackage(assessment).success, true, assessment.metadata.id);
    });
  });

  it("keeps current zh-CN demo fixtures free of retained English user-facing copy", () => {
    const hits = registeredAssessments
      .filter((assessment) => ["demo-personality", "demo-ranking", "demo-relationship"].includes(assessment.metadata.id))
      .flatMap((assessment) => findEnglishUserCopy(assessment));

    assert.deepEqual(hits, []);
  });

  it("rejects profile matching before normalized dimensions are available", () => {
    const invalid = {
      ...demoPersonality,
      scoring: {
        pipeline: [
          { strategy: "profile-match" },
          { strategy: "weighted-dimension" },
          { strategy: "normalize" }
        ]
      }
    };

    const result = validateAssessmentPackage(invalid);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.match(result.errors.join("\n"), /profile-match.*normalizedDimensions/);
    }
  });

  it("rejects entity ranking without normalized dimensions", () => {
    const ranking = registeredAssessments.find((assessment) => assessment.metadata.id === "demo-ranking");
    assert.ok(ranking);

    const result = validateAssessmentPackage({
      ...ranking,
      scoring: { pipeline: [{ strategy: "entity-ranking" }] }
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.match(result.errors.join("\n"), /entity-ranking.*normalizedDimensions/);
    }
  });

  it("reports invalid versions, duplicate IDs, unknown dimensions, unknown results, and unsupported blocks", () => {
    const broken = {
      ...demoPersonality,
      schemaVersion: "2.0",
      dimensions: [demoPersonality.dimensions[0], demoPersonality.dimensions[0]],
      questions: [
        demoPersonality.questions[0],
        {
          ...demoPersonality.questions[0],
          options: [
            { id: "a", label: "A", weights: { creativty: 1 } },
            { id: "a", label: "B", weights: {} }
          ]
        }
      ],
      scoring: { pipeline: [{ strategy: "threshold-band" }] },
      results: {
        ...demoPersonality.results,
        profiles: [{ id: "bad-profile", resultId: "missing-result", dimensionTargets: { curiosity: 50 } }]
      },
      presentation: demoPersonality.presentation
    };

    const result = validateAssessmentPackage(broken);

    assert.equal(result.success, false);
    if (!result.success) {
      const errors = result.errors.join("\n");
      assert.match(errors, /invalid schema version/);
      assert.match(errors, /duplicate dimension id/);
      assert.match(errors, /duplicate question id/);
      assert.match(errors, /duplicate option id/);
      assert.match(errors, /unknown dimension "creativty"/);
      assert.match(errors, /unsupported scoring strategy/);
      assert.match(errors, /unknown result ID/);
    }
  });

  it("rejects unknown and invalid result block configurations", () => {
    const unknownBlock = validateAssessmentPackage({
      ...demoPersonality,
      presentation: { blocks: [{ type: "unknown-block" }] }
    });
    const invalidRanking = validateAssessmentPackage({
      ...demoPersonality,
      presentation: { blocks: [{ type: "ranking", limit: 0 }] }
    });

    assert.equal(unknownBlock.success, false);
    assert.equal(invalidRanking.success, false);
  });

  it("validates reusable theme IDs and hero variants", () => {
    const invalidTheme = validateAssessmentPackage({
      ...demoPersonality,
      presentation: { ...demoPersonality.presentation, theme: "bespoke-css" }
    });
    const invalidHero = validateAssessmentPackage({
      ...demoPersonality,
      presentation: { blocks: [{ type: "hero", variant: "assessment-specific" }] }
    });

    assert.equal(invalidTheme.success, false);
    assert.equal(invalidHero.success, false);
  });

  it("validates Chinese discovery metadata for homepage cards", () => {
    const invalidCategory = validateAssessmentPackage({
      ...demoPersonality,
      metadata: {
        ...demoPersonality.metadata,
        discovery: { ...demoPersonality.metadata.discovery, category: "secret-test-kind" }
      }
    });
    const invalidCoverStyle = validateAssessmentPackage({
      ...demoPersonality,
      metadata: {
        ...demoPersonality.metadata,
        discovery: { ...demoPersonality.metadata.discovery, coverStyle: "custom-css-cover" }
      }
    });

    assert.equal(invalidCategory.success, false);
    assert.equal(invalidCoverStyle.success, false);
  });

  it("validates quadrant dimension references", () => {
    const valid = validateAssessmentPackage({
      ...demoPersonality,
      presentation: {
        ...demoPersonality.presentation,
        blocks: [{ type: "quadrant", xDimension: "curiosity", yDimension: "empathy" }]
      }
    });
    const invalid = validateAssessmentPackage({
      ...demoPersonality,
      presentation: {
        ...demoPersonality.presentation,
        blocks: [{ type: "quadrant", xDimension: "curiosity", yDimension: "missing-dimension" }]
      }
    });

    assert.equal(valid.success, true);
    assert.equal(invalid.success, false);
    if (!invalid.success) {
      assert.match(invalid.errors.join("\n"), /quadrant block references unknown dimension/);
    }
  });

  it("validates strict share card configuration and dimension references", () => {
    const invalidLayout = validateAssessmentPackage({
      ...demoPersonality,
      presentation: {
        ...demoPersonality.presentation,
        shareCard: { enabled: true, layout: "panorama" }
      }
    });
    const invalidDimension = validateAssessmentPackage({
      ...demoPersonality,
      presentation: {
        ...demoPersonality.presentation,
        shareCard: { enabled: true, layout: "portrait", dimensionIds: ["unknown-dimension"] }
      }
    });
    const untypedSetting = validateAssessmentPackage({
      ...demoPersonality,
      presentation: {
        ...demoPersonality.presentation,
        shareCard: { enabled: true, layout: "portrait", customCss: "body { display: none }" }
      }
    });

    assert.equal(invalidLayout.success, false);
    assert.equal(invalidDimension.success, false);
    assert.equal(untypedSetting.success, false);
  });

  it("validates compatibility schema integrity", () => {
    const relationship = registeredAssessments.find((assessment) => assessment.metadata.id === "demo-relationship");
    assert.ok(relationship);

    const duplicatePair = validateAssessmentPackage({
      ...relationship,
      results: {
        ...relationship.results,
        compatibilityPairs: [
          ...relationship.results.compatibilityPairs,
          {
            ...relationship.results.compatibilityPairs[0],
            id: "duplicate-reverse",
            resultAId: relationship.results.compatibilityPairs[0].resultBId,
            resultBId: relationship.results.compatibilityPairs[0].resultAId
          }
        ]
      }
    });
    const outOfRangeScore = validateAssessmentPackage({
      ...relationship,
      results: {
        ...relationship.results,
        compatibility: { ...relationship.results.compatibility, allowPartialCoverage: true },
        compatibilityPairs: [
          {
            ...relationship.results.compatibilityPairs[0],
            scores: { overall: 101, communication: 80 }
          }
        ]
      }
    });
    const unknownScoreDimension = validateAssessmentPackage({
      ...relationship,
      results: {
        ...relationship.results,
        compatibility: { ...relationship.results.compatibility, allowPartialCoverage: true },
        compatibilityPairs: [
          {
            ...relationship.results.compatibilityPairs[0],
            scores: { overall: 80, secret: 70 }
          }
        ]
      }
    });
    const unknownResult = validateAssessmentPackage({
      ...relationship,
      results: {
        ...relationship.results,
        compatibility: { ...relationship.results.compatibility, allowPartialCoverage: true },
        compatibilityPairs: [
          {
            ...relationship.results.compatibilityPairs[0],
            resultBId: "missing-result"
          }
        ]
      }
    });
    const blockWithoutData = validateAssessmentPackage({
      ...demoPersonality,
      presentation: {
        ...demoPersonality.presentation,
        blocks: [{ type: "compatibility" }]
      }
    });

    assert.equal(duplicatePair.success, false);
    assert.equal(outOfRangeScore.success, false);
    assert.equal(unknownScoreDimension.success, false);
    assert.equal(unknownResult.success, false);
    assert.equal(blockWithoutData.success, false);
  });

  it("validates complete compatibility coverage by actual pair keys", () => {
    const relationship = registeredAssessments.find((assessment) => assessment.metadata.id === "demo-relationship");
    assert.ok(relationship);

    const completeSymmetric = validateAssessmentPackage(relationship);
    const incompleteSymmetric = validateAssessmentPackage({
      ...relationship,
      results: {
        ...relationship.results,
        compatibilityPairs: relationship.results.compatibilityPairs.slice(0, -1)
      }
    });
    const completeDirectional = validateAssessmentPackage({
      ...relationship,
      results: {
        ...relationship.results,
        compatibility: {
          ...relationship.results.compatibility,
          mode: "directional" as const,
          allowPartialCoverage: false
        },
        compatibilityPairs: buildDirectionalPairs(relationship)
      }
    });
    const incompleteDirectional = validateAssessmentPackage({
      ...relationship,
      results: {
        ...relationship.results,
        compatibility: {
          ...relationship.results.compatibility,
          mode: "directional" as const,
          allowPartialCoverage: false
        },
        compatibilityPairs: buildDirectionalPairs(relationship).slice(0, -1)
      }
    });

    assert.equal(completeSymmetric.success, true);
    assert.equal(incompleteSymmetric.success, false);
    assert.equal(completeDirectional.success, true);
    assert.equal(incompleteDirectional.success, false);
  });

  it("rejects presentation copy that references unknown result IDs", () => {
    const result = validateAssessmentPackage({
      ...demoPersonality,
      presentation: {
        blocks: [
          {
            type: "quote",
            statements: [{ resultId: "missing-result", text: "Unknown result copy" }]
          }
        ]
      }
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.match(result.errors.join("\n"), /quote block references unknown result ID/);
    }
  });
});

function buildDirectionalPairs(assessment: typeof registeredAssessments[number]) {
  return assessment.results.catalog.flatMap((source) =>
    assessment.results.catalog.map((target) => ({
      id: `${source.id}-to-${target.id}`,
      resultAId: source.id,
      resultBId: target.id,
      scores: { overall: source.id === target.id ? 82 : 71, communication: 70 },
      strengths: ["方向清晰"],
      frictionPoints: ["需要确认期待"],
      summary: `${source.title} 看 ${target.title} 的关系视角。`
    }))
  );
}

function findEnglishUserCopy(assessment: typeof registeredAssessments[number]) {
  const hits: string[] = [];
  const push = (path: string, value: unknown) => {
    if (typeof value === "string" && /[A-Za-z]{3,}/.test(value)) {
      hits.push(`${assessment.metadata.id}.${path}: ${value}`);
    }
  };

  push("metadata.title", assessment.metadata.title);
  push("metadata.description", assessment.metadata.description);
  push("metadata.discovery.shortTitle", assessment.metadata.discovery.shortTitle);
  push("metadata.discovery.badge", assessment.metadata.discovery.badge);
  push("metadata.discovery.resultPreview", assessment.metadata.discovery.resultPreview);

  assessment.dimensions.forEach((dimension, dimensionIndex) => {
    push(`dimensions.${dimensionIndex}.label`, dimension.label);
    push(`dimensions.${dimensionIndex}.description`, dimension.description);
  });

  assessment.questions.forEach((question, questionIndex) => {
    push(`questions.${questionIndex}.text`, question.text);
    question.options.forEach((option, optionIndex) => {
      push(`questions.${questionIndex}.options.${optionIndex}.label`, option.label);
    });
  });

  assessment.results.catalog.forEach((result, resultIndex) => {
    push(`results.catalog.${resultIndex}.title`, result.title);
    push(`results.catalog.${resultIndex}.summary`, result.summary);
    result.tags.forEach((tag, tagIndex) => push(`results.catalog.${resultIndex}.tags.${tagIndex}`, tag));
  });

  assessment.results.compatibilityPairs?.forEach((pair, pairIndex) => {
    pair.strengths.forEach((strength, strengthIndex) => {
      push(`results.compatibilityPairs.${pairIndex}.strengths.${strengthIndex}`, strength);
    });
    pair.frictionPoints.forEach((friction, frictionIndex) => {
      push(`results.compatibilityPairs.${pairIndex}.frictionPoints.${frictionIndex}`, friction);
    });
    push(`results.compatibilityPairs.${pairIndex}.relationshipCopy`, pair.relationshipCopy);
    push(`results.compatibilityPairs.${pairIndex}.summary`, pair.summary);
    push(`results.compatibilityPairs.${pairIndex}.advice`, pair.advice);
  });

  assessment.results.compatibility.dimensions.forEach((dimension, dimensionIndex) => {
    push(`results.compatibility.dimensions.${dimensionIndex}.label`, dimension.label);
  });

  assessment.presentation.blocks.forEach((block, blockIndex) => {
    if ("title" in block) {
      push(`presentation.blocks.${blockIndex}.title`, block.title);
    }
    if (block.type === "quote") {
      push(`presentation.blocks.${blockIndex}.fallback`, block.fallback);
      block.statements?.forEach((statement, statementIndex) => {
        push(`presentation.blocks.${blockIndex}.statements.${statementIndex}.text`, statement.text);
      });
    }
    if (block.type === "spectrum") {
      Object.entries(block.endpoints).forEach(([dimensionId, endpoints]) => {
        push(`presentation.blocks.${blockIndex}.endpoints.${dimensionId}.left`, endpoints.left);
        push(`presentation.blocks.${blockIndex}.endpoints.${dimensionId}.right`, endpoints.right);
      });
    }
    if (block.type === "quadrant") {
      Object.entries(block.labels).forEach(([labelKey, labelValue]) => {
        push(`presentation.blocks.${blockIndex}.labels.${labelKey}`, labelValue);
      });
    }
    if (block.type === "highlight") {
      block.facts.forEach((fact, factIndex) => {
        push(`presentation.blocks.${blockIndex}.facts.${factIndex}.label`, fact.label);
        if (fact.source === "custom") {
          push(`presentation.blocks.${blockIndex}.facts.${factIndex}.value`, fact.value);
        }
      });
    }
  });

  const shareCard = assessment.presentation.shareCard;
  push("presentation.shareCard.headline", shareCard.headline);
  push("presentation.shareCard.subtitle", shareCard.subtitle);
  push("presentation.shareCard.brandingText", shareCard.brandingText);

  return hits;
}
