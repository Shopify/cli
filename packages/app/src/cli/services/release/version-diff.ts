import {AppVersionsDiffSchema, AppVersionsDiffVariables} from '../../api/graphql/app_versions_diff.js'
import {AppVersionByTagSchema} from '../../api/graphql/app_version_by_tag.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {MinimalOrganizationApp} from '../../models/organization.js'
import {renderError} from '@shopify/cli-kit/node/ui'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

export async function versionDiffByVersion(
  app: MinimalOrganizationApp,
  versionTag: string,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<{
  versionsDiff: AppVersionsDiffSchema['app']['versionsDiff']
  versionDetails: AppVersionByTagSchema['app']['appVersion']
}> {
  const versionDetails = await versionDetailsByTag(app, versionTag, developerPlatformClient)
  const input: AppVersionsDiffVariables = {
    apiKey: app.apiKey,
    versionId: versionDetails.id,
  }
  const {
    app: {versionsDiff},
  }: AppVersionsDiffSchema = await developerPlatformClient.appVersionsDiff(input)

  return {versionsDiff, versionDetails}
}

async function versionDetailsByTag(
  app: MinimalOrganizationApp,
  versionTag: string,
  developerPlatformClient: DeveloperPlatformClient,
) {
  try {
    const {
      app: {appVersion},
    }: AppVersionByTagSchema = await developerPlatformClient.appVersionByTag(app, versionTag)
    return appVersion
  } catch (err) {
    renderError({
      headline: "Version couldn't be released.",
      body: ['Version', {userInput: versionTag}, 'could not be found.'],
    })
    throw new AbortSilentError()
  }
}
