import { createClientFromRequest } from "npm:@base44/sdk@0.8.23";

const NOTION_API_BASE = "https://api.notion.com/v1";
/** Keep in sync with Notion API versioning (see https://developers.notion.com/reference/versioning). */
const NOTION_VERSION = "2025-09-03";

const CONNECTOR_KEYS = ["notion", "Notion"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user;
    try {
      user = await base44.auth.me();
    } catch (_) {
      // ignore auth errors
    }
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown> = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const {
      path,
      method = "GET",
      body: notionBody,
      searchParams,
      notionInternalToken: notionTokenFromRequest,
    } = body as {
      path?: string;
      method?: string;
      body?: unknown;
      searchParams?: Record<string, string>;
      notionInternalToken?: string;
    };

    let accessToken: string | undefined;

    for (const key of CONNECTOR_KEYS) {
      try {
        const conn = await base44.asServiceRole.connectors.getConnection(key);
        const t = conn?.accessToken?.trim();
        if (t) {
          accessToken = t;
          break;
        }
      } catch (e) {
        console.error(`Notion getConnection(${key}):`, e);
      }
    }

    if (!accessToken) {
      const inline =
        typeof notionTokenFromRequest === "string" ? notionTokenFromRequest.trim() : "";
      if (inline) {
        accessToken = inline;
      }
    }

    if (!accessToken) {
      accessToken = Deno.env.get("NOTION_INTEGRATION_TOKEN")?.trim();
    }

    if (!accessToken) {
      return Response.json(
        {
          error:
            "Notion is not connected. Use OAuth in Base44, add an internal integration token under Integrations → Notion, or set NOTION_INTEGRATION_TOKEN on this function.",
        },
        { status: 400 },
      );
    }

    if (!path || typeof path !== "string") {
      return Response.json({ error: "Missing path" }, { status: 400 });
    }

    const notionMethod = String(method).toUpperCase();
    let url = `${NOTION_API_BASE}/${path.replace(/^\//, "")}`;
    if (searchParams && typeof searchParams === "object") {
      const params = new URLSearchParams(searchParams as Record<string, string>);
      url += `?${params.toString()}`;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": NOTION_VERSION,
    };

    const fetchOptions: RequestInit = {
      method: notionMethod,
      headers,
    };

    if (notionMethod !== "GET" && notionMethod !== "HEAD") {
      headers["Content-Type"] = "application/json";
      if (notionBody !== undefined && notionBody !== null) {
        fetchOptions.body = JSON.stringify(notionBody);
      }
    }

    const response = await fetch(url, fetchOptions);
    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return Response.json(
        { error: "Notion returned a non-JSON response", raw: text.slice(0, 800) },
        { status: response.status >= 400 ? response.status : 502 },
      );
    }

    if (!response.ok) {
      const err = data as { message?: string };
      console.error("Notion API error:", data);
      return Response.json(
        { error: err?.message || "Notion API error", details: data },
        { status: response.status },
      );
    }

    return Response.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
});
