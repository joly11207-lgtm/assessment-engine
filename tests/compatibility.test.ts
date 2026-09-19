import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveCompatibility } from "../engine/compatibility/compatibility";
import { registeredAssessments } from "../registry/assessmentRegistry";
import { validateAssessmentPackage } from "../schema/assessmentSchema";

const relationship = registeredAssessments.find((assessment) => assessment.metadata.id === "demo-relationship");
assert.ok(relationship);

describe("generic compatibility resolver", () => {
  it("resolves symmetric pairs", () => {
    const result = resolveCompatibility(relationship, "steady-harbor", "kind-architect");

    assert.equal(result.status, "resolved");
    if (result.status === "resolved") {
      assert.equal(result.overallScore, 91);
      assert.equal(result.sourceResult.id, "steady-harbor");
      assert.equal(result.targetResult.id, "kind-architect");
      assert.equal(result.metadata.reversed, false);
    }
  });

  it("resolves reversed symmetric pairs to the same package pair", () => {
    const result = resolveCompatibility(relationship, "kind-architect", "steady-harbor");

    assert.equal(result.status, "resolved");
    if (result.status === "resolved") {
      assert.equal(result.pairId, "steady-harbor-kind-architect");
      assert.equal(result.overallScore, 91);
      assert.equal(result.metadata.reversed, true);
    }
  });

  it("resolves same-type pairs", () => {
    const result = resolveCompatibility(relationship, "open-trail", "open-trail");

    assert.equal(result.status, "resolved");
    if (result.status === "resolved") {
      assert.equal(result.pairId, "open-trail-open-trail");
      assert.equal(result.overallScore, 64);
    }
  });

  it("returns typed fallback states for missing pairs and unknown result IDs", () => {
    const partial = {
      ...relationship,
      results: {
        ...relationship.results,
        compatibility: { ...relationship.results.compatibility, allowPartialCoverage: true },
        compatibilityPairs: relationship.results.compatibilityPairs.slice(0, 1)
      }
    };

    assert.deepEqual(resolveCompatibility(partial, "steady-harbor", "kind-architect").status, "missing");
    assert.deepEqual(resolveCompatibility(relationship, "missing", "kind-architect").status, "missing");
    assert.deepEqual(resolveCompatibility(relationship, "steady-harbor", "missing").status, "missing");
  });

  it("supports directional pairs without symmetric fallback", () => {
    const directional = {
      ...relationship,
      results: {
        ...relationship.results,
        compatibility: {
          ...relationship.results.compatibility,
          mode: "directional" as const,
          allowPartialCoverage: true
        },
        compatibilityPairs: [
          {
            id: "a-to-b",
            resultAId: "steady-harbor",
            resultBId: "open-trail",
            scores: { overall: 71, communication: 70 },
            strengths: ["方向性内容"],
            frictionPoints: [],
            summary: "A 看 B 的关系视角。"
          },
          {
            id: "b-to-a",
            resultAId: "open-trail",
            resultBId: "steady-harbor",
            scores: { overall: 62, communication: 63 },
            strengths: ["反向内容"],
            frictionPoints: [],
            summary: "B 看 A 的关系视角。"
          }
        ]
      }
    };

    assert.equal(validateAssessmentPackage(directional).success, true);
    const forward = resolveCompatibility(directional, "steady-harbor", "open-trail");
    const reverse = resolveCompatibility(directional, "open-trail", "steady-harbor");

    assert.equal(forward.status, "resolved");
    assert.equal(reverse.status, "resolved");
    if (forward.status === "resolved" && reverse.status === "resolved") {
      assert.equal(forward.overallScore, 71);
      assert.equal(reverse.overallScore, 62);
      assert.equal(forward.metadata.reversed, false);
      assert.equal(reverse.metadata.reversed, false);
    }
  });
});
