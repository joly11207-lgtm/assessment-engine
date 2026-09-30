import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createRunnerSession, answerQuestion } from "../engine/runner/runner";
import { scoreAssessment } from "../engine/scoring/scorers";
import {
  clearCompletedResult,
  completedResultStorageKey,
  loadCompletedResult,
  saveCompletedResult
} from "../engine/storage/completedResultStorage";
import { clearProgress, loadProgress, progressStorageKey, saveProgress } from "../engine/storage/progressStorage";
import { registeredAssessments } from "../registry/assessmentRegistry";
import { sessionKey, useAssessmentStore } from "../store/assessmentStore";

describe("progress persistence", () => {
  const assessment = registeredAssessments.find((item) => item.metadata.id === "demo-personality");
  assert.ok(assessment);
  const otherAssessment = registeredAssessments.find((item) => item.metadata.id === "demo-ranking");
  assert.ok(otherAssessment);

  beforeEach(() => {
    installLocalStorageMock();
    localStorage.clear();
  });

  it("uses test id and version in storage keys", () => {
    assert.equal(progressStorageKey("animal", "v1"), "assessment:animal:v1:progress");
  });

  it("saves, restores, and clears unfinished progress", () => {
    const session = answerQuestion(createRunnerSession(assessment!), assessment!.questions[0].id, assessment!.questions[0].options[0].id);
    saveProgress(session);

    assert.equal(loadProgress(assessment!)?.answers[assessment!.questions[0].id], assessment!.questions[0].options[0].id);

    clearProgress(assessment!);
    assert.equal(loadProgress(assessment!), undefined);
  });

  it("discards corrupt JSON without throwing", () => {
    const key = progressStorageKey(assessment!.metadata.id, assessment!.metadata.version);
    localStorage.setItem(key, "{not-json");

    assert.doesNotThrow(() => loadProgress(assessment!));
    assert.equal(loadProgress(assessment!), undefined);
    assert.equal(localStorage.getItem(key), null);
  });

  it("ignores and discards a stale assessment version", () => {
    const session = { ...createRunnerSession(assessment!), assessmentVersion: "stale-version" };
    storeRawSession(assessment!, session);

    assert.equal(loadProgress(assessment!), undefined);
  });

  it("rejects an out-of-range current index", () => {
    const session = { ...createRunnerSession(assessment!), currentIndex: assessment!.questions.length };
    storeRawSession(assessment!, session);

    assert.equal(loadProgress(assessment!), undefined);
  });

  it("rejects unknown question and option IDs", () => {
    const base = createRunnerSession(assessment!);
    storeRawSession(assessment!, { ...base, answers: { missing: "option" } });
    assert.equal(loadProgress(assessment!), undefined);

    storeRawSession(assessment!, { ...base, answers: { [assessment!.questions[0].id]: "missing-option" } });
    assert.equal(loadProgress(assessment!), undefined);
  });

  it("keeps the in-memory runner usable when storage writes and removals throw", () => {
    installThrowingLocalStorageMock();
    useAssessmentStore.setState({ sessions: {}, results: {} });

    assert.doesNotThrow(() => useAssessmentStore.getState().startAssessment(assessment!));
    assert.doesNotThrow(() =>
      useAssessmentStore
        .getState()
        .answer(assessment!, assessment!.questions[0].id, assessment!.questions[0].options[0].id)
    );
    assert.equal(
      useAssessmentStore.getState().sessions[sessionKey(assessment!)]?.answers[assessment!.questions[0].id],
      assessment!.questions[0].options[0].id
    );

    const session = createRunnerSession(assessment!);
    assert.doesNotThrow(() => saveProgress(session));
    assert.doesNotThrow(() => clearProgress(assessment!));
  });

  it("uses one completed-result storage key per test id", () => {
    assert.equal(completedResultStorageKey("animal"), "assessment:animal:completed");
  });

  it("saves, restores, and clears a completed single-person result", () => {
    const answers = validAnswers(assessment!);
    const result = scoreAssessment(assessment!, answers);

    saveCompletedResult(assessment!, answers, result);
    const restored = loadCompletedResult(assessment!);

    assert.equal(restored?.testVersion, assessment!.metadata.version);
    assert.deepEqual(restored?.answers, answers);
    assert.equal(restored?.result.primaryResult?.id, result.primaryResult?.id);

    clearCompletedResult(assessment!);
    assert.equal(loadCompletedResult(assessment!), undefined);
  });

  it("ignores and discards a completed result from an old test version", () => {
    const answers = validAnswers(assessment!);
    const result = scoreAssessment(assessment!, answers);
    localStorage.setItem(
      completedResultStorageKey(assessment!.metadata.id),
      JSON.stringify({
        answers,
        result: { ...result, metadata: { ...result.metadata, assessmentVersion: "old-version" } },
        completedAt: result.metadata.completedAt,
        testVersion: "old-version"
      })
    );

    assert.equal(loadCompletedResult(assessment!), undefined);
    assert.equal(localStorage.getItem(completedResultStorageKey(assessment!.metadata.id)), null);
  });

  it("clears only the completed record for the current test id", () => {
    const answers = validAnswers(assessment!);
    const otherAnswers = validAnswers(otherAssessment!);
    saveCompletedResult(assessment!, answers, scoreAssessment(assessment!, answers));
    saveCompletedResult(otherAssessment!, otherAnswers, scoreAssessment(otherAssessment!, otherAnswers));

    clearCompletedResult(assessment!);

    assert.equal(loadCompletedResult(assessment!), undefined);
    assert.equal(loadCompletedResult(otherAssessment!)?.testVersion, otherAssessment!.metadata.version);
  });

  it("keeps completed-result persistence best-effort when storage writes and removals throw", () => {
    installThrowingLocalStorageMock();
    const answers = validAnswers(assessment!);
    const result = scoreAssessment(assessment!, answers);

    assert.doesNotThrow(() => saveCompletedResult(assessment!, answers, result));
    assert.doesNotThrow(() => clearCompletedResult(assessment!));
    assert.equal(loadCompletedResult(assessment!), undefined);
  });
});

function storeRawSession(assessment: NonNullable<(typeof registeredAssessments)[number]>, session: unknown) {
  localStorage.setItem(progressStorageKey(assessment.metadata.id, assessment.metadata.version), JSON.stringify(session));
}

function validAnswers(assessment: NonNullable<(typeof registeredAssessments)[number]>) {
  return Object.fromEntries(assessment.questions.map((question) => [question.id, question.options[0].id]));
}

function installLocalStorageMock() {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear()
    },
    configurable: true
  });
}

function installThrowingLocalStorageMock() {
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("Storage blocked", "SecurityError");
      },
      removeItem: () => {
        throw new DOMException("Storage blocked", "SecurityError");
      },
      clear: () => undefined
    },
    configurable: true
  });
}
