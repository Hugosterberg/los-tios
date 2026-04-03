const CLIP_PAYMENTS_BASE_URL = "https://api.payclip.com";
const CLIP_SETTLEMENTS_BASE_URL = "https://api-gw.payclip.com";

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { path, searchParams = {}, authToken, apiType = "payments" } = body;

    if (!authToken) {
      return Response.json({ error: 'Missing Clip auth token' }, { status: 400 });
    }

    if (!path) {
      return Response.json({ error: 'Missing path' }, { status: 400 });
    }

    const baseUrl = apiType === "settlements" ? CLIP_SETTLEMENTS_BASE_URL : CLIP_PAYMENTS_BASE_URL;
    const url = new URL(`${baseUrl}/${path}`);
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    // Try Authorization header first, then x-api-key
    const headerSets = apiType === "settlements"
      ? [{ "x-api-key": authToken }, { Authorization: authToken }]
      : [{ Authorization: authToken }, { "x-api-key": authToken }];

    let lastResponse = null;
    let lastText = "";

    for (const headers of headerSets) {
      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json", ...headers },
      });

      if (response.ok) {
        const data = await response.json();
        return Response.json(data);
      }

      lastResponse = response;
      lastText = await response.text();

      if (response.status !== 401 && response.status !== 403) {
        break;
      }
    }

    return Response.json(
      { error: `Clip API error ${lastResponse?.status}: ${lastText || lastResponse?.statusText}` },
      { status: lastResponse?.status || 500 }
    );
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});