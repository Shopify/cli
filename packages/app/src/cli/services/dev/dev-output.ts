import {FunctionExtension, UIExtension} from '../../models/app/app'
import {getExtensionOutputConfig, UIExtensionTypes} from '../../constants'
import {output, string} from '@shopify/cli-kit'

export function showAppURL(updated: boolean, storeFqdn: string, url: string) {
  const appURL = buildAppURL(storeFqdn, url)
  const heading = output.token.heading('App URL')
  const message = output.content`\n${heading}\n\nOnce everything's built, your app's shareable link will be: ${appURL}.`
  if (updated) {
    message.value += `\nNote that your app's URL in Shopify Partners will be updated.\n`
  }

  output.info(message)
}

export function showExtensionsURLs(extensions: UIExtension[], storeFqdn: string, url: string) {
  for (const extension of extensions) {
    const heading = output.token.heading(`${getHumanKey(extension)} (${extension.configuration.name})`)
    let message: string
    switch (extension.type as UIExtensionTypes) {
      case 'checkout_post_purchase': {
        message = postPurchaseMessage(url, extension).value
        break
      }
      case 'checkout_ui_extension': {
        message = checkoutUIMessage(url, extension).value
        break
      }
      case 'product_subscription': {
        message = productSubscriptionMessage(url, extension).value
        break
      }
      case 'pos_ui_extension':
      case 'web_pixel_extension':
        continue
    }
    output.info(output.content`${heading}
${message}
`)
  }
}

export function showFunctionsMessage(extensions: FunctionExtension[]) {
  const names = extensions.map((ext) => ext.configuration.name)
  const heading = output.token.heading(names.join(', '))
  const message = `These extensions need to be deployed to be manually tested.
One testing option is to use a separate app dedicated to staging.`
  output.info(output.content`${heading}${message}`)
}

function buildAppURL(storeFqdn: string, publicURL: string) {
  const hostUrl = `${storeFqdn}/admin`
  const hostParam = btoa(hostUrl).replace(/[=]/g, '')
  return `${publicURL}?shop=${storeFqdn}&host=${hostParam}`
}

function postPurchaseMessage(url: string, extension: UIExtension) {
  const publicURL = `${url}/extensions/${extension.devUUID}`
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

For more detail, see the ${devDocsLink}
    `
}

function checkoutUIMessage(url: string, extension: UIExtension) {
  const publicURL = `${url}/extensions/${extension.devUUID}`
  return output.content`Preview link: ${publicURL}`
}

function productSubscriptionMessage(url: string, extension: UIExtension) {
  const publicURL = `${url}/extensions/${extension.devUUID}`
  return output.content`Preview link: ${publicURL}`
}

function getHumanKey(extension: UIExtension) {
  return string.capitalize(getExtensionOutputConfig(extension.type).humanKey)
}
