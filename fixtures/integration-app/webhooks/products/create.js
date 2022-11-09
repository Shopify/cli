import {getShopName} from '~shop.js'
import {defineWebhook} from '@shopify/app/webhook'
import {updateDeliveryTime, readDeliveryTime} from '@shopify/app/metafields'
import {useMetafields} from '@shopify/app/metafields'

export default defineWebhook('products/create', async (payload) => {
  const [deliveryTime, setDeliveryTime] = useMetafields('deliveryTime')
  const shopName = await getShopName()
  await updateDeliveryTime({productId: '123'})
  console.log(shopName)
})
