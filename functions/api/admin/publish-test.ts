import { validateAssessmentPackage, type AssessmentPackage } from "../../../schema/assessmentSchema";

const defaultOwner = "joly11207-lgtm";
const defaultRepo = "assessment-engine";
const defaultBranch = "main";
const maxBodyBytes = 2 * 1024 * 1024;

interface PublishEnv {
  PUBLISH_SECRET?: string;
  GITHUB_TOKEN?: string;
  GITHUB_OWNER?: string;
  GITHUB_REPO?: string;
  GITHUB_BRANCH?: string;
}

interface PagesContext {
  request: Request;
  env: PublishEnv;
}

interface PublishPayload {
  assessment?: unknown;
  overwrite?: unknown;
}

interface GitHubContent {
  sha?: string;
}

export async function onRequest(context: PagesContext) {
  if (context.request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, { Allow: "POST" });
  }
  return publishTest(context.request, context.env, fetch);
}

export async function publishTest(
  request: Request,
  env: PublishEnv,
  fetcher: typeof fetch = fetch
): Promise<Response> {
  if (!isAuthorized(request, env.PUBLISH_SECRET)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  if (!env.GITHUB_TOKEN) {
    return jsonResponse({ error: "Publishing is not configured" }, 500);
  }

  const payload = await readPayload(request);
  if (!payload.ok) {
    return jsonResponse({ error: payload.error }, payload.status);
  }

  const validation = validateAssessmentPackage(payload.data.assessment);
  if (!validation.success) {
    return jsonResponse({ error: "Invalid assessment", details: validation.errors }, 400);
  }

  const assessment = validation.data;
  const overwrite = payload.data.overwrite === true;
  const owner = env.GITHUB_OWNER || defaultOwner;
  const repo = env.GITHUB_REPO || defaultRepo;
  const branch = env.GITHUB_BRANCH || defaultBranch;
  const testId = assessment.metadata.id;
  const targetPath = `content/tests/${testId}/test.json`;
  const existing = await getExistingContent({ branch, env, fetcher, owner, path: targetPath, repo });

  if (existing.status === "error") {
    return jsonResponse({ error: "GitHub request failed" }, 502);
  }
  if (existing.status === "exists" && !overwrite) {
    return jsonResponse({ existing: true, testId }, 409);
  }

  const saved = await saveContent({
    assessment,
    branch,
    env,
    fetcher,
    owner,
    path: targetPath,
    repo,
    sha: existing.status === "exists" ? existing.sha : undefined
  });

  if (!saved.ok) {
    return jsonResponse({ error: "GitHub request failed" }, 502);
  }

  return jsonResponse({
    ok: true,
    testId,
    path: targetPath,
    commitSha: saved.commitSha,
    commitUrl: saved.commitUrl
  });
}

function isAuthorized(request: Request, secret: string | undefined) {
  if (!secret) {
    return false;
  }
  return request.headers.get("Authorization") === `Bearer ${secret}`;
}

async function readPayload(request: Request): Promise<
  | { ok: true; data: PublishPayload }
  | { ok: false; status: number; error: string }
> {
  const contentLength = Number(request.headers.get("Content-Length") || "0");
  if (contentLength > maxBodyBytes) {
    return { ok: false, status: 413, error: "Request body is too large" };
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maxBodyBytes) {
    return { ok: false, status: 413, error: "Request body is too large" };
  }

  try {
    const data = JSON.parse(body) as PublishPayload;
    return { ok: true, data };
  } catch {
    return { ok: false, status: 400, error: "Request body must be JSON" };
  }
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
  env: PublishEnv;
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

async function saveContent({
  assessment,
  branch,
  env,
  fetcher,
  owner,
  path,
  repo,
  sha
}: {
  assessment: AssessmentPackage;
  branch: string;
  env: PublishEnv;
  fetcher: typeof fetch;
  owner: string;
  path: string;
  repo: string;
  sha?: string;
}): Promise<{ ok: true; commitSha?: string; commitUrl?: string } | { ok: false }> {
  const message = `${sha ? "Update" : "Add"} test: ${assessment.metadata.id}`;
  const body: Record<string, string> = {
    branch,
    content: toBase64(`${JSON.stringify(assessment, null, 2)}\n`),
    message
  };
  if (sha) {
    body.sha = sha;
  }

  const response = await fetcher(githubContentsUrl(owner, repo, path), {
    method: "PUT",
    headers: githubHeaders(env.GITHUB_TOKEN!),
    body: JSON.stringify(body)
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

function toBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
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
