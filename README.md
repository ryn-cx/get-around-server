# Get Around Server

A Cloudflare Worker that relays HTTP requests. See
[get-around](https://github.com/ryn-cx/get-around) for more information.

## Deployment

Deploy your own instance by forking this repository and letting GitHub Actions push it to
Cloudflare Workers, then place it behind Cloudflare Access so only holders of a valid
service token can reach it:

1. Fork this repository to your own GitHub account.
2. In the Cloudflare dashboard go to **Workers & Pages**, click **Create application**,
   and follow the on-screen steps to set up the Worker from your fork.
3. Secure the Worker so a service token is required to access it:
   1. In the Cloudflare Zero Trust dashboard go to **Access controls \> Service credentials
      \> Create Service Tokens** and create a token to get the `CF-Access-Client-Id` and
      `CF-Access-Client-Secret`.
   2. In the Cloudflare dashboard go to **Workers & Pages \> get-around-server \> Domains
      \> Worker URL** and change the production URL from Public to **Restricted**.
   3. From this same page click **Manage policy**.
   4. Under **Access policies** click **Create a new policy** and create a new policy
      with these settings:
      1. **Selector: Service Token**
      2. **Value: The token you just created**
      3. **Action: Service Auth**

