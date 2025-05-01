/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {err, ok, Result} from './result.js'
import {fetch, Response} from './http.js'
import {mkdir, inTemporaryDirectory, chmod, moveFile, writeFile} from './fs.js'
import {dirname, joinPath} from './path.js'
import {AbortError} from './error.js'
import {runWithTimer} from './metadata.js'
import {outputContent, outputDebug, outputToken} from '../../public/node/output.js'

class GitHubClientError extends Error {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(url: string, statusCode: number, bodyJson: any) {
    super(
      `The request to GitHub API URL ${url} failed with status code ${statusCode} and the following error message: ${bodyJson.message}`,
    )
  }
}

export interface GithubRelease {
  id: number
  url: string
  tag_name: string
  name: string
  body: string
  draft: boolean
  prerelease: boolean
  created_at: string
  published_at: string
  tarball_url: string
}

interface GetLatestGitHubReleaseOptions {
  filter: (release: GithubRelease) => boolean
}

/**
 * Given a GitHub repository it obtains the latest release.
 * @param owner - Repository owner (e.g., shopify)
 * @param repo - Repository name (e.g., cli)
 * @param options - Options
 */
export async function getLatestGitHubRelease(
  owner: string,
  repo: string,
  options: GetLatestGitHubReleaseOptions = {filter: () => true},
): Promise<GithubRelease> {
  outputDebug(outputContent`Getting the latest release of GitHub repository ${owner}/${repo}...`)
  const url = `https://api.github.com/repos/${owner}/${repo}/releases`
  const fetchResult = await fetch(url)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonBody: any = await fetchResult.json()

  if (fetchResult.status !== 200) {
    throw new GitHubClientError(url, fetchResult.status, jsonBody)
  }

  return jsonBody.find(options.filter)
}

interface ParseRepositoryURLOutput {
  full: string
  site: string
  user: string
  name: string
  ref: string
  subDirectory: string
  ssh: string
  http: string
}

/**
 * Given a GitHub repository URL, it parses it and returns its coomponents.
 * @param url - The GitHub repository URL
 */
export function parseGitHubRepositoryURL(url: string): Result<ParseRepositoryURLOutput, Error> {
  const match =
    /^(?:(?:https:\/\/)?([^:/]+\.[^:/]+)\/|git@([^:/]+)[:/]|([^/]+):)?([^/\s]+)\/([^/\s#]+)(?:((?:\/[^/\s#]+)+))?(?:\/)?(?:#(.+))?/.exec(
      url,
    )

  if (!match) {
    const exampleFormats = [
      'github:user/repo',
      'user/repo/subdirectory',
      'git@github.com:user/repo',
      'user/repo#dev',
      'https://github.com/user/repo',
    ]

    return err(new Error(`Parsing the url ${url} failed. Supported formats are ${exampleFormats.join(', ')}.`))
  }

  const site = match[1] ?? match[2] ?? match[3] ?? 'github.com'
  const normalizedSite = site === 'github' ? 'github.com' : site
  const user = match[4]!
  const name = match[5]!.replace(/\.git$/, '')
  // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
  const subDirectory = match[6]?.slice(1)!
  const ref = match[7]!
  const branch = ref ? `#${ref}` : ''
  const ssh = `git@${normalizedSite}:${user}/${name}`
  const http = `https://${normalizedSite}/${user}/${name}`
  const full = ['https:/', normalizedSite, user, name, subDirectory].join('/').concat(branch)

  return ok({full, site: normalizedSite, user, name, ref, subDirectory, ssh, http})
}

export interface GithubRepositoryReference {
  baseURL: string
  branch?: string
  filePath?: string
}

/**
 * Given a GitHub repository URL it parses it and extracts the branch, file path,
 * and base URL components
 * @param reference - A GitHub repository URL (e.g. https://github.com/Shopify/cli/blob/main/package.json)
 */
export function parseGitHubRepositoryReference(reference: string): GithubRepositoryReference {
  const url = new URL(reference)
  const branch = url.hash ? url.hash.slice(1) : undefined
  const [_, user, repo, ...repoPath] = url.pathname.split('/')
  const filePath = repoPath.length > 0 ? repoPath.join('/') : undefined

  return {
    baseURL: `${url.origin}/${user}/${repo}`,
    branch,
    filePath,
  }
}

export async function downloadGitHubRelease(
  repo: string,
  version: string,
  asset: string,
  targetPath: string,
): Promise<void> {
  const url = `https://github.com/${repo}/releases/download/${version}/${asset}`

  await download(url, {
    to: targetPath,
    mode: 0o755,
  })
}

export async function downloadGitHubFile(
  repo: string,
  tag: string,
  asset: string,
  targetPath: string,
  options: Pick<DownloadOptions, 'onError'> = {},
): Promise<void> {
  const url = `https://raw.githubusercontent.com/${repo}/refs/tags/${tag}/${asset}`

  await download(url, {
    to: targetPath,
    ...options,
  })
}

interface DownloadOptions {
  to: string
  mode?: number
  onError?: (error: string, url: string) => void
}

async function download(url: string, options: DownloadOptions): Promise<void> {
  const assetName = url.split('/').pop()!

  function handleError(error: string) {
    const message = `Failed to download ${assetName}: ${error}`

    if (options.onError) {
      options.onError(message, url)
    } else {
      throw new AbortError(message)
    }
  }

  return runWithTimer('cmd_all_timing_network_ms')(async () => {
    outputDebug(outputContent`Downloading ${outputToken.link(assetName, url)}`)

    await inTemporaryDirectory(async (tmpDir) => {
      const tempPath = joinPath(tmpDir, assetName)

      let response: Response
      try {
        response = await fetch(url, undefined, 'slow-request')

        if (!response.ok) {
          handleError(`${response.status} ${response.statusText}`)
          return
        }

        // if options.onError is set, we don't want to throw an error
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (error) {
        handleError(error instanceof Error ? error.message : 'unknown error')
        return
      }

      const responseBuffer = await response.arrayBuffer()
      await writeFile(tempPath, Buffer.from(responseBuffer))

      if (options.mode) {
        await chmod(tempPath, options.mode)
      }

      await mkdir(dirname(options.to))
      await moveFile(tempPath, options.to)
    })
    outputDebug(outputContent`${outputToken.successIcon()} Successfully downloaded ${outputToken.path(options.to)}`)
  })
}
