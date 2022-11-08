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
    const message = extension.previewMessage(url, storeFqdn)
    if (message) output.info(output.content`${heading}\n${message.value}\n`)
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

function getHumanKey(type: ExtensionTypes) {
  return string.capitalize(getExtensionOutputConfig(type).humanKey)
}

async function partnersURL(organizationId: string, appId: string): Promise<string> {
  return output.content`${output.token.link(
    `Partners Dashboard`,
    `https://${await environment.fqdn.partners()}/${organizationId}/apps/${appId}/edit`,
  )}`.value
}
