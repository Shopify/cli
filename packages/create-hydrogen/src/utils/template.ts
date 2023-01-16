import download from 'download'
import {getLatestGitHubRelease, parseGitHubRepositoryURL} from '@shopify/cli-kit/node/github'

export async function downloadTemplate({templateUrl, into}: {templateUrl: string; into: string}) {
  const {name, user, subDirectory} = parseGitHubRepositoryURL(templateUrl).valueOrAbort()
  const latestRelease = await getLatestGitHubRelease(user, name)

  await download(latestRelease.tarball_url, into, {
    extract: true,
    filter: ({path}) => path.includes(subDirectory),
    map: (value) => ({...value, path: file.stripUpPath(value.path, 3)}),
  })
}
