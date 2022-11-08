import {defineWebhook} from '@shopify/app/webhook'
import {graphqlRequest} from '@shopify/app/api'

export default defineWebhook('products/create', async (payload) => {
  const response = await graphqlRequest(`
  query {
    shop {
      name
    }
  }
  `)
  console.log(response)
})
