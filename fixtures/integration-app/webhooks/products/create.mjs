import {createRequire} from 'node:module'
const require = createRequire(import.meta.url)

const {defineProductsCreateWebhook} = require('@shopify/app/webhook')
const {graphqlRequest} = require('@shopify/app/store')

export default defineProductsCreateWebhook(async (payload) => {
  const {
    data: {
      shop: {name: shopName, email},
    },
  } = await graphqlRequest(`
    query {
      shop {
        name
        email
      }
    }
  `)
  console.log(email)
})
