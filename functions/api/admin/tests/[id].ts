const defaultOwner = "joly11207-lgtm";
const defaultRepo = "assessment-engine";
const defaultBranch = "main";
const frameworkIdPattern = /^[a-zA-Z0-9-_]+$/;

interface DeleteEnv {
  PUBLISH_SECRET?: string;
  GITHUB_TOKEN?: string;
  GITHUB_OWNER?: string;
  GITHUB_REPO?: string;
  GITHUB_BRANCH?: string;
}

interface PagesContext {
  request: Request;
  env: DeleteEnv;
  params: {
    id?: string;
  };
}

interface GitHubContent {
  sha?: string;
}

export async function onRequest(context: PagesContext) {
  if (context.request.method !== "DELETE") {
    return jsonResponse({ error: "Method not allowed" }, 405, { Allow: "DELETE" });
  }
  return deleteAdminTest(context.request, context.env, context.params.id, fetch);
}

export async function deleteAdminTest(
  request: Request,
  env: DeleteEnv,
  testId: string | undefined,
  fetcher: typeof fetch = fetch
): Promise<Response> {
  if (!isAuthorized(request, env.PUBLISH_SECRET)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  if (!testId || !frameworkIdPattern.test(testId)) {
    return jsonResponse({ error: "Invalid test id" }, 400);
  }
  if (!env.GITHUB_TOKEN) {
    return jsonResponse({ error: "Publishing is not configured" }, 500);
  }

  const owner = env.GITHUB_OWNER || defaultOwner;
  const repo = env.GITHUB_REPO || defaultRepo;
  const branch = env.GITHUB_BRANCH || defaultBranch;
  const targetPath = `content/tests/${testId}/test.json`;
  const existing = await getExistingContent({ branch, env, fetcher, owner, path: targetPath, repo });

  if (existing.status === "missing") {
    return jsonResponse({ error: "Test not found" }, 404);
  }
  if (existing.status === "error") {
    return jsonResponse({ error: "GitHub request failed" }, 502);
  }

  const deleted = await deleteContent({
    branch,
    env,
    fetcher,
    owner,
    path: targetPath,
    repo,
    sha: existing.sha,
    testId
  });

  if (!deleted.ok) {
    return jsonResponse({ error: "GitHub request failed" }, 502);
  }

  return jsonResponse({
    ok: true,
    testId,
    commitSha: deleted.commitSha,
    commitUrl: deleted.commitUrl
  });
}

function isAuthorized(request: Request, secret: string | undefined) {
  if (!secret) {
    return false;
  }
  return request.headers.get("Authorization") === `Bearer ${secret}`;
}

async function getExistingContent({
  branch,
  env,
  fetcher,
  owner,
  path,
  repo
}: {
  branch: string;
  env: DeleteEnv;
  fetcher: typeof fetch;
  owner: string;
  path: string;
  repo: string;
}): Promise<{ status: "missing" } | { status: "exists"; sha: string } | { status: "error" }> {
  const response = await fetcher(githubContentsUrl(owner, repo, path, branch), {
    headers: githubHeaders(env.GITHUB_TOKEN!)
  });

  if (response.status === 404) {
    return { status: "missing" };
  }
  if (!response.ok) {
    return { status: "error" };
  }

  const data = (await response.json()) as GitHubContent;
  return typeof data.sha === "string" ? { status: "exists", sha: data.sha } : { status: "error" };
}

async function deleteContent({
  branch,
  env,
  fetcher,
  owner,
  path,
  repo,
  sha,
  testId
}: {
  branch: string;
  env: DeleteEnv;
  fetcher: typeof fetch;
  owner: string;
  path: string;
  repo: string;
  sha: string;
  testId: string;
}): Promise<{ ok: true; commitSha?: string; commitUrl?: string } | { ok: false }> {
  const response = await fetcher(githubContentsUrl(owner, repo, path), {
    method: "DELETE",
    headers: githubHeaders(env.GITHUB_TOKEN!),
    body: JSON.stringify({
      branch,
      message: `Delete test: ${testId}`,
      sha
    })
  });
  if (!response.ok) {
    return { ok: false };
  }

  const data = (await response.json()) as { commit?: { html_url?: string; sha?: string } };
  return {
    ok: true,
    commitSha: data.commit?.sha,
    commitUrl: data.commit?.html_url
  };
}

function githubContentsUrl(owner: string, repo: string, path: string, branch?: string) {
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  return branch ? `${base}?ref=${encodeURIComponent(branch)}` : base;
}

function githubHeaders(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "assessment-engine-publisher",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
}
