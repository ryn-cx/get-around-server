
const handler: ExportedHandler = {
  async fetch(request: Request): Promise<Response> {
    const originUrl = new URL(request.url);

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

    const targetUrl = originUrl.search.slice(1);
    const newRequest = new Request(request, {
      redirect: "follow"
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
