import {PartnersURLs} from './urls.js'
import {fetchAppPreviewMode} from './fetch.js'
import {AppInterface, isCurrentAppSchema} from '../../models/app/app.js'
import {OrganizationApp} from '../../models/organization.js'
import {getAppConfigurationShorthand} from '../../models/app/loader.js'
import {developerPreviewUpdate, enableDeveloperPreview} from '../context.js'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {FooterContext, renderConcurrent, RenderConcurrentOptions, renderInfo} from '@shopify/cli-kit/node/ui'
import {openURL} from '@shopify/cli-kit/node/system'
import {basename} from '@shopify/cli-kit/node/path'
import {outputContent, outputDebug, outputToken} from '@shopify/cli-kit/node/output'
import {AbortController} from '@shopify/cli-kit/node/abort'

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
      renderInfo({
        body: [
          `To update URLs manually, add the following URLs to ${fileName} under auth > redirect_urls and run\n`,
          {
            command: `npm run shopify app config push -- --config=${configName}`,
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

export async function renderDev(
  renderConcurrentOptions: RenderConcurrentOptions,
  previewUrl: string,
  app: {
    canEnablePreviewMode: boolean
    developmentStorePreviewEnabled?: boolean
    apiKey: string
    token: string
  },
) {
  let options = renderConcurrentOptions

  const {apiKey, token, canEnablePreviewMode, developmentStorePreviewEnabled} = app

  const shortcuts = []
  if (canEnablePreviewMode) {
    // Enable dev preview on app dev start
    const enablingDevPreviewSucceeds = await enableDeveloperPreview({apiKey, token})

    const devPreviewStatus = enablingDevPreviewSucceeds ? true : developmentStorePreviewEnabled

    buildDevPreviewShortcut({devPreviewStatus, apiKey, token})

    shortcuts.push(buildDevPreviewShortcut({devPreviewStatus, apiKey, token}))
  }

  const subTitle = `Preview URL: ${previewUrl}`

  if (previewUrl) {
    options = {
      ...options,
      onInputAsync: async (input, _key, exit, footerContext) => {
        if (input === 'p' && previewUrl) {
          await openURL(previewUrl)
        } else if (input === 'q') {
          exit()
        } else if (input === 'd' && canEnablePreviewMode) {
          if (!footerContext) return
          const currentShortcutAction = footerContext.footer?.shortcuts.find((shortcut) => shortcut.key === 'd')
          if (!currentShortcutAction) return
          const newDevPreviewStatus = !currentShortcutAction.state?.devPreviewStatus
          const newShortcutAction = buildDevPreviewShortcut({devPreviewStatus: newDevPreviewStatus, apiKey, token})
          const developerPreviewUpdateValue = await developerPreviewUpdate({
            apiKey,
            token,
            enabled: newDevPreviewStatus,
          })
          if (developerPreviewUpdateValue) {
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

function buildDevPreviewShortcut({
  devPreviewStatus,
  apiKey,
  token,
}: {
  devPreviewStatus?: boolean
  apiKey: string
  token: string
}) {
  const outputStatus = devPreviewStatus ? outputToken.green('✔ on') : outputToken.errorText('✖ off')
  return {
    key: 'd',
    action: outputContent`development store preview: ${outputStatus}`.value,
    state: {
      devPreviewStatus,
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

function buildPollForDevPreviewMode(apiKey: string, token: string, interval = 5) {
  return (footerContext: FooterContext, abortController: AbortController) => {
    const currentIntervalInSeconds = interval

    return new Promise<void>((_resolve, _reject) => {
      const onPoll = async () => {
        let loadedAppPreviewMode = false
        let enabled: boolean | undefined
        try {
          enabled = await fetchAppPreviewMode(apiKey, token)
          loadedAppPreviewMode = true
          // eslint-disable-next-line no-catch-all/no-catch-all
        } catch {
          outputDebug('Error fetching dev preview mode, retrying...')
        }

        if (!loadedAppPreviewMode) {
          return
        }

        const currentShortcutAction = footerContext.footer?.shortcuts.find((shortcut) => shortcut.key === 'd')
        if (!currentShortcutAction) return
        const newShortcutAction = buildDevPreviewShortcut({
          devPreviewStatus: enabled ?? false,
          apiKey,
          token,
        })
        footerContext.updateShortcut(currentShortcutAction, newShortcutAction)
      }

      const startPolling = () => {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        return setInterval(onPoll, currentIntervalInSeconds * 1000)
      }

      const pollId = startPolling()

      abortController.signal.addEventListener('abort', async () => {
        outputDebug('Stopping poll for dev preview mode...')
        clearInterval(pollId)
      })
    })
  }
}
