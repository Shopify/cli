import {getShopName} from '~shop.js'
import {defineWebhook} from '@shopify/app/webhook'

export default defineWebhook('products/create', async (payload) => {
  const shopName = await getShopName()
  console.log(shopName)
})
