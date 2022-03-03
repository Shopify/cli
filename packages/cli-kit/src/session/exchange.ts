import { fetch } from "../http"
import { identity } from "../environment/fqdn"

const APPLICATION_SCOPES = {
  "shopify": ["https://api.shopify.com/auth/shop.admin.graphql", "https://api.shopify.com/auth/shop.admin.themes", "https://api.shopify.com/auth/partners.collaborator-relationships.readonly"],
  "storefront_renderer_production": ["https://api.shopify.com/auth/shop.storefront-renderer.devtools"],
  "partners": ["https://api.shopify.com/auth/partners.app.cli.access"],
}

async function requestExchangeTokens(code: string): Promise<any> {
  const url = `https://${process.env.SHOPIFY_API_KEY}:${process.env.SHOPIFY_API_PASSWORD}@${process.env.SHOPIFY_API_FQDN}/admin/oauth/access_token`
  const params = {
    "grant_type": 'urn:ietf:params:oauth:grant-type:token-exchange',
    "requested_token_type": 'urn:ietf:params:oauth:token-type:access_token',
    "subject_token_type": 'urn:ietf:params:oauth:token-type:access_token',
    "client_id",
    "audience",
    "scope": "scopes",
    "subject_token",
    "destination",
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })
  return response.json()
}

async function requestExchangeToken(name: string, audience: string, additional_scopes?: string[]) {

}

async function requestAccessToken(code: string) {

}

async function postRequest(endpoint: string, params: Record<string, any>) {
  const baseURL = await identity()
  const uri = `${baseURL} + "/" + ${endpoint}`

  const res = await fetch(uri, {body: "", method: "POST", headers: ""})
  console.log(res)
}
