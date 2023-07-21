import {AppVersionsDiffQuery, AppVersionsDiffSchema} from '../../api/graphql/app_versions_diff.js'
import {AppVersionByTagQuery, AppVersionByTagSchema} from '../../api/graphql/app_version_by_tag.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {renderError} from '@shopify/cli-kit/node/ui'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

export async function versionDiffByVersion(
  apiKey: string,
  version: string,
  token: string,
): Promise<{
  versionsDiff: AppVersionsDiffSchema['app']['versionsDiff']
  versionDetails: AppVersionByTagSchema['app']['appVersion']
}> {
  const versionDetails = await versionDetailsByVersion(apiKey, version, token)
  const {
    app: {versionsDiff},
  }: AppVersionsDiffSchema = await partnersRequest(AppVersionsDiffQuery, token, {
    apiKey,
    versionId: versionDetails.id,
  })

  return {versionsDiff, versionDetails}
}

async function versionDetailsByVersion(apiKey: string, version: string, token: string) {
  try {
    const {
      app: {appVersion},
    }: AppVersionByTagSchema = await partnersRequest(AppVersionByTagQuery, token, {
      apiKey,
      versionTag: version,
    })
    return appVersion
  } catch (err) {
    renderError({
      headline: "Version couldn't be released.",
      body: ['Version', {userInput: version}, 'could not be found.'],
    })
    throw new AbortSilentError()
  }
}
