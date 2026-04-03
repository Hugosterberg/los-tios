import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const LOYVERSE_BASE_URL = "https://api.loyverse.com/v1.0";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { path, searchParams = {}, apiToken } = body;

    if (!apiToken) {
      return Response.json({ error: 'Missing Loyverse API token' }, { status: 400 });
    }

    if (!path) {
      return Response.json({ error: 'Missing path' }, { status: 400 });
    }

    const url = new URL(`${LOYVERSE_BASE_URL}/${path}`);
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: "application/json",
      },
    });

    const text = await response.text();

    if (!response.ok) {
      return Response.json(
        { error: `Loyverse API error ${response.status}: ${text || response.statusText}` },
        { status: response.status }
      );
    }

    const data = JSON.parse(text);
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});