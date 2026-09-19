import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createRunnerSession, answerQuestion } from "../engine/runner/runner";
import { clearProgress, loadProgress, progressStorageKey, saveProgress } from "../engine/storage/progressStorage";
import { registeredAssessments } from "../registry/assessmentRegistry";
import { sessionKey, useAssessmentStore } from "../store/assessmentStore";

describe("progress persistence", () => {
  const assessment = registeredAssessments.find((item) => item.metadata.id === "demo-personality");
  assert.ok(assessment);

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
});

function storeRawSession(assessment: NonNullable<(typeof registeredAssessments)[number]>, session: unknown) {
  localStorage.setItem(progressStorageKey(assessment.metadata.id, assessment.metadata.version), JSON.stringify(session));
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
