import Command from '../../../../core/Command'

export async function addShopifyConfig(this: Command) {
  const {fs} = this

  const storeDomain = await this.interface.ask(
    'What is your myshopify.com store domain?',
    {
      default: 'hydrogen-preview.myshopify.com',
      name: 'storeDomain',
    },
  )

  const storefrontToken = await this.interface.ask(
    'What is your storefront token?',
    {
      default: '3b580e70970c4528da70c98e097c2fa0',
      name: 'storeFrontToken',
    },
  )

  const templateArgs = {
    storeDomain: storeDomain?.replace(/^https?:\/\//i, ''),
    storefrontToken,
  }

  fs.write(
    'shopify.config.js',
    (await import('./templates/shopify-config-js')).default(templateArgs),
  )
}
