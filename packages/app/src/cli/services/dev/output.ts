import {PartnersURLs} from './urls.js'
import {AppInterface} from '../../models/app/app.js'
import {FunctionExtension, ThemeExtension} from '../../models/app/extensions.js'
import {OrganizationApp} from '../../models/organization.js'
import {buildAppURLForWeb} from '../../utilities/app/app-url.js'
import {partnersFqdn} from '@shopify/cli-kit/node/environment/fqdn'
import {renderInfo, renderSuccess} from '@shopify/cli-kit/node/ui'
import {output} from '@shopify/cli-kit'

export async function outputUpdateURLsResult(
  updated: boolean,
  urls: PartnersURLs,
  app: Omit<OrganizationApp, 'apiSecretKeys' | 'apiKey'> & {apiSecret?: string},
) {
  const dashboardURL = await partnersURL(app.organizationId, app.id)
  if (app.newApp) {
    renderInfo({
      headline: `For your convenience, we've given your app a default URL: ${urls.applicationUrl}.`,
      body: [
        "You can update your app's URL anytime in the",
        dashboardURL,
        'But once your app is live, updating its URL will disrupt merchant access.',
      ],
    })
  } else if (!updated) {
    renderInfo({
      headline: [
        'To make URL updates manually, you can add the following URLs as redirects in your',
        dashboardURL,
        {char: ':'},
      ],
      body: {list: {items: urls.redirectUrlWhitelist}},
    })
  }
}

interface OutputPreviewUrlOptions {
  app: AppInterface
  storeFqdn: string
  exposedUrl: string
  proxyUrl: string
  appPreviewAvailable: boolean
}

export function outputPreviewUrl({app, storeFqdn, exposedUrl, proxyUrl, appPreviewAvailable}: OutputPreviewUrlOptions) {
  if (!appPreviewAvailable && app.extensions.ui.length === 0) {
    return
  }

  let previewUrl

  if (app.extensions.ui.length > 0) {
    previewUrl = `${proxyUrl}/extensions/dev-console`
  } else {
    previewUrl = buildAppURLForWeb(storeFqdn, exposedUrl)
  }

  renderSuccess({
    headline: ['Preview ready!', {bold: 'Press any key to open your browser'}],
    body: {subdued: previewUrl},
    customSections: [
      {
        body: "Keep in mind that some Shopify extensions - like Functions and web pixel - aren't yet available for dev previews.",
      },
    ],
  })

  return previewUrl
}

export function outputExtensionsMessages(app: AppInterface) {
  outputFunctionsMessage(app.extensions.function)
  outputThemeExtensionsMessage(app.extensions.theme)
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
  for (const extension of extensions) {
    const message = extension.previewMessage('', '')
    if (message) output.info(message)
  }
}

async function partnersURL(organizationId: string, appId: string) {
  return {
    link: {
      label: 'Partners Dashboard',
      url: `https://${await partnersFqdn()}/${organizationId}/apps/${appId}/edit`,
    },
  }
}
