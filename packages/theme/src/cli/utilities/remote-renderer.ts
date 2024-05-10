import FormData, {fetch, Response} from '@shopify/cli-kit/node/http'
import {getStorefrontSession as getStorefrontAuthCookies} from './remote-renderer/storefront-api.js'
import {ensureAuthenticatedStorefront} from '@shopify/cli-kit/node/session'
import {serializeCookies} from './remote-renderer/cookies.js'

// TODO: remove this in favor of the context created by James.
interface AuthContext {
  storeFqdn: string
  storefrontPassword?: string
  themeAccessPassword?: string
}

interface RenderContext {
  themeId: string
  templates: Record<string, string>
  section_id?: string
}

/// TODO: consider handlign rendering as a stateful component
export async function render(authCtx: AuthContext, renderCtx: RenderContext): Promise<Response> {
  const storeUrl = `https://${authCtx.storeFqdn}`

  const formData = new FormData()
  formData.append(
    'replace_templates[sections/announcement-bar.liquid]',
    `
      <h1>
        Hello from the HMR land!
      </h1>

      {% schema %}
        {
            "name": "t:sections.announcement-bar.name",
            "class": "announcement-bar-section"
        }
      {% endschema %}
    `,
  )
  formData.append('_method', 'GET')

  const storefrontToken = await ensureAuthenticatedStorefront([], authCtx.themeAccessPassword)
  const shopifyEssential = await getStorefrontAuthCookies(storeUrl, renderCtx.themeId, authCtx.storefrontPassword)

  const headers = {
    Authorization: `Bearer ${storefrontToken}`,
    Cookie: serializeCookies(shopifyEssential),
    ...formData.getHeaders(),
  }

  const queryParams = new URLSearchParams()
  if (renderCtx.section_id) queryParams.append('section_id', renderCtx.section_id)

  const url = `${storeUrl}/?${queryParams}`

  console.log(`Fetching ${url}`)
  console.log(headers)

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    headers: headers,
  })

  console.log(response.status, await response.text())

  return response
}
