import {defineProductsCreateWebhook} from '@shopify/app/webhook'
import {graphqlRequest} from '@shopify/app/store'

export default defineProductsCreateWebhook(async (payload) => {
  const {
    data: {
      shop: {name: shopName},
    },
  } = await graphqlRequest(`
    query {
      shop {
        name
      }
    }
  `)
})
