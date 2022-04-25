import {github, file} from '@shopify/cli-kit'
import download from 'download'

export async function downloadTemplate({templateUrl, into}: {templateUrl: string; into: string}) {
  const {name, user, subDirectory} = github.parseRepoUrl(templateUrl)
  const latestRelease = await github.getLatestRelease(user, name)

  await download(latestRelease.tarball_url, into, {
    extract: true,
    filter: ({path}) => path.includes(subDirectory),
    map: (value) => ({...value, path: file.stripUp(value.path, 3)}),
  })
}
