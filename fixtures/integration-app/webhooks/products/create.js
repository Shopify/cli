import {defineWebhook} from '@shopify/app/webhook'
import {getShopName} from '~shop.js'

export default defineWebhook('products/create', async (payload) => {
  const shopName = await getShopName()
  return console.log(shopName)
})
