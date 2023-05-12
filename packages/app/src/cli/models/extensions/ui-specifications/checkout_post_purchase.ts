import {createUIExtensionSpecification} from '../ui.js'
import {BaseUIExtensionSchema} from '../schemas.js'
import {outputContent, outputToken, TokenizedString} from '@shopify/cli-kit/node/output'

const dependency = '@shopify/post-purchase-ui-extensions'

const spec = createUIExtensionSpecification({
  identifier: 'checkout_post_purchase',
  surface: 'post_purchase',
  dependency,
  partnersWebIdentifier: 'post_purchase',
  helpURL: 'https://shopify.dev/docs/apps/checkout/post-purchase',
  schema: BaseUIExtensionSchema,
  isPreviewable: true,
  deployConfig: async (config, _) => {
    return {metafields: config.metafields}
  },
  previewMessage: (host, uuid, _): TokenizedString => {
    const publicURL = `${host}/extensions/${uuid}`
    const devDocsLink = outputToken.link(
      'dev docs',
      'https://shopify.dev/apps/checkout/post-purchase/getting-started-post-purchase-extension#step-2-test-the-extension',
    )
    const chromeLink = outputToken.link(
      'Shopify’s post-purchase Chrome extension',
      'https://chrome.google.com/webstore/detail/shopify-post-purchase-dev/nenmcifhoegealiiblnpihbnjenleong',
    )
    return outputContent`To view this extension:
  1. Install ${chromeLink}
  2. Open the Chrome extension and paste this URL into it: ${publicURL}
  3. Run a test purchase on your store to view your extension

For more detail, see the ${devDocsLink}`
  },
})

export default spec
