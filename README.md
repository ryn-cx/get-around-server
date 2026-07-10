# get-around-server

A Cloudflare Worker that forwards HTTP requests on behalf of the [get-around](https://github.com/ryn-cx/get-around) client.

It accepts an authenticated `POST` describing a request (URL, method, headers, body, etc.), makes that request, and returns the status, headers, and body.

## Usage

Send a `POST` with a `Bearer` token matching `AUTH_TOKEN`:

```json
{
  "url": "https://example.com",
  "method": "GET",
  "headers": {},
  "params": {},
  "data": {},
  "form": {},
  "cookies": {},
  "auth": ["user", "pass"],
  "timeout": 30
}
```

Only `url` and `method` are required.

## Response

The upstream response is passed through untouched — the body is never decompressed. The original `Content-Encoding` header is preserved and the raw bytes are base64-encoded so the JSON stays valid, leaving any decoding to the client:

```json
{
  "statusCode": 200,
  "headers": {},
  "body": "...",
  "encoding": "base64"
}
```

`body` is always the base64-encoded raw bytes (`encoding` is always `"base64"`).
