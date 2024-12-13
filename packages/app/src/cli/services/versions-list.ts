import {renderCurrentlyUsedConfigInfo} from './context.js'
import {AppVersionsQuerySchema} from '../api/graphql/get_versions_list.js'
import {AppLinkedInterface} from '../models/app/app.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {Organization, OrganizationApp} from '../models/organization.js'
import colors from '@shopify/cli-kit/node/colors'
import {outputContent, outputInfo, outputToken, unstyled} from '@shopify/cli-kit/node/output'
import {formatDate} from '@shopify/cli-kit/common/string'
import {AbortError} from '@shopify/cli-kit/node/error'
import {basename} from '@shopify/cli-kit/node/path'
import {renderTable} from '@shopify/cli-kit/node/ui'

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type AppVersionLine = {
  createdAt: string
  createdBy?: string
  message?: string
  versionTag?: string | null
  status: string
}

const TABLE_FORMATTING_CHARS = 12

async function fetchAppVersions(
  developerPlatformClient: DeveloperPlatformClient,
  app: OrganizationApp,
  json: boolean,
): Promise<{
  appVersions: AppVersionLine[]
  totalResults: number
  app: AppVersionsQuerySchema['app']
}> {
  const res: AppVersionsQuerySchema = await developerPlatformClient.appVersions(app)
  if (!res.app) throw new AbortError(`Invalid API Key: ${app.apiKey}`)

  const appVersions = res.app.appVersions.nodes.map((appVersion) => {
    const message = appVersion.message ?? ''
    return {
      ...appVersion,
      status: appVersion.status === 'active' && !json ? colors.green(`★ ${appVersion.status}`) : appVersion.status,
      createdBy: appVersion.createdBy?.displayName ?? '',
      createdAt: formatDate(new Date(appVersion.createdAt)),
      message,
    }
  })

  if (!json) {
    const maxLineLength = (process.stdout.columns ?? 75) - TABLE_FORMATTING_CHARS
    let maxMessageLength = maxLineLength

    // Calculate the max allowed length for the message column
    appVersions.forEach((appVersion) => {
      const combinedLength =
        appVersion.message.length +
        (appVersion.versionTag?.length ?? 0) +
        unstyled(appVersion.status).length +
        appVersion.createdAt.length +
        appVersion.createdBy.length
      if (combinedLength > maxLineLength) {
        const combinedWithoutMessageLength = combinedLength - appVersion.message.length
        const newMaxLength = Math.max(maxLineLength - combinedWithoutMessageLength, 10)
        if (newMaxLength < maxMessageLength) {
          maxMessageLength = newMaxLength
        }
      }
    })

    // Update the message column to fit the max length
    appVersions.forEach((appVersion) => {
      if (appVersion.message.length > maxMessageLength) {
        appVersion.message = `${appVersion.message.slice(0, maxMessageLength - 3)}...`
      }
    })
  }

  return {
    appVersions,
    totalResults: res.app.appVersions.pageInfo.totalResults,
    app: res.app,
  }
}

interface VersionListOptions {
  app: AppLinkedInterface
  remoteApp: OrganizationApp
  organization: Organization
  developerPlatformClient: DeveloperPlatformClient
  json: boolean
}

export default async function versionList(options: VersionListOptions): Promise<AppVersionLine[]> {
  const {remoteApp, developerPlatformClient, organization} = options

  const {appVersions, totalResults} = await fetchAppVersions(developerPlatformClient, remoteApp, options.json)

  if (options.json) {
    outputInfo(JSON.stringify(appVersions, null, 2))
    return appVersions
  }

  renderCurrentlyUsedConfigInfo({
    org: organization.businessName,
    appName: remoteApp.title,
    configFile: basename(options.app.configuration.path),
  })

  if (appVersions.length === 0) {
    outputInfo('No app versions found for this app')
    return []
  }

  renderTable({
    rows: appVersions,
    columns: {
      versionTag: {header: 'VERSION'},
      status: {header: 'STATUS'},
      message: {header: 'MESSAGE'},
      createdAt: {header: 'DATE CREATED'},
      createdBy: {header: 'CREATED BY'},
    },
  })

  const link = outputToken.link(
    developerPlatformClient.webUiName,
    [await developerPlatformClient.appDeepLink(remoteApp), 'versions'].join('/'),
  )

  outputInfo(outputContent`\nView all ${String(totalResults)} app versions in the ${link}`)

  return appVersions
}
