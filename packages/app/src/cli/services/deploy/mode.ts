import {OrganizationApp} from '../../models/organization.js'
import {DeployContextOptions} from '../context.js'
import {SetBetaFlagQuery, SetBetaFlagSchema, SetBetaFlagVariables} from '../../api/graphql/set_beta_flag.js'
import {PackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {formatPackageManagerCommand, outputCompleted, outputNewline} from '@shopify/cli-kit/node/output'
import {InfoMessage, renderConfirmationPrompt, renderInfo, renderTasks, renderWarning} from '@shopify/cli-kit/node/ui'
import figures from '@shopify/cli-kit/node/figures'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {BugError} from '@shopify/cli-kit/node/error'

export type DeploymentMode = 'legacy' | 'unified' | 'unified-skip-release'

export async function resolveDeploymentMode(app: OrganizationApp, options: DeployContextOptions, token: string) {
  let deploymentMode: DeploymentMode = app.betas?.unifiedAppDeployment ? 'unified' : 'legacy'

  if (deploymentMode === 'legacy') {
    deploymentMode = (await upgradeDeploymentToUnified(app, options, token)) ? 'unified' : 'legacy'
  }

  if (deploymentMode === 'unified') {
    if (options.noRelease) {
      deploymentMode = 'unified-skip-release'
    } else {
      displayDeployUnifiedBanner(options.app.packageManager)
    }
  }

  return deploymentMode
}

function displayDeployUnifiedBanner(packageManager: PackageManager) {
  renderWarning({
    headline: [{command: formatPackageManagerCommand(packageManager, 'deploy')}, 'now releases changes to users.'],
    body: ['All your extensions will be released to users, unless you add the `--no-release` flag.'],
    reference: [
      {
        link: {
          label: 'Simplified extension deployment',
          url: 'https://shopify.dev/docs/apps/deployment/simplified-deployment',
        },
      },
    ],
  })
}

function displayDeployLegacyBanner(packageManager: PackageManager) {
  renderInfo({
    headline: 'Simplified deployment available now!',
    body: [
      'When you upgrade this app to use simplified deployment,',
      {command: formatPackageManagerCommand(packageManager, 'deploy')},
      'will:\n',
      {
        list: {
          items: [
            'Bundle all your extensions into an app version',
            'Release all your extensions to users straight from the CLI',
          ],
        },
      },
    ],
    reference: [
      {
        link: {
          label: 'Simplified extension deployment',
          url: 'https://shopify.dev/docs/apps/deployment/simplified-deployment',
        },
      },
    ],
  })
}

async function upgradeDeploymentToUnified(app: OrganizationApp, options: DeployContextOptions, token: string) {
  if (!app.betas?.unifiedAppDeploymentOptIn || options.force) return false

  displayDeployLegacyBanner(options.app.packageManager)

  const infoMessage: InfoMessage = {
    title: {
      color: 'red',
      text: `${figures.warning} This can't be undone.`,
    },
    body: "Once you upgrade this app, you can't go back to the old way of deploying extensions",
  }
  const shouldUprade = await renderConfirmationPrompt({
    message: `Upgrade ${app.title} to use simplified deployment?`,
    confirmationMessage: `Yes, upgrade this app`,
    cancellationMessage: "No, don't upgrade",
    defaultValue: false,
    infoMessage,
  })

  if (!shouldUprade) {
    return false
  }

  const tasks = [
    {
      title: 'Upgrading app...',
      task: async () => {
        const query = SetBetaFlagQuery
        const variables: SetBetaFlagVariables = {
          input: {
            apiKey: app.apiKey,
            betaName: 'app_unified_deployment',
            enabled: true,
          },
        }
        const result: SetBetaFlagSchema = await partnersRequest(query, token, variables)
        if (result.setBetaFlag.userErrors?.length > 0) {
          const errors = result.setBetaFlag.userErrors.map((error) => error.message).join(', ')
          throw new BugError(`Error upgrading the app ${app.title} to use simplified deployment: ${errors}`)
        }
      },
    },
  ]
  await renderTasks(tasks)
  outputCompleted('Upgrade complete')
  outputNewline()
  return true
}
