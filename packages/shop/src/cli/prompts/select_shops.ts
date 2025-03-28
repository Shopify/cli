import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import {businessPlatformRequest} from '@shopify/cli-kit/node/api/business-platform';
import {CurrentUserAccountQuery} from '../graphql.js'

export async function selectShops(): Promise<{ sourceShop: any, targetShop: any }> {
  const bpSession = await ensureAuthenticatedBusinessPlatform()
  const resp :any = await businessPlatformRequest(CurrentUserAccountQuery, bpSession)

  let orgs = []
  for (const org of resp.currentUserAccount.organizations.edges) {
    orgs.push(org.node)
  }

  const org = await renderSelectPrompt({
    message: 'Select the organization to work with:',
    choices: orgs.map((org: any) => ({
      label: org.name,
      value: org,
    })),
  })

  const shops = org.categories[0].destinations.edges.map((shop: any) => shop.node)

  const sourceShop = await renderSelectPrompt({
    message: 'Select the source shop:',
    choices: shops.map((shop: any) => ({
      label: shop.name,
      value: shop,
    })),
  })

  const targetShop = await renderSelectPrompt({
    message: 'Select the target shop:',
    choices: shops.map((shop: any) => ({
      label: shop.name,
      value: shop,
    })),
  })

  return { sourceShop, targetShop }
}
