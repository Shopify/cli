import Command from '@shopify/cli-kit/node/base-command'
import {outputSuccess} from '@shopify/cli-kit/node/output'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

const createShopMutation = `
  mutation ShopCreate($input: ShopCreateInput!) {
    shopCreate(input: $input) {
      redirectUrl
      userErrors {
        field
        message
      }
    }
  }
`

export default class Create extends Command {
  static description = 'Logout from Shopify.'

  async run(): Promise<void> {
    const token = await ensureAuthenticatedPartners()

    const randomChars = (Math.random() + 1).toString(36).substring(7)
    const storeName = `custom-cowboys-${randomChars}`
    const subdomain = storeName
    const variables = {
      input: {
        organizationID: 9083,
        storeType: 'DEV_STORE',
        storeName,
        address: {countryCode: 'CA'},
        subdomain,
      },
    }

    const result = await partnersRequest(createShopMutation, token, variables)

    outputSuccess('Created a shop')
  }
}
