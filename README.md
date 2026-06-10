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
