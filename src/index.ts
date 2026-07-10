
const handler: ExportedHandler = {
  async fetch(request: Request): Promise<Response> {
    const originUrl = new URL(request.url);

    const targetUrl = decodeURIComponent(
      decodeURIComponent(originUrl.search.substr(1))
    );

    if (!originUrl.search.startsWith("?")) {
      return new Response(
        "No target URL provided. Pass the URL to relay as the query string.",
        {
          status: 400,
          statusText: "Bad Request",
          headers: { "Content-Type": "text/plain" }
        }
      );
    }

    const filteredHeaders: Record<string, string> = {};
    for (const [key, value] of request.headers.entries()) {
      if (
        key.match("^origin") === null &&
        key.match("eferer") === null &&
        key.match("^cf-") === null &&
        key.match("^x-forw") === null
      ) {
        filteredHeaders[key] = value;
      }
    }

    const newRequest = new Request(request, {
      redirect: "follow",
      headers: filteredHeaders
    });

    const response = await fetch(targetUrl, newRequest);

    return new Response(response.body, {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText
    });
  }
};

export default handler;
