import {App, FunctionExtension, ThemeExtension, UIExtension} from '../../models/app/app'
import {ExtensionTypes, getExtensionOutputConfig, UIExtensionTypes} from '../../constants'
import {output, string} from '@shopify/cli-kit'

export function outputAppURL(updated: boolean, storeFqdn: string, url: string) {
  const appURL = buildAppURL(storeFqdn, url)
  const heading = output.token.heading('App URL')
  let message = `Once everything's built, your app's shareable link will be:\n${appURL}`
  if (updated) {
    message += `\nNote that your app's URL in Shopify Partners will be updated.`
  }

  output.info(output.content`\n\n${heading}\n${message}\n`)
}

export function outputExtensionsMessages(app: App, storeFqdn: string, url: string) {
  outputUIExtensionsURLs(app.extensions.ui, storeFqdn, url)
  outputFunctionsMessage(app.extensions.function)
  outputThemeExtensionsMessage(app.extensions.theme)
}

function outputUIExtensionsURLs(extensions: UIExtension[], storeFqdn: string, url: string) {
  for (const extension of extensions) {
    const heading = output.token.heading(`${extension.configuration.name} (${getHumanKey(extension.type)})`)
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
    output.info(output.content`${heading}\n${message}\n`)
  }
}

function outputFunctionsMessage(extensions: FunctionExtension[]) {
  if (extensions.length === 0) return
  const names = extensions.map((ext) => ext.configuration.name)
  const heading = output.token.heading(names.join(', '))
  const message = `These extensions need to be deployed to be manually tested.
One testing option is to use a separate app dedicated to staging.`
  output.info(output.content`${heading}\n${message}\n`)
}

function outputThemeExtensionsMessage(extensions: ThemeExtension[]) {
  if (extensions.length === 0) return
  const heading = output.token.heading(`${extensions[0].configuration.name} (${getHumanKey(extensions[0].type)})`)
  const link = output.token.link(
    'dev doc instructions',
    'https://shopify.dev/apps/online-store/theme-app-extensions/getting-started#step-4-test-your-changeseckout/post-purchase/getting-started-post-purchase-extension#step-2-test-the-extension',
  )
  const message = output.content`Follow the ${link} by deploying your work as a draft`.value
  output.info(output.content`${heading}\n${message}\n`)
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

For more detail, see the ${devDocsLink}`
}

function checkoutUIMessage(url: string, extension: UIExtension) {
  const publicURL = `${url}/extensions/${extension.devUUID}`
  return output.content`Preview link: ${publicURL}`
}

function productSubscriptionMessage(url: string, extension: UIExtension) {
  const publicURL = `${url}/extensions/${extension.devUUID}`
  return output.content`Preview link: ${publicURL}`
}

function getHumanKey(type: ExtensionTypes) {
  return string.capitalize(getExtensionOutputConfig(type).humanKey)
}
