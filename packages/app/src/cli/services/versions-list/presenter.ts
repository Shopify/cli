import {renderCurrentlyUsedConfigInfo} from '../context.js'
import {AppVersionsListResult} from '../versions-list.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {Organization, OrganizationApp} from '../../models/organization.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import colors from '@shopify/cli-kit/node/colors'
import {outputContent, outputInfo, outputToken, unstyled} from '@shopify/cli-kit/node/output'
import {basename} from '@shopify/cli-kit/node/path'
import {renderTable} from '@shopify/cli-kit/node/ui'

const TABLE_FORMATTING_CHARS = 12

interface RenderAppVersionsListOptions {
  app: AppLinkedInterface
  appVersions: AppVersionsListResult
  totalResults: number
  remoteApp: OrganizationApp
  organization: Organization
  developerPlatformClient: DeveloperPlatformClient
}

export async function renderAppVersionsList({
  app,
  appVersions: versionResults,
  totalResults,
  remoteApp,
  organization,
  developerPlatformClient,
}: RenderAppVersionsListOptions): Promise<void> {
  renderCurrentlyUsedConfigInfo({
    org: organization.businessName,
    appName: remoteApp.title,
    configFile: basename(app.configPath),
  })

  if (versionResults.length === 0) {
    outputInfo('No app versions found for this app')
    return
  }

  const appVersions = versionResults.map((appVersion) => ({
    ...appVersion,
    status: appVersion.status === 'active' ? colors.green(`★ ${appVersion.status}`) : appVersion.status,
  }))
  const maxLineLength = (process.stdout.columns ?? 75) - TABLE_FORMATTING_CHARS
  let maxMessageLength = maxLineLength

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
      if (newMaxLength < maxMessageLength) maxMessageLength = newMaxLength
    }
  })

  appVersions.forEach((appVersion) => {
    if (appVersion.message.length > maxMessageLength) {
      appVersion.message = `${appVersion.message.slice(0, maxMessageLength - 3)}...`
    }
  })

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
}
