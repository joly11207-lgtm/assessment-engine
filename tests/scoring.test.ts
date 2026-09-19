import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { registeredAssessments } from "../registry/assessmentRegistry";
import { scoreAssessment } from "../engine/scoring/scorers";

describe("scoring strategies", () => {
  it("scores weighted dimensions and normalizes them", () => {
    const assessment = registeredAssessments.find((item) => item.metadata.id === "demo-personality");
    assert.ok(assessment);
    const answers = Object.fromEntries(assessment!.questions.map((question) => [question.id, question.options[0].id]));

    const result = scoreAssessment(assessment!, answers);

    assert.equal(result.dimensions.length, assessment!.dimensions.length);
    assert.equal(result.dimensions.every((dimension) => dimension.normalized >= 0 && dimension.normalized <= 100), true);
    assert.ok(result.matches.length > 0);
    assert.ok(result.primaryResult);
  });

  it("returns profile matches sorted by similarity", () => {
    const assessment = registeredAssessments.find((item) => item.metadata.id === "demo-personality")!;
    const result = scoreAssessment(assessment, Object.fromEntries(assessment.questions.map((question) => [question.id, question.options[0].id])));

    assert.ok(result.matches[0].similarity >= result.matches[1].similarity);
    assert.equal(result.matches[0].rank, 1);
  });

  it("returns entity rankings sorted by score", () => {
    const assessment = registeredAssessments.find((item) => item.metadata.id === "demo-ranking")!;
    const result = scoreAssessment(assessment, Object.fromEntries(assessment.questions.map((question) => [question.id, question.options[0].id])));

    assert.equal(result.rankings.length, 5);
    assert.ok(result.rankings[0].score >= result.rankings[1].score);
    assert.equal(result.primaryResult?.id, result.rankings[0].id);
  });
});
