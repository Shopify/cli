import {PartnersURLs} from './urls.js'
import {AppInterface, isCurrentAppSchema} from '../../models/app/app.js'
import {OrganizationApp} from '../../models/organization.js'
import {getAppConfigurationShorthand} from '../../models/app/loader.js'
import {developerPreviewUpdate} from '../context.js'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {renderConcurrent, RenderConcurrentOptions, renderInfo} from '@shopify/cli-kit/node/ui'
import {openURL} from '@shopify/cli-kit/node/system'
import {basename} from '@shopify/cli-kit/node/path'
import {formatPackageManagerCommand, outputContent, outputToken} from '@shopify/cli-kit/node/output'

export async function outputUpdateURLsResult(
  updated: boolean,
  urls: PartnersURLs,
  remoteApp: Omit<OrganizationApp, 'apiSecretKeys' | 'apiKey'> & {apiSecret?: string},
  localApp: AppInterface,
) {
  const dashboardURL = await partnersURL(remoteApp.organizationId, remoteApp.id)
  if (remoteApp.newApp) {
    renderInfo({
      headline: `For your convenience, we've given your app a default URL: ${urls.applicationUrl}.`,
      body: [
        "You can update your app's URL anytime in the",
        dashboardURL,
        'But once your app is live, updating its URL will disrupt user access.',
      ],
    })
  } else if (!updated) {
    if (isCurrentAppSchema(localApp.configuration)) {
      const fileName = basename(localApp.configurationPath)
      const configName = getAppConfigurationShorthand(fileName)
      const pushCommandArgs = configName ? [`--config=${configName}`] : []

      renderInfo({
        body: [
          `To update URLs manually, add the following URLs to ${fileName} under auth > redirect_urls and run\n`,
          {
            command: formatPackageManagerCommand(
              localApp.packageManager,
              `shopify app config push`,
              ...pushCommandArgs,
            ),
          },
          '\n\n',
          {list: {items: urls.redirectUrlWhitelist}},
        ],
      })
    } else {
      renderInfo({
        body: [
          'To make URL updates manually, you can add the following URLs as redirects in your',
          dashboardURL,
          {char: ':'},
          '\n\n',
          {list: {items: urls.redirectUrlWhitelist}},
        ],
      })
    }
  }
}

export function renderDev(
  renderConcurrentOptions: RenderConcurrentOptions,
  previewUrl: string,
  app: {
    developmentStorePreviewEnabled?: boolean
    apiKey: string
    token: string
  },
) {
  let options = renderConcurrentOptions

  const {developmentStorePreviewEnabled, apiKey, token} = app

  const shortcuts = []
  if (developmentStorePreviewEnabled) {
    shortcuts.push(buildDevPreviewShortcut(developmentStorePreviewEnabled))
  }

  const subTitle = `Preview URL: ${previewUrl}`

  if (previewUrl) {
    options = {
      ...options,
      onInput: async (input, _key, exit, footerContext) => {
        if (input === 'p' && previewUrl) {
          await openURL(previewUrl)
        } else if (input === 'q') {
          exit()
        } else if (input === 'd' || input === 'e') {
          const currentShortcutAction = footerContext.footer?.shortcuts.find(
            (shortcut) => shortcut.key === 'd' || shortcut.key === 'e',
          )
          if (!currentShortcutAction || currentShortcutAction.key !== input) return
          const currentShortcutEnableOrDisable = currentShortcutAction.key === 'e'
          const newShortcutAction = buildDevPreviewShortcut(currentShortcutEnableOrDisable)
          if (await developerPreviewUpdate(apiKey, token, currentShortcutEnableOrDisable)) {
            footerContext.updateShortcut(currentShortcutAction, newShortcutAction)
            footerContext.updateSubTitle(subTitle)
          } else {
            const newSubTitle = outputContent`${subTitle}\n\n${outputToken.errorText(
              'There was an error turning on developer preview mode',
            )}`.value
            footerContext.updateSubTitle(newSubTitle)
          }
        }
      },
      footer: {
        shortcuts: [
          ...shortcuts,
          {
            key: 'p',
            action: 'preview in your browser',
          },
          {
            key: 'q',
            action: 'quit',
          },
        ],
        subTitle,
      },
    }
  }
  return renderConcurrent({...options, keepRunningAfterProcessesResolve: true})
}

function buildDevPreviewShortcut(enabled: boolean) {
  return {
    key: enabled ? 'd' : 'e',
    action: outputContent`dev preview mode: ${enabled ? outputToken.green('on') : outputToken.errorText('off')}`.value,
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
