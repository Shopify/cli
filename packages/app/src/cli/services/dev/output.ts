import {PartnersURLs} from './urls.js'
import {AppInterface} from '../../models/app/app.js'
import {ThemeExtension} from '../../models/app/extensions.js'
import {OrganizationApp} from '../../models/organization.js'
import {partnersFqdn} from '@shopify/cli-kit/node/environment/fqdn'
import {RenderAlertOptions, renderInfo, renderSuccess} from '@shopify/cli-kit/node/ui'
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

export function outputDevSuccess(app: AppInterface) {
  const renderSuccessOptions: RenderAlertOptions = {
    headline: ['Preview ready.', {bold: "Press 'Enter' to open your browser."}],
  }

  if (app.extensions.function.length > 0) {
    renderSuccessOptions.customSections = [
      {
        body: 'Keep in mind that Shopify Functions need to be deployed to be manually tested.',
      },
    ]
  }

  renderSuccess(renderSuccessOptions)
}

export function outputExtensionsMessages(app: AppInterface) {
  outputThemeExtensionsMessage(app.extensions.theme)
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
