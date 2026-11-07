/** The smallest app configuration that the CLI's loader accepts. An empty `clientId` is an unlinked configuration. */
export function validAppConfiguration(clientId = 'test-client-id'): string {
  return `name = "Test app"
client_id = "${clientId}"
application_url = "https://example.com"
embedded = true

[webhooks]
api_version = "2025-01"

[auth]
redirect_urls = ["https://example.com/auth/callback"]
`
}
