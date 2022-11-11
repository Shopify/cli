import {PartnersURLs} from './urls.js'
import {AppInterface} from '../../models/app/app.js'
import {FunctionExtension, ThemeExtension, UIExtension} from '../../models/app/extensions.js'
import {ExtensionTypes, getExtensionOutputConfig} from '../../constants.js'
import {OrganizationApp} from '../../models/organization.js'
import {output, string, environment} from '@shopify/cli-kit'

export async function outputUpdateURLsResult(
  updated: boolean,
  urls: PartnersURLs,
  app: Omit<OrganizationApp, 'apiSecretKeys' | 'apiKey'> & {apiSecret?: string},
) {
  const dashboardURL = await partnersURL(app.organizationId, app.id)
  if (app.newApp) {
    outputUpdatedURLFirstTime(urls.applicationUrl, dashboardURL)
  } else if (updated) {
    output.completed('URL updated')
  } else {
    output.info(
      output.content`\nTo make URL updates manually, you can add the following URLs as redirects in your ${dashboardURL}:`,
    )
    urls.redirectUrlWhitelist.forEach((url) => output.info(`  ${url}`))
  }
}

export function outputUpdatedURLFirstTime(url: string, dashboardURL: string) {
  const message =
    `\nFor your convenience, we've given your app a default URL: ${url}.\n\n` +
    `You can update your app's URL anytime in the ${dashboardURL}. ` +
    `But once your app is live, updating its URL will disrupt merchant access.`
  output.info(message)
}

export function outputAppURL(storeFqdn: string, url: string) {
  const title = url.includes('localhost') ? 'App URL' : 'Shareable app URL'
  const heading = output.token.heading(title)
  const appURL = buildAppURL(storeFqdn, url)
  output.info(output.content`\n\n${heading}\n\n  ${appURL}\n`)
}

export function outputDevConsoleURL(url: string) {
  const title = 'Shopify extension dev console URL'
  const heading = output.token.heading(title)
  const devConsoleURL = `${url}/extensions/dev-console`
  output.info(output.content`${heading}\n\n  ${devConsoleURL}\n`)
}

export function outputExtensionsMessages(app: AppInterface, storeFqdn: string, url: string) {
  outputUIExtensionsURLs(app.extensions.ui, storeFqdn, url)
  outputFunctionsMessage(app.extensions.function)
  outputThemeExtensionsMessage(app.extensions.theme)
}

function outputUIExtensionsURLs(extensions: UIExtension[], storeFqdn: string, url: string) {
  if (extensions.length > 0) {
    outputDevConsoleURL(url)
  }

  for (const extension of extensions) {
    const heading = output.token.heading(`${extension.configuration.name} (${getHumanKey(extension.type)})`)
    let message: string
    switch (extension.type) {
      case 'checkout_post_purchase': {
        message = postPurchaseMessage(url, extension).value
        break
      }
      case 'checkout_ui_extension': {
        message = checkoutUIMessage(url, extension).value
        break
      }
      case 'customer_accounts_ui_extension': {
        message = customerAccountsUIMessage(storeFqdn, url, extension).value
        break
      }
      case 'product_subscription': {
        message = productSubscriptionMessage(url, extension).value
        break
      }
      default:
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
  const heading = output.token.heading(`${extensions[0]!.configuration.name} (${getHumanKey(extensions[0]!.type)})`)
  const link = output.token.link(
    'dev doc instructions',
    'https://shopify.dev/apps/online-store/theme-app-extensions/getting-started#step-3-test-your-changes',
  )
  const message = output.content`Follow the ${link} by deploying your work as a draft`.value
  output.info(output.content`${heading}\n${message}\n`)
}

function buildAppURL(storeFqdn: string, publicURL: string) {
  const hostUrl = `${storeFqdn}/admin`
  const hostParam = Buffer.from(hostUrl).toString('base64').replace(/[=]/g, '')
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

function customerAccountsUIMessage(storeFqdn: string, url: string, extension: UIExtension) {
  const [storeName, ...storeDomainParts] = storeFqdn.split('.')
  const accountsUrl = `${storeName}.account.${storeDomainParts.join('.')}`
  const origin = encodeURIComponent(`${url}/extensions`)
  const publicURL = `https://${accountsUrl}/extensions-development?origin=${origin}&extensionId=${extension.devUUID}`
  const notice = `Please open ${url} and click on 'Visit Site' and then close the tab to allow connections.\n`
  return output.content`${notice}Preview link: ${publicURL}`
}

function productSubscriptionMessage(url: string, extension: UIExtension) {
  const publicURL = `${url}/extensions/${extension.devUUID}`
  return output.content`Preview link: ${publicURL}`
}

function getHumanKey(type: ExtensionTypes) {
  return string.capitalize(getExtensionOutputConfig(type).humanKey)
}

async function partnersURL(organizationId: string, appId: string): Promise<string> {
  return output.content`${output.token.link(
    `Partners Dashboard`,
    `https://${await environment.fqdn.partners()}/${organizationId}/apps/${appId}/edit`,
  )}`.value
}
