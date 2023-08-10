import {PartnersURLs} from './urls.js'
import {fetchAppFromApiKey} from './fetch.js'
import {AppInterface, isCurrentAppSchema} from '../../models/app/app.js'
import {OrganizationApp} from '../../models/organization.js'
import {getAppConfigurationShorthand} from '../../models/app/loader.js'
import {developerPreviewUpdate} from '../context.js'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {FooterContext, renderConcurrent, RenderConcurrentOptions, renderInfo} from '@shopify/cli-kit/node/ui'
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
  const enabledStorePreviewShortcut = developmentStorePreviewEnabled !== undefined
  if (enabledStorePreviewShortcut) {
    shortcuts.push(buildDevPreviewShortcut(developmentStorePreviewEnabled, apiKey, token))
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
        } else if (input === 'd' && enabledStorePreviewShortcut) {
          const currentShortcutAction = footerContext.footer?.shortcuts.find((shortcut) => shortcut.key === 'd')
          if (!currentShortcutAction) return
          const newStatus = !currentShortcutAction.metadata?.status
          const newShortcutAction = buildDevPreviewShortcut(newStatus, apiKey, token)
          if (await developerPreviewUpdate(apiKey, token, newStatus)) {
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

function buildDevPreviewShortcut(status: boolean, apiKey: string, token: string) {
  const outputStatus = status ? outputToken.green('on') : outputToken.errorText('off')
  return {
    key: 'd',
    action: outputContent`development store preview: ${outputStatus}`.value,
    metadata: {
      status,
    },
    syncer: buildPollForDevPreviewMode(apiKey, token),
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

function buildPollForDevPreviewMode(apiKey: string, token: string, interval = 10) {
  return (footerContext: FooterContext) => {
    const currentIntervalInSeconds = interval

    return new Promise<void>((_resolve, _reject) => {
      const onPoll = async () => {
        const app = await fetchAppFromApiKey(apiKey, token)
        const currentShortcutAction = footerContext.footer?.shortcuts.find((shortcut) => shortcut.key === 'd')
        if (!currentShortcutAction || currentShortcutAction.metadata?.status === app?.developmentStorePreviewEnabled)
          return
        const newShortcutAction = buildDevPreviewShortcut(app?.developmentStorePreviewEnabled ?? false, apiKey, token)
        footerContext.updateShortcut(currentShortcutAction, newShortcutAction)
      }

      const startPolling = () => {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        setInterval(onPoll, currentIntervalInSeconds * 1000)
      }

      startPolling()
    })
  }
}
