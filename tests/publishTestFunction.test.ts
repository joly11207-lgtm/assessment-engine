import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { publishTest } from "../functions/api/admin/publish-test";
import { registeredAssessments } from "../registry/assessmentRegistry";

const assessment = registeredAssessments.find((item) => item.metadata.id === "demo-personality");
assert.ok(assessment);

const env = {
  GITHUB_BRANCH: "main",
  GITHUB_OWNER: "owner",
  GITHUB_REPO: "repo",
  GITHUB_TOKEN: "gh-token",
  PUBLISH_SECRET: "publish-secret"
};

describe("publish-test Pages Function", () => {
  it("rejects invalid auth", async () => {
    const response = await publishTest(makeRequest({ assessment }, "wrong"), env, mockFetch([]));

    assert.equal(response.status, 401);
  });

  it("rejects invalid assessments before writing GitHub", async () => {
    const calls: Request[] = [];
    const response = await publishTest(
      makeRequest({ assessment: { ...assessment, metadata: { ...assessment.metadata, id: "bad id" } } }),
      env,
      async (input, init) => {
        calls.push(new Request(input, init));
        return json({}, 500);
      }
    );

    assert.equal(response.status, 400);
    assert.equal(calls.length, 0);
  });

  it("creates a new test when the target file is missing", async () => {
    const calls: Request[] = [];
    const response = await publishTest(
      makeRequest({ assessment, overwrite: false }),
      env,
      recordingFetch(calls, [json({}, 404), json({ commit: { html_url: "https://github.test/commit/new", sha: "abcdef123" } })])
    );

    assert.equal(response.status, 200);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].method, "GET");
    assert.match(calls[0].url, /content%2Ftests%2Fdemo-personality%2Ftest\.json\?ref=main|content\/tests\/demo-personality\/test\.json\?ref=main/);
    assert.equal(calls[1].method, "PUT");
    const putBody = await calls[1].json() as { content: string; message: string; sha?: string };
    assert.equal(putBody.message, "Add test: demo-personality");
    assert.equal(putBody.sha, undefined);
    assert.equal(JSON.parse(Buffer.from(putBody.content, "base64").toString("utf8")).metadata.id, "demo-personality");
  });

  it("returns 409 for an existing test without overwrite", async () => {
    const calls: Request[] = [];
    const response = await publishTest(
      makeRequest({ assessment, overwrite: false }),
      env,
      recordingFetch(calls, [json({ sha: "existing-sha" })])
    );
    const body = await response.json() as { existing?: boolean; testId?: string };

    assert.equal(response.status, 409);
    assert.equal(body.existing, true);
    assert.equal(body.testId, "demo-personality");
    assert.equal(calls.length, 1);
  });

  it("updates an existing test with overwrite and sha", async () => {
    const calls: Request[] = [];
    const response = await publishTest(
      makeRequest({ assessment, overwrite: true }),
      env,
      recordingFetch(calls, [json({ sha: "existing-sha" }), json({ commit: { sha: "fedcba987" } })])
    );

    assert.equal(response.status, 200);
    assert.equal(calls.length, 2);
    const putBody = await calls[1].json() as { message: string; sha?: string };
    assert.equal(putBody.message, "Update test: demo-personality");
    assert.equal(putBody.sha, "existing-sha");
  });

  it("returns a safe 5xx when GitHub fails", async () => {
    const response = await publishTest(
      makeRequest({ assessment, overwrite: false }),
      env,
      mockFetch([json({ message: "bad credentials token gh-token" }, 500)])
    );
    const bodyText = await response.text();

    assert.equal(response.status, 502);
    assert.doesNotMatch(bodyText, /gh-token/);
  });

  it("derives the target path from validated metadata id, not client input", async () => {
    const calls: Request[] = [];
    await publishTest(
      makeRequest({
        assessment,
        branch: "evil",
        owner: "evil",
        path: "content/tests/evil/test.json",
        repo: "evil"
      }),
      env,
      recordingFetch(calls, [json({}, 404), json({ commit: { sha: "abc" } })])
    );

    assert.match(calls[0].url, /owner\/repo/);
    assert.match(calls[0].url, /demo-personality/);
    assert.doesNotMatch(calls[0].url, /evil/);
  });
});

function makeRequest(body: unknown, secret = env.PUBLISH_SECRET) {
  return new Request("https://example.com/api/admin/publish-test", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function mockFetch(responses: Response[]) {
  return recordingFetch([], responses);
}

function recordingFetch(calls: Request[], responses: Response[]) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(new Request(input, init));
    return responses.shift() ?? json({}, 500);
  };
}
