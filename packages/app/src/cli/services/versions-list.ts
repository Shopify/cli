import {fetchOrCreateOrganizationApp} from './context.js'
import {AppDeploymentsQuery, AppDeploymentsQuerySchema} from '../api/graphql/get_versions_list.js'
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
type DeploymentLine = {
  createdAt: string
  createdBy?: string
  message?: string
  versionTag: string
  status: string
}

async function fetchDeployments(
  token: string,
  apiKey: string,
): Promise<{deployments: DeploymentLine[]; totalResults: number; organizationId: string; appId: string}> {
  const query = AppDeploymentsQuery
  const res: AppDeploymentsQuerySchema = await partnersRequest(query, token, {apiKey})
  if (!res.app) throw new AbortError(`Invalid API Key: ${apiKey}`)

  const deployments = res.app.deployments.nodes.map((deployment) => {
    const message = deployment.message ?? ''
    return {
      ...deployment,
      status:
        deployment.status === 'active'
          ? colors.green(`★ ${deployment.status} (${deployment.distributionPercentage}%)`)
          : deployment.status,
      createdBy: deployment.createdBy?.displayName ?? '',
      createdAt: formatDate(new Date(deployment.createdAt)),
      message,
    }
  })

  // 10 extra characters for the table formatting
  const maxLineLength = (process.stdout.columns ?? 75) - 10
  let maxMessageLength = maxLineLength

  // Calculate the max allowed length for the message column
  deployments.forEach((deployment) => {
    const combinedLength =
      deployment.message.length +
      deployment.versionTag.length +
      unstyled(deployment.status).length +
      deployment.createdAt.length +
      deployment.createdBy.length
    if (combinedLength > maxLineLength) {
      const combinedWithoutMessageLength = combinedLength - deployment.message.length
      const newMaxLength = Math.max(maxLineLength - combinedWithoutMessageLength, 10)
      if (newMaxLength < maxMessageLength) {
        maxMessageLength = newMaxLength
      }
    }
  })

  // Update the message column to fit the max length
  deployments.forEach((deployment) => {
    if (deployment.message.length > maxMessageLength) {
      deployment.message = `${deployment.message.slice(0, maxMessageLength - 3)}...`
    }
  })

  return {
    deployments,
    totalResults: res.app.deployments.pageInfo.totalResults,
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
  const {deployments, totalResults, organizationId, appId} = await fetchDeployments(token, apiKey)

  if (deployments.length === 0) {
    outputInfo('No app versions found for this app')
    return
  }

  renderTable({
    rows: deployments,
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
