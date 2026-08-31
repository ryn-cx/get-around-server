// Headers that tell the origin the request came through the relay.
const STRIPPED_HEADERS = new Set(["origin", "referer", "cdn-loop"]);
const STRIPPED_HEADER_PREFIXES = ["cf-", "x-forwarded-"];

// Cookies Cloudflare Access sets on the relay's own domain.
const ACCESS_COOKIES = new Set(["CF_Authorization", "CF_AppSession"]);

// TODO: Validate
function stripAccessCookies(cookie: string): string {
  return cookie
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => pair !== "" && !ACCESS_COOKIES.has(pair.split("=")[0].trim()))
    .join("; ");
}

// TODO: Validate
function relayHeaders(headers: Headers): Headers {
  const relayed = new Headers(headers);

  for (const name of [...headers.keys()]) {
    const lowercased = name.toLowerCase();
    const stripped =
      STRIPPED_HEADERS.has(lowercased) ||
      STRIPPED_HEADER_PREFIXES.some((prefix) => lowercased.startsWith(prefix));
    if (stripped) {
      relayed.delete(name);
    }
  }

  const cookie = relayed.get("cookie");
  if (cookie !== null) {
    const remainingCookies = stripAccessCookies(cookie);
    if (remainingCookies === "") {
      relayed.delete("cookie");
    } else {
      relayed.set("cookie", remainingCookies);
    }
  }

  return relayed;
}

const handler: ExportedHandler = {
  // TODO: Validate
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
      redirect: "follow",
      headers: relayHeaders(request.headers)
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
