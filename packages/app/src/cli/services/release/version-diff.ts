import {AppVersionsDiffSchema} from '../../api/graphql/app_versions_diff.js'
import {AppVersionWithContext, DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {MinimalOrganizationApp} from '../../models/organization.js'

export async function versionDiffByVersion(
  app: MinimalOrganizationApp,
  versionTag: string,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<{
  versionsDiff: AppVersionsDiffSchema['app']['versionsDiff']
  versionDetails: AppVersionWithContext
}> {
  const versionDetails = await developerPlatformClient.appVersionByTag(app, versionTag)
  const {
    app: {versionsDiff},
  }: AppVersionsDiffSchema = await developerPlatformClient.appVersionsDiff(app, {
    versionId: versionDetails.uuid,
    appVersionId: versionDetails.id,
  })

  return {versionsDiff, versionDetails}
}
