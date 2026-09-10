import {AppVersionsQuerySchema} from '../api/graphql/get_versions_list.js'
import {OrganizationApp} from '../models/organization.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {formatDate} from '@shopify/cli-kit/common/string'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const appVersionJsonOutputSchema = zod.object({
  message: zod.string(),
  versionTag: zod.string().nullable().optional(),
  status: zod.string(),
  createdAt: zod.string(),
  createdBy: zod.string(),
  versionId: zod.string(),
})

export const appVersionsListJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppVersionsListResult',
  schema: zod.array(appVersionJsonOutputSchema),
  definitions: {AppVersion: appVersionJsonOutputSchema},
})

export type AppVersionsListResult = InferJsonOutputSchema<typeof appVersionsListJsonOutputSchema>

interface AppVersionsList {
  appVersions: AppVersionsListResult
  totalResults: number
}

export async function getAppVersions(
  developerPlatformClient: DeveloperPlatformClient,
  app: OrganizationApp,
): Promise<AppVersionsList | undefined> {
  const response: AppVersionsQuerySchema = await developerPlatformClient.appVersions(app)
  if (!response.app) return undefined

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
