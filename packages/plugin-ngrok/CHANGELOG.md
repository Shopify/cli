# @shopify/plugin-ngrok

## 3.83.0

### Minor Changes

- Added ngrok tunnel plugin to enable ngrok tunneling for `shopify app dev` command
- Provides alternative to Cloudflare tunnels for developers who prefer or require ngrok
- Supports NGROK_AUTHTOKEN environment variable for authentication
- Full integration with existing tunnel infrastructure via TunnelClient interface