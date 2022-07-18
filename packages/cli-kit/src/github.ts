import {fetch} from './http.js'
import {Abort} from './error.js'
import {content, debug} from './output.js'

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
  // eslint-disable-next-line @typescript-eslint/naming-convention
  tag_name: string
  name: string
  body: string
  draft: boolean
  prerelease: boolean
  // eslint-disable-next-line @typescript-eslint/naming-convention
  created_at: string
  // eslint-disable-next-line @typescript-eslint/naming-convention
  published_at: string
  // eslint-disable-next-line @typescript-eslint/naming-convention
  tarball_url: string
}

interface Options {
  filter: (release: GithubRelease) => boolean
}

export async function getLatestRelease(
  user: string,
  repo: string,
  {filter}: Options = {filter: () => true},
): Promise<GithubRelease> {
  debug(content`Getting the latest release of GitHub repository ${user}/${repo}...`)
  const url = `https://api.github.com/repos/${user}/${repo}/releases`
  const fetchResult = await fetch(url)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonBody: any = await fetchResult.json()

  if (fetchResult.status !== 200) {
    throw new GitHubClientError(url, fetchResult.status, jsonBody)
  }

  return jsonBody.find(filter)
}

export function parseRepoUrl(src: string) {
  const match =
    /^(?:(?:https:\/\/)?([^:/]+\.[^:/]+)\/|git@([^:/]+)[:/]|([^/]+):)?([^/\s]+)\/([^/\s#]+)(?:((?:\/[^/\s#]+)+))?(?:\/)?(?:#(.+))?/.exec(
      src,
    )

  if (!match) {
    const exampleFormats = [
      'github:user/repo',
      'user/repo/subdirectory',
      'git@github.com:user/repo',
      'user/repo#dev',
      'https://github.com/user/repo',
    ]

    throw new Abort(`Parsing the url ${src} failed. Supported formats are ${exampleFormats.join(', ')}.`)
  }

  const site = match[1] || match[2] || match[3] || 'github.com'
  const normalizedSite = site === 'github' ? 'github.com' : site
  const user = match[4]
  const name = match[5].replace(/\.git$/, '')
  const subDirectory = match[6]?.slice(1)
  const ref = match[7]
  const branch = ref ? `#${ref}` : ''
  const ssh = `git@${normalizedSite}:${user}/${name}`
  const http = `https://${normalizedSite}/${user}/${name}`
  const full = ['https:/', normalizedSite, user, name, subDirectory].join('/').concat(branch)

  return {full, site: normalizedSite, user, name, ref, subDirectory, ssh, http}
}

export interface GithubRepoReference {
  repoBaseUrl: string
  urlWithAuth: string
  branch?: string
  filePath?: string
}

export function parseGithubRepoReference(src: string): GithubRepoReference {
  const url = new URL(src)
  const branch = url.hash ? url.hash.slice(1) : undefined
  const [_, user, repo, ...repoPath] = url.pathname.split('/')
  const filePath = repoPath.length > 0 ? repoPath.join('/') : undefined
  const repoBaseUrl = `${url.origin}/${user}/${repo}`
  let urlWithAuth: string
  if (url.username && url.password) {
    urlWithAuth = `${url.protocol}//${url.username}:${url.password}@${url.host}/${user}/${repo}`
  } else {
    urlWithAuth = repoBaseUrl
  }

  return {
    repoBaseUrl,
    urlWithAuth,
    branch,
    filePath,
  }
}
