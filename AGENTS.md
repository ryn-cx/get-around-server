# get-around-server 🌍⚡

**A transparent HTTP relay that runs everywhere at once.** 🛰️ Hand it a URL, get back the
exact response — same status, same headers, same bytes — fetched from Cloudflare's global
network instead of from you. One `fetch` handler, no framework, no database, no state. The
proxy you wire up in thirty seconds and then forget is running. ✨

It's the server half of [get-around](https://github.com/ryn-cx/get-around) 🤝: the Python
client hands off a request, the Worker makes it, and the reply comes back untouched. But
the relay stands entirely on its own — anything that speaks HTTP can drive it.

## What makes it worth deploying 🚀

- **🎯 Dead-simple contract.** The URL you want fetched *is* the query string. Point any HTTP
  method at `https://your-worker/?<url-encoded-target>` and the Worker relays it. No JSON
  envelope to build, no SDK to learn — the request you already have is the request it makes.
- **🪟 Truly transparent.** The upstream response streams straight back through `response.body`
  with its original status, status text, and headers intact. Nothing is re-encoded, buffered,
  or reinterpreted — text, JSON, images, gzip, or gigabyte downloads all pass byte-for-byte.
- **📦 Method and body ride along.** It rebuilds your request faithfully, so a `POST` stays a
  `POST` and its body arrives at the origin exactly as you sent it. GET, PUT, DELETE, PATCH —
  whatever you throw, it throws.
- **🕵️ Leak-proof by construction.** Before forwarding, it strips the headers that would betray
  the relay or the caller — `Origin`, `Referer`, every `CF-*` Cloudflare header, and the
  `X-Forwarded-*` family — while passing everything else through untouched. The origin sees a
  clean request, not your infrastructure.
- **📣 Fails loud, never silent.** Call it with no target and you get a plain `400 Bad Request`
  that tells you exactly what's missing, instead of a mystery empty response.
- **🔒 Secured at the edge, not in code.** Authentication lives in **Cloudflare Access** with a
  Service Auth policy — clients present `CF-Access-Client-Id` / `CF-Access-Client-Secret` and
  are validated before a single line of Worker code runs. The relay stays clean; the gate
  stays strong.
- **🌐 Stateless and global.** No bindings, no storage, nothing to provision. Deploy once and it
  answers from every Cloudflare edge location at the same time.

## Drive it directly 🛠️

The target is passed URL-encoded in the query string (encode it twice — the Worker decodes
twice, which keeps a target's own query parameters from bleeding into the relay's):

```sh
# Target: https://httpbin.org/get  →  double-URL-encoded into the query string
curl "https://get-around-server.<your-subdomain>.workers.dev/?https%253A%252F%252Fhttpbin.org%252Fget" \
  -H "CF-Access-Client-Id: <client-id>" \
  -H "CF-Access-Client-Secret: <client-secret>"
```

You get back exactly what `httpbin.org` sent — same status code, same headers, same body. 🎁
To relay a `POST`, just POST to the Worker with your body; it forwards method and body as-is.

## What the tests exercise 🧪

Running on the **real Workers runtime** via `@cloudflare/vitest-pool-workers` with mocked
upstreams, the specs cover the behaviors that matter: a full relay round-trip that asserts
the upstream status, headers, and raw body come back untouched; the header-hygiene rule that
`Referer` and `X-Forwarded-*` are stripped while ordinary headers pass through; and the
`400` guard for a request that names no target. These aren't unit-test stubs — they exercise
the Worker exactly as Cloudflare will run it. ✅

## Deploy 🚢

Built on **Cloudflare Workers** with Wrangler; it's stateless, so there are no bindings to
provision.

```sh
npx wrangler dev     # run locally 💻
npx wrangler deploy  # ship to the edge 🌎
```

Then put it behind Cloudflare Access and mint a Service Token for your clients. That's the
whole operations story.

---

Small footprint, global reach. 🗺️ Deploy once; relay from everywhere. 🎉
