import { registeredAssessments } from "../../../registry/assessmentRegistry";

interface AdminTestsEnv {
  PUBLISH_SECRET?: string;
}

interface PagesContext {
  request: Request;
  env: AdminTestsEnv;
}

export async function onRequest(context: PagesContext) {
  if (context.request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405, { Allow: "GET" });
  }
  return listAdminTests(context.request, context.env);
}

export async function listAdminTests(request: Request, env: AdminTestsEnv): Promise<Response> {
  if (!isAuthorized(request, env.PUBLISH_SECRET)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  return jsonResponse(
    registeredAssessments.map((assessment) => ({
      id: assessment.metadata.id,
      title: assessment.metadata.title,
      category: assessment.metadata.discovery.category,
      questionCount: assessment.questions.length,
      resultCount: assessment.results.catalog.length,
      theme: assessment.presentation.theme
    }))
  );
}

function isAuthorized(request: Request, secret: string | undefined) {
  if (!secret) {
    return false;
  }
  return request.headers.get("Authorization") === `Bearer ${secret}`;
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
