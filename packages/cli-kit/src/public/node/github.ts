/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {err, ok, Result} from './result.js'
import {fetch, Response} from './http.js'
import {writeFile, mkdir, inTemporaryDirectory, moveFile, chmod} from './fs.js'
import {dirname, joinPath} from './path.js'
import {runWithTimer} from './metadata.js'
import {AbortError} from './error.js'
import {outputDebug} from '../../public/node/output.js'

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
  outputDebug(`Getting the latest release of GitHub repository ${owner}/${repo}...`)
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
  assetName: string,
  targetPath: string,
): Promise<void> {
  const url = `https://github.com/${repo}/releases/download/${version}/${assetName}`

  return runWithTimer('cmd_all_timing_network_ms')(async () => {
    outputDebug(`Downloading ${assetName} from ${url}`)
    await inTemporaryDirectory(async (tmpDir) => {
      const tempPath = joinPath(tmpDir, assetName)
      let response: Response
      try {
        response = await fetch(url, undefined, 'slow-request')
        if (!response.ok) {
          throw new AbortError(`Failed to download ${assetName}: ${response.statusText}`)
        }
      } catch (error) {
        throw new AbortError(
          `Failed to download ${assetName}: ${error instanceof Error ? error.message : 'unknown error'}`,
        )
      }

      const buffer = await response.arrayBuffer()
      await writeFile(tempPath, Buffer.from(buffer))

      await chmod(tempPath, 0o755)
      await mkdir(dirname(targetPath))
      await moveFile(tempPath, targetPath)
    })
    outputDebug(`✅ Successfully downloaded ${targetPath}`)
  })
}
