import {createExtensionSpec} from '../extensions.js'
import {BaseExtensionSchema} from '../schemas.js'
import {output} from '@shopify/cli-kit'

const dependency = {name: '@shopify/post-purchase-ui-extensions-react', version: '^0.13.2'}

const spec = createExtensionSpec({
  identifier: 'checkout_post_purchase',
  externalIdentifier: 'post_purchase_ui',
  surface: 'post_purchase',
  dependency,
  partnersWebId: 'post_purchase',
  schema: BaseExtensionSchema,
  deployConfig: async (config, _) => {
    return {metafields: config.metafields}
  },
  previewMessage: (host, uuid, _): output.TokenizedString => {
    const publicURL = `${host}/extensions/${uuid}`
    const devDocsLink = output.token.link(
      'dev docs',
      'https://shopify.dev/apps/checkout/post-purchase/getting-started-post-purchase-extension#step-2-test-the-extension',
    )
    const chromeLink = output.token.link(
      'Shopify’s post-purchase Chrome extension',
      'https://chrome.google.com/webstore/detail/shopify-post-purchase-dev/nenmcifhoegealiiblnpihbnjenleong',
    )
    return output.content`To view this extension:
    1. Install ${chromeLink}
    2. Open the Chrome extension and paste this URL into it: ${publicURL}
    3. Run a test purchase on your store to view your extension

  For more detail, see the ${devDocsLink}`
  },
})

export default spec
