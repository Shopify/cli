import {defineProductsCreateWebhook} from '@shopify/app/merchant/webhook'

export default defineProductsCreateWebhook(async (payload) => {
  console.log(payload)
})
