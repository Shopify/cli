import {AppVersionsDiffSchema, AppVersionsDiffVariables} from '../../api/graphql/app_versions_diff.js'
import {AppVersionByTagSchema, AppVersionByTagVariables} from '../../api/graphql/app_version_by_tag.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {renderError} from '@shopify/cli-kit/node/ui'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

export async function versionDiffByVersion(
  apiKey: string,
  version: string,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<{
  versionsDiff: AppVersionsDiffSchema['app']['versionsDiff']
  versionDetails: AppVersionByTagSchema['app']['appVersion']
}> {
  const versionDetails = await versionDetailsByTag(apiKey, version, developerPlatformClient)
  const input: AppVersionsDiffVariables = {
    apiKey,
    versionId: versionDetails.id,
  }
  const {
    app: {versionsDiff},
  }: AppVersionsDiffSchema = await developerPlatformClient.appVersionsDiff(input)

  return {versionsDiff, versionDetails}
}

async function versionDetailsByTag(apiKey: string, version: string, developerPlatformClient: DeveloperPlatformClient) {
  try {
    const input: AppVersionByTagVariables = {
      apiKey,
      versionTag: version,
    }
    const {
      app: {appVersion},
    }: AppVersionByTagSchema = await developerPlatformClient.appVersionByTag(input)
    return appVersion
  } catch (err) {
    renderError({
      headline: "Version couldn't be released.",
      body: ['Version', {userInput: version}, 'could not be found.'],
    })
    throw new AbortSilentError()
  }
}
