import {createRequire} from 'node:module'
const require = createRequire(import.meta.url)

const {defineProductsCreateWebhook} = require('@shopify/app/webhook')
const {graphqlRequest} = require('@shopify/app/store')

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
  console.log(shopName)
})
