import {fetchOrCreateOrganizationApp} from './context.js'
import {AppVersionsQuery, AppVersionsQuerySchema} from '../api/graphql/get_versions_list.js'
import {AppInterface} from '../models/app/app.js'
import {getAppIdentifiers} from '../models/app/identifiers.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {renderTable} from '@shopify/cli-kit/node/ui'
import colors from '@shopify/cli-kit/node/colors'
import {outputContent, outputInfo, outputToken, unstyled} from '@shopify/cli-kit/node/output'
import {formatDate} from '@shopify/cli-kit/common/string'
import {AbortError} from '@shopify/cli-kit/node/error'

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type AppVersionLine = {
  createdAt: string
  createdBy?: string
  message?: string
  versionTag: string
  status: string
}

const TABLE_FORMATTING_CHARS = 12

async function fetchAppVersions(
  token: string,
  apiKey: string,
): Promise<{appVersions: AppVersionLine[]; totalResults: number; organizationId: string; appId: string}> {
  const query = AppVersionsQuery
  const res: AppVersionsQuerySchema = await partnersRequest(query, token, {apiKey})
  if (!res.app) throw new AbortError(`Invalid API Key: ${apiKey}`)

  const appVersions = res.app.appVersions.nodes.map((appVersion) => {
    const message = appVersion.message ?? ''
    return {
      ...appVersion,
      status:
        appVersion.status === 'active'
          ? colors.green(`★ ${appVersion.status} (${appVersion.distributionPercentage}%)`)
          : appVersion.status,
      createdBy: appVersion.createdBy?.displayName ?? '',
      createdAt: formatDate(new Date(appVersion.createdAt)),
      message,
    }
  })

  const maxLineLength = (process.stdout.columns ?? 75) - TABLE_FORMATTING_CHARS
  let maxMessageLength = maxLineLength

  // Calculate the max allowed length for the message column
  appVersions.forEach((appVersion) => {
    const combinedLength =
      appVersion.message.length +
      appVersion.versionTag.length +
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

  return {
    appVersions,
    totalResults: res.app.appVersions.pageInfo.totalResults,
    organizationId: res.app.organizationId,
    appId: res.app.id,
  }
}

async function getAppApiKey(token: string, options: VersionListOptions): Promise<string> {
  if (options.apiKey) return options.apiKey
  const envIdentifiers = getAppIdentifiers({app: options.app})
  if (envIdentifiers.app) return envIdentifiers.app
  const partnersApp = await fetchOrCreateOrganizationApp(options.app, token)
  return partnersApp.apiKey
}

interface VersionListOptions {
  app: AppInterface
  apiKey?: string
}

export default async function versionList(options: VersionListOptions) {
  const token = await ensureAuthenticatedPartners()
  const apiKey = await getAppApiKey(token, options)
  const {appVersions, totalResults, organizationId, appId} = await fetchAppVersions(token, apiKey)

  if (appVersions.length === 0) {
    outputInfo('No app versions found for this app')
    return
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
    'Partner Dashboard',
    `https://partners.shopify.com/${organizationId}/apps/${appId}/versions`,
  )

  outputInfo(outputContent`\nView all ${String(totalResults)} app versions in the ${link}`)
}
