import {fetchOrCreateOrganizationApp} from './context.js'
import {AppDeploymentsQuery, AppDeploymentsQuerySchema} from '../api/graphql/get_versions_list.js'
import {AppInterface} from '../models/app/app.js'
import {getAppIdentifiers} from '../models/app/identifiers.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {renderTable} from '@shopify/cli-kit/node/ui'
import colors from '@shopify/cli-kit/node/colors'
import {outputContent, outputInfo, outputToken} from '@shopify/cli-kit/node/output'

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
  const deployments = res.app.deployments.nodes.map((deployment) => {
    return {
      ...deployment,
      status: deployment.status === 'active' ? colors.green(`★ ${deployment.status}`) : deployment.status,
      createdBy: deployment.createdBy?.displayName ?? '',
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
