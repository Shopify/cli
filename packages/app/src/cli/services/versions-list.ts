import {type AppVersionsListResult} from './versions-list/types.js'
import {AppVersionsQuerySchema} from '../api/graphql/get_versions_list.js'
import {OrganizationApp} from '../models/organization.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {formatDate} from '@shopify/cli-kit/common/string'
import {AbortError} from '@shopify/cli-kit/node/error'

interface AppVersionsList {
  appVersions: AppVersionsListResult
  totalResults: number
}

export async function getAppVersions(
  developerPlatformClient: DeveloperPlatformClient,
  app: OrganizationApp,
): Promise<AppVersionsList> {
  const response: AppVersionsQuerySchema = await developerPlatformClient.appVersions(app)
  if (!response.app) {
    throw new AbortError(`Shopify did not return app information for API key ${app.apiKey}.`)
  }

  return {
    appVersions: response.app.appVersions.nodes.map((appVersion) => ({
      message: appVersion.message ?? '',
      versionTag: appVersion.versionTag,
      status: appVersion.status,
      createdAt: formatDate(new Date(appVersion.createdAt)),
      createdBy: appVersion.createdBy?.displayName ?? '',
      versionId: appVersion.versionId,
    })),
    totalResults: response.app.appVersions.pageInfo.totalResults,
  }
}
