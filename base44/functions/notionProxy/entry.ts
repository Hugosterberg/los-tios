import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const NOTION_API_BASE = "https://api.notion.com/v1";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("notion");
    const body = await req.json();
    const { path, method = "GET", payload, searchParams } = body;

    if (!path) {
      return Response.json({ error: "Missing path" }, { status: 400 });
    }

    let url = `${NOTION_API_BASE}/${path}`;
    if (searchParams) {
      const params = new URLSearchParams(searchParams);
      url += `?${params.toString()}`;
    }

    const fetchOptions = {
      method,
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
    };

    if (payload && method !== "GET") {
      fetchOptions.body = JSON.stringify(payload);
    }

    const response = await fetch(url, fetchOptions);
    const data = await response.json();

    if (!response.ok) {
      return Response.json({ error: data.message || "Notion API error", details: data }, { status: response.status });
    }

    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});