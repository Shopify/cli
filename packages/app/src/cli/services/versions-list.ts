import {ensureVersionsListContext, renderCurrentlyUsedConfigInfo} from './context.js'
import {fetchOrgFromId} from './dev/fetch.js'
import {AppVersionsQuery, AppVersionsQuerySchema} from '../api/graphql/get_versions_list.js'
import {AppInterface, isCurrentAppSchema} from '../models/app/app.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
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
  versionTag: string
  status: string
}

const TABLE_FORMATTING_CHARS = 12

async function fetchAppVersions(
  token: string,
  apiKey: string,
  json: boolean,
): Promise<{
  appVersions: AppVersionLine[]
  totalResults: number
  app: AppVersionsQuerySchema['app']
}> {
  const query = AppVersionsQuery
  const res: AppVersionsQuerySchema = await partnersRequest(query, token, {apiKey})
  if (!res.app) throw new AbortError(`Invalid API Key: ${apiKey}`)

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
  }

  return {
    appVersions,
    totalResults: res.app.appVersions.pageInfo.totalResults,
    app: res.app,
  }
}

interface VersionListOptions {
  app: AppInterface
  apiKey?: string
  reset: false
  json: boolean
}

export default async function versionList(options: VersionListOptions) {
  const {partnersSession, partnersApp} = await ensureVersionsListContext(options)
  const {id: appId, organizationId, title, apiKey} = partnersApp

  const {appVersions, totalResults} = await fetchAppVersions(partnersSession.token, apiKey, options.json)

  const {businessName: org} = await fetchOrgFromId(organizationId, partnersSession)

  if (options.json) {
    return outputInfo(JSON.stringify(appVersions, null, 2))
  }

  renderCurrentlyUsedConfigInfo({
    org,
    appName: title,
    configFile: isCurrentAppSchema(options.app.configuration) ? basename(options.app.configuration.path) : undefined,
  })

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
