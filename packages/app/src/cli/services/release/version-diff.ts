import {AppVersionsDiffSchema} from '../../api/graphql/app_versions_diff.js'
import {AppVersionWithContext, DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {MinimalOrganizationApp} from '../../models/organization.js'
import {renderError} from '@shopify/cli-kit/node/ui'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

export async function versionDiffByVersion(
  app: MinimalOrganizationApp,
  versionTag: string,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<{
  versionsDiff: AppVersionsDiffSchema['app']['versionsDiff']
  versionDetails: AppVersionWithContext
}> {
  const versionDetails = await versionDetailsByTag(app, versionTag, developerPlatformClient)
  const {
    app: {versionsDiff},
  }: AppVersionsDiffSchema = await developerPlatformClient.appVersionsDiff(app, {
    versionId: versionDetails.uuid,
    appVersionId: versionDetails.id,
  })

  return {versionsDiff, versionDetails}
}

async function versionDetailsByTag(
  app: MinimalOrganizationApp,
  versionTag: string,
  developerPlatformClient: DeveloperPlatformClient,
) {
  try {
    const appVersion = await developerPlatformClient.appVersionByTag(app, versionTag)
    return appVersion
  } catch (err) {
    renderError({
      headline: "Version couldn't be released.",
      body: ['Version', {userInput: versionTag}, 'could not be found.'],
    })
    throw new AbortSilentError()
  }
}
