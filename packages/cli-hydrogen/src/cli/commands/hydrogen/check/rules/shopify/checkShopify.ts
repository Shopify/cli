import {CheckResult} from '../../../../../types'
import addShopifyConfig from '../../../add/shopifyConfig'
import addShopifyProvider from '../../../add/shopifyProvider'
import Command from '../../../../../core/Command'

export async function checkShopify(this: Command): Promise<CheckResult[]> {
  const {fs, workspace} = this
  const shopifyConfig = await workspace.loadConfig('shopify')
  const hasShopifyConfig = Boolean(shopifyConfig)
  const validStoreDomain =
    hasShopifyConfig &&
    shopifyConfig.config.storeDomain &&
    shopifyConfig.config.storeDomain.match(/.myshopify.com$/)?.length === 1

  const hasShopifyProvider =
    (await fs.hasFile('src/App.server.jsx')) && (await fs.read('src/App.server.jsx'))?.includes('ShopifyServerProvider')

  return [
    {
      id: 'shopify-config',
      type: 'Setup',
      description: 'Has Shopify config',
      success: hasShopifyConfig,
      fix: addShopifyConfig,
    },
    {
      id: 'shopify-provider',
      type: 'Setup',
      description: 'Has Shopify provider',
      success: Boolean(hasShopifyProvider),
      fix: addShopifyProvider,
    },
    {
      id: 'shopify-store-domain',
      type: 'Setup',
      description: 'Has valid storeDomain',
      success: validStoreDomain,
    },
  ]
}
