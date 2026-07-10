# get-around-server

A Cloudflare Worker that forwards HTTP requests.

The Worker is protected by [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/),
which enforces authentication at the edge before requests reach the Worker. Clients
authenticate with an Access service token (`CF-Access-Client-Id` /
`CF-Access-Client-Secret`) allowed by a `Service Auth` policy on the application.

For more information see the main [get-around](https://github.com/ryn-cx/get-around)
repository.

