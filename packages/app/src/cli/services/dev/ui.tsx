import {PartnersURLs} from './urls.js'
import {Dev, DevProps} from './ui/components/Dev.js'
import {AppInterface, isCurrentAppSchema} from '../../models/app/app.js'
import {OrganizationApp} from '../../models/organization.js'
import {getAppConfigurationShorthand} from '../../models/app/loader.js'
import {disableDeveloperPreview, enableDeveloperPreview} from '../context.js'
import React from 'react'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {render, renderInfo} from '@shopify/cli-kit/node/ui'
import {basename} from '@shopify/cli-kit/node/path'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
import {terminalSupportsRawMode} from '@shopify/cli-kit/node/system'

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
      const fileName = basename(localApp.configuration.path)
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

export async function renderDev({processes, previewUrl, app, abortController, graphiqlUrl, developerPreview}: DevProps) {
  if (terminalSupportsRawMode(process.stdin)) {
    return render(
      <Dev
        processes={processes}
        abortController={abortController}
        previewUrl={previewUrl}
        app={app}
        graphiqlUrl={graphiqlUrl}
        developerPreview={developerPreview}
      />,
      {
        exitOnCtrlC: false,
      },
    )
  } else {
    await renderDevNonInteractive({processes, app, abortController, developerPreview})
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

async function renderDevNonInteractive({
  processes,
  app: {canEnablePreviewMode},
  abortController,
  developerPreview,
}: Omit<DevProps, 'previewUrl'>) {
  if (canEnablePreviewMode) {
    await developerPreview.enable()
    abortController?.signal.addEventListener('abort', async () => {
      await developerPreview.disable()
    })
  }
  return Promise.all(
    processes.map(async (concurrentProcess) => {
      await concurrentProcess.action(process.stdout, process.stderr, abortController.signal)
    }),
  )
}
