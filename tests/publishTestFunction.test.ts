import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deleteAdminTest } from "../functions/api/admin/tests/[id]";
import { listAdminTests } from "../functions/api/admin/tests";
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

describe("admin tests Pages Function", () => {
  it("rejects the wrong admin secret", async () => {
    const response = await listAdminTests(makeAdminTestsRequest("wrong"), env);

    assert.equal(response.status, 401);
  });

  it("returns minimal published test metadata with the correct secret", async () => {
    const response = await listAdminTests(makeAdminTestsRequest(), env);
    const body = await response.json() as Array<Record<string, unknown>>;
    const demo = body.find((item) => item.id === "demo-personality");

    assert.equal(response.status, 200);
    assert.ok(demo);
    assert.equal(demo.title, assessment.metadata.title);
    assert.equal(demo.questionCount, assessment.questions.length);
    assert.equal(demo.resultCount, assessment.results.catalog.length);
    assert.equal(demo.theme, assessment.presentation.theme);
    assert.equal(typeof demo.category, "string");
    assert.equal("questions" in demo, false);
    assert.equal("results" in demo, false);
    assert.equal("presentation" in demo, false);
    assert.equal("scoring" in demo, false);
  });
});

describe("delete admin test Pages Function", () => {
  it("rejects the wrong admin secret", async () => {
    const response = await deleteAdminTest(makeDeleteRequest("demo-personality", "wrong"), env, "demo-personality", mockFetch([]));

    assert.equal(response.status, 401);
  });

  it("rejects invalid test ids before calling GitHub", async () => {
    const calls: Request[] = [];
    const response = await deleteAdminTest(makeDeleteRequest("bad/../id"), env, "bad/../id", recordingFetch(calls, []));

    assert.equal(response.status, 400);
    assert.equal(calls.length, 0);
  });

  it("returns 404 when the GitHub file does not exist", async () => {
    const calls: Request[] = [];
    const response = await deleteAdminTest(
      makeDeleteRequest("demo-personality"),
      env,
      "demo-personality",
      recordingFetch(calls, [json({}, 404)])
    );

    assert.equal(response.status, 404);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, "GET");
  });

  it("fetches the SHA then sends a GitHub DELETE", async () => {
    const calls: Request[] = [];
    const response = await deleteAdminTest(
      makeDeleteRequest("demo-personality"),
      env,
      "demo-personality",
      recordingFetch(calls, [json({ sha: "existing-sha" }), json({ commit: { html_url: "https://github.test/commit/delete", sha: "delete123" } })])
    );
    const body = await response.json() as { commitSha?: string; commitUrl?: string; ok?: boolean; testId?: string };

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.testId, "demo-personality");
    assert.equal(body.commitSha, "delete123");
    assert.equal(body.commitUrl, "https://github.test/commit/delete");
    assert.equal(calls.length, 2);
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[1].method, "DELETE");
    const deleteBody = await calls[1].json() as { branch: string; message: string; sha: string };
    assert.equal(deleteBody.branch, "main");
    assert.equal(deleteBody.message, "Delete test: demo-personality");
    assert.equal(deleteBody.sha, "existing-sha");
  });

  it("constructs the delete path server-side from the validated id", async () => {
    const calls: Request[] = [];
    await deleteAdminTest(
      makeDeleteRequest("demo-personality?path=evil"),
      env,
      "demo-personality",
      recordingFetch(calls, [json({ sha: "existing-sha" }), json({ commit: { sha: "delete123" } })])
    );

    assert.match(calls[0].url, /owner\/repo/);
    assert.match(calls[0].url, /content\/tests\/demo-personality\/test\.json|content%2Ftests%2Fdemo-personality%2Ftest\.json/);
    assert.doesNotMatch(calls[0].url, /evil/);
  });

  it("returns a safe 5xx when GitHub delete fails", async () => {
    const response = await deleteAdminTest(
      makeDeleteRequest("demo-personality"),
      env,
      "demo-personality",
      mockFetch([json({ sha: "existing-sha" }), json({ message: "bad credentials token gh-token" }, 500)])
    );
    const bodyText = await response.text();

    assert.equal(response.status, 502);
    assert.doesNotMatch(bodyText, /gh-token/);
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

function makeAdminTestsRequest(secret = env.PUBLISH_SECRET) {
  return new Request("https://example.com/api/admin/tests", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secret}`
    }
  });
}

function makeDeleteRequest(testId: string, secret = env.PUBLISH_SECRET) {
  return new Request(`https://example.com/api/admin/tests/${encodeURIComponent(testId)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${secret}`
    }
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
