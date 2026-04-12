const DEFAULT_BASE = "https://b2b.revolut.com/api/1.0";

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { path, searchParams = {}, accessToken, baseUrl } = body;

    if (!accessToken) {
      return Response.json({ error: "Missing Revolut access token" }, { status: 400 });
    }

    if (!path) {
      return Response.json({ error: "Missing path" }, { status: 400 });
    }

    const root = String(baseUrl || DEFAULT).replace(/\/$/, "");
    const url = new URL(`${root}/${String(path).replace(/^\//, "")}`);
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    const text = await response.text();

    if (!response.ok) {
      return Response.json(
        { error: `Revolut API error ${response.status}: ${text || response.statusText}` },
        { status: response.status },
      );
    }

    const data = text ? JSON.parse(text) : null;
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
