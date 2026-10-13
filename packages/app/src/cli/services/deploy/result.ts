import {appDeployJsonOutputSchema, type AppDeployResult, type DeployResult} from './types.js'
import {getTomls} from '../../utilities/app/config/getTomls.js'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {formatPackageManagerCommand, outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo, renderSuccess, type AlertCustomSection, type TokenItem} from '@shopify/cli-kit/node/ui'
import type {OrganizationApp} from '../../models/organization.js'
import type {AppLinkedInterface} from '../../models/app/app.js'
import type {Project} from '../../models/project/project.js'
import type {UploadExtensionsBundleOutput} from './upload.js'

export async function renderAppDeployResult(
  result: DeployResult,
  remoteApp: OrganizationApp,
  project: Project,
  format: 'json' | 'text',
): Promise<void> {
  if (format === 'json') {
    const publicResult = appDeployResult(result, remoteApp)
    outputResult(appDeployJsonOutputSchema.encode(publicResult))
    if (publicResult.status === 'cancelled') throw Object.assign(new AbortSilentError(), {oclif: {exit: 0}})
    if (publicResult.status === 'partial') process.exitCode = 1
    return
  }

  if (result.status === 'cancelled') throw new AbortSilentError()
  await renderDeployCompletion({...result, project})
}

function appDeployResult(result: DeployResult, remoteApp: OrganizationApp): AppDeployResult {
  if (result.status === 'cancelled') return {status: 'cancelled'}
  const {release, uploadExtensionsBundleResult: version} = result
  const data = {
    app: {name: remoteApp.title, clientId: remoteApp.apiKey},
    deployment: {
      released: release && !version.deployError,
      version: {
        gid: version.versionGid,
        name: version.versionTag === '' ? null : (version.versionTag ?? null),
        message: version.message === '' ? null : (version.message ?? null),
        url: version.location,
      },
    },
  }
  if (release && version.deployError) {
    return {
      ...data,
      deployment: {...data.deployment, released: false},
      status: 'partial',
      errors: [{type: 'abort', message: version.deployError}],
    }
  }
  return {...data, status: 'success'}
}

async function renderDeployCompletion({
  app,
  project,
  release,
  uploadExtensionsBundleResult,
  didMigrateExtensionsToDevDash,
}: {
  app: AppLinkedInterface
  project: Project
  release: boolean
  uploadExtensionsBundleResult: UploadExtensionsBundleOutput
  didMigrateExtensionsToDevDash: boolean
}) {
  const linkAndMessage = [
    {link: {label: uploadExtensionsBundleResult.versionTag ?? 'version', url: uploadExtensionsBundleResult.location}},
    uploadExtensionsBundleResult.message ? `\n${uploadExtensionsBundleResult.message}` : '',
  ]
  let customSections: AlertCustomSection[] = []
  if (didMigrateExtensionsToDevDash) {
    const tomls = await getTomls(app.directory)
    const tomlsWithoutCurrent = Object.values(tomls).filter((toml) => toml !== tomls[app.configuration.client_id])

    const body: TokenItem = []
    if (tomlsWithoutCurrent.length > 0) {
      body.push(
        '• Map extension IDs to other copies of your app by running',
        {
          command: formatPackageManagerCommand(project.packageManager, 'shopify app deploy'),
        },
        'for: ',
        {
          list: {
            items: tomlsWithoutCurrent,
          },
        },
      )
    }

    body.push("• Commit to source control to ensure your extension IDs aren't regenerated on the next deploy.")
    customSections = [
      {title: 'Next steps', body},
      {
        title: 'Reference',
        body: [
          '• ',
          {
            link: {
              label: 'Migrating from the Partner Dashboard',
              url: 'https://shopify.dev/docs/apps/build/dev-dashboard/migrate-from-partners',
            },
          },
        ],
      },
    ]
  }

  if (release) {
    return uploadExtensionsBundleResult.deployError
      ? renderInfo({
          headline: 'New version created, but not released.',
          body: [...linkAndMessage, `\n\n${uploadExtensionsBundleResult.deployError}`],
          customSections,
        })
      : renderSuccess({
          headline: 'New version released to users.',
          body: linkAndMessage,
          customSections,
        })
  }

  return renderSuccess({
    headline: 'New version created.',
    body: linkAndMessage,
    customSections,
    nextSteps: [
      [
        'Run',
        {
          command: formatPackageManagerCommand(
            project.packageManager,
            'shopify app release',
            `--version=${uploadExtensionsBundleResult.versionTag}`,
          ),
        },
        'to release this version to users.',
      ],
    ],
  })
}
