import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { strToU8, zipSync } from "fflate";
import { scoreAssessment } from "../engine/scoring/scorers";
import { registeredAssessments } from "../registry/assessmentRegistry";
import { createQuickPreviewResult, inferModel, loadPreviewPackageFromZip, previewZipLimits, runAcceptanceCases } from "../app/preview/zipPreviewLoader";

const personality = registeredAssessments.find((assessment) => assessment.metadata.id === "demo-personality");
assert.ok(personality);
const ranking = registeredAssessments.find((assessment) => assessment.metadata.id === "demo-ranking");
assert.ok(ranking);
const relationship = registeredAssessments.find((assessment) => assessment.metadata.id === "demo-relationship");
assert.ok(relationship);

const validAnswers = Object.fromEntries(personality.questions.map((question) => [question.id, question.options[0].id]));
const validResult = scoreAssessment(personality, validAnswers);
assert.ok(validResult.primaryResult);

describe("ZIP Test Previewer loader", () => {
  it("loads a root-level test.json", () => {
    const loaded = loadPreviewPackageFromZip(makeZip({ "test.json": JSON.stringify(personality) }));

    assert.equal(loaded.schemaStatus, "pass");
    assert.equal(loaded.assessment?.metadata.id, "demo-personality");
  });

  it("loads a test.json inside one top-level folder", () => {
    const loaded = loadPreviewPackageFromZip(makeZip({ "package/test.json": JSON.stringify(personality) }));

    assert.equal(loaded.schemaStatus, "pass");
    assert.equal(loaded.assessment?.metadata.id, "demo-personality");
  });

  it("rejects ZIPs without test.json", () => {
    const loaded = loadPreviewPackageFromZip(makeZip({ "readme.md": "no package here" }));

    assert.equal(loaded.schemaStatus, "fail");
    assert.match(loaded.errors.join("\n"), /No test\.json/);
  });

  it("rejects multiple test.json files instead of guessing", () => {
    const loaded = loadPreviewPackageFromZip(
      makeZip({
        "one/test.json": JSON.stringify(personality),
        "two/test.json": JSON.stringify(personality)
      })
    );

    assert.equal(loaded.schemaStatus, "fail");
    assert.match(loaded.errors.join("\n"), /Multiple test\.json/);
  });

  it("surfaces schema errors and does not produce a runnable assessment", () => {
    const invalid = {
      ...personality,
      metadata: { ...personality.metadata, id: "bad id with spaces" }
    };
    const loaded = loadPreviewPackageFromZip(makeZip({ "test.json": JSON.stringify(invalid) }));

    assert.equal(loaded.schemaStatus, "fail");
    assert.equal(loaded.assessment, undefined);
    assert.match(loaded.errors.join("\n"), /ids may only contain/);
  });

  it("rejects ZIPs whose preflight uncompressed size exceeds the limit", () => {
    const loaded = loadPreviewPackageFromZip(
      makeZip({
        "test.json": JSON.stringify(personality),
        "assets/oversized.bin": new Uint8Array(previewZipLimits.maxUncompressedBytes + 1)
      })
    );

    assert.equal(loaded.schemaStatus, "fail");
    assert.match(loaded.errors.join("\n"), /uncompressed content is too large/);
  });

  it("runs acceptance cases through the real scoring engine with pass and fail results", () => {
    const cases = [
      {
        id: "pass",
        title: "Expected primary result",
        answers: validAnswers,
        expectedPrimary: validResult.primaryResult?.id
      },
      {
        id: "fail",
        title: "Wrong expected result",
        answers: validAnswers,
        expectedResultId: "not-the-real-result"
      }
    ];
    const loaded = loadPreviewPackageFromZip(
      makeZip({
        "test.json": JSON.stringify(personality),
        "acceptance-cases.json": JSON.stringify(cases),
        "design-report.md": "# Design"
      })
    );

    assert.equal(loaded.schemaStatus, "pass");
    assert.equal(loaded.acceptanceCases.length, 2);
    assert.equal(loaded.acceptanceCases[0].expectedResultId, validResult.primaryResult?.id);
    assert.equal(loaded.designReport, "# Design");
    assert.ok(loaded.assessment);
    const runs = runAcceptanceCases(loaded.assessment, loaded.acceptanceCases);
    assert.equal(runs[0].passed, true);
    assert.equal(runs[1].passed, false);
    assert.equal(runs[0].actualResultId, validResult.primaryResult?.id);
  });

  it("infers package model from scoring and compatibility configuration", () => {
    assert.equal(inferModel(personality), "profile-match");
    assert.equal(inferModel(ranking), "entity-ranking");
    assert.equal(inferModel(relationship), "compatibility");
    assert.equal(
      inferModel({
        ...personality,
        results: {
          ...personality.results,
          catalog: [
            {
              ...personality.results.catalog[0],
              id: "high-band",
              title: "High Band"
            }
          ]
        }
      }),
      "profile-match"
    );
  });

  it("uses a matching acceptance case for quick preview before synthetic fallback", () => {
    const expectedPrimaryId = validResult.primaryResult!.id;
    const realPreview = createQuickPreviewResult(personality, expectedPrimaryId, [
      {
        id: "real",
        title: "Real scored preview",
        answers: validAnswers,
        expectedResultId: expectedPrimaryId
      }
    ]);
    const syntheticPreview = createQuickPreviewResult(personality, personality.results.catalog[0].id, []);

    assert.equal(realPreview.metadata.scoringStrategies.includes("preview"), false);
    assert.equal(realPreview.primaryResult?.id, expectedPrimaryId);
    assert.ok(syntheticPreview.dimensions.some((dimension) => dimension.normalized !== 0));
  });

  it("falls back to synthetic quick preview when the matching acceptance case fails", () => {
    const actualPrimaryId = validResult.primaryResult!.id;
    const requestedResult = personality.results.catalog.find((result) => result.id !== actualPrimaryId);
    assert.ok(requestedResult);

    const preview = createQuickPreviewResult(personality, requestedResult.id, [
      {
        id: "mismatch",
        title: "Expected result does not match scored answers",
        answers: validAnswers,
        expectedResultId: requestedResult.id
      }
    ]);

    assert.equal(preview.primaryResult?.id, requestedResult.id);
    assert.equal(preview.metadata.scoringStrategies.includes("preview"), true);
  });

  it("keeps existing registered fixtures runnable", () => {
    registeredAssessments.forEach((assessment) => {
      const answers = Object.fromEntries(assessment.questions.map((question) => [question.id, question.options[0].id]));
      const result = scoreAssessment(assessment, answers);

      assert.equal(result.metadata.assessmentId, assessment.metadata.id);
      assert.ok(result.primaryResult);
    });
  });
});

function makeZip(files: Record<string, string | Uint8Array>) {
  return zipSync(Object.fromEntries(Object.entries(files).map(([path, content]) => [path, typeof content === "string" ? strToU8(content) : content])));
}
