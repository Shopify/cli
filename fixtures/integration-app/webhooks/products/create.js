import {defineWebhook} from '@shopify/app/webhook'
import {getShopName} from '~shop'

export default defineWebhook('products/create', async (payload) => {
  const name = await getShopName()
  console.log(name)
})
