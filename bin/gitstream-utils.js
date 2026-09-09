#! /usr/bin/env node
import {createHash} from 'node:crypto'

import {runCommand} from './run-command.js'

// The monorepo the CLI docs live in, and the repository `gs` targets by default.
const WORLD_REPO = 'shop/world'

/**
 * @param {string[]} args
 * @param {{input?: string}} [options]
 * @returns {Promise<string>}
 */
function runGs(args, {input} = {}) {
  return runCommand('gs', args, {printOutput: false, input})
}

/**
 * Calls gitstream's GitHub-compatible REST API through `gs`, which supplies the credentials.
 *
 * @param {string} endpoint
 * @param {{method?: string, body?: unknown}} [options]
 * @returns {Promise<any>}
 */
async function gsApi(endpoint, {method = 'GET', body} = {}) {
  const args = ['api', endpoint, '--method', method]
  if (body !== undefined) args.push('--input', '-')

  return JSON.parse(await runGs(args, {input: body === undefined ? undefined : JSON.stringify(body)}))
}

/**
 * As `gsApi`, but returns undefined instead of throwing when the resource doesn't exist.
 *
 * @param {string} endpoint
 * @returns {Promise<any>}
 */
async function gsApiAllowingMissing(endpoint) {
  try {
    return await gsApi(endpoint)
  } catch (error) {
    // `gs api` exits non-zero with the HTTP status in its stderr, which runCommand puts in the message.
    if (error.message.includes('HTTP 404')) return undefined
    throw error
  }
}

/**
 * The git blob SHA the given content would have. Comparing it against the SHA gitstream
 * reports for a path tells us whether a file changed without downloading its contents.
 *
 * @param {string} content
 * @returns {string}
 */
export function gitBlobSha(content) {
  const bytes = Buffer.from(content)
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
}

/**
 * @param {string} branch
 * @returns {Promise<string | undefined>} The branch's head commit SHA, or undefined when it doesn't exist.
 */
async function branchHeadSha(branch) {
  const response = await gsApiAllowingMissing(`repos/${WORLD_REPO}/branches/${branch}`)
  return response?.commit.sha
}

/**
 * @param {Record<string, string>} files
 * @param {string} commitSha
 * @returns {Promise<Record<string, string>>} The subset of files whose contents differ from that commit.
 */
async function filesDifferingFrom(files, commitSha) {
  const entries = await Promise.all(
    Object.entries(files).map(async ([filePath, content]) => {
      const existing = await gsApiAllowingMissing(`repos/${WORLD_REPO}/contents/${filePath}?ref=${commitSha}`)
      return existing?.sha === gitBlobSha(content) ? undefined : [filePath, content]
    }),
  )

  return Object.fromEntries(entries.filter((entry) => entry !== undefined))
}

/**
 * @param {{message: string, files: Record<string, string>, parentSha: string}} options
 * @returns {Promise<string>} The new commit's SHA.
 */
async function createCommit({message, files, parentSha}) {
  const parentCommit = await gsApi(`repos/${WORLD_REPO}/git/commits/${parentSha}`)

  const tree = await Promise.all(
    Object.entries(files).map(async ([filePath, content]) => {
      const blob = await gsApi(`repos/${WORLD_REPO}/git/blobs`, {
        method: 'POST',
        body: {content: Buffer.from(content).toString('base64'), encoding: 'base64'},
      })
      return {path: filePath, mode: '100644', type: 'blob', sha: blob.sha}
    }),
  )

  const newTree = await gsApi(`repos/${WORLD_REPO}/git/trees`, {
    method: 'POST',
    body: {base_tree: parentCommit.tree.sha, tree},
  })

  const commit = await gsApi(`repos/${WORLD_REPO}/git/commits`, {
    method: 'POST',
    body: {message, tree: newTree.sha, parents: [parentSha]},
  })

  return commit.sha
}

/**
 * @param {string} branch
 * @returns {Promise<{number: number} | undefined>}
 */
async function openPullRequestForBranch(branch) {
  const [pullRequest] = JSON.parse(await runGs(['pr', 'list', '--head', branch, '--state', 'open', '--json']))
  return pullRequest
}

/**
 * @param {{branch: string, base: string, title: string, body: string}} options
 * @returns {Promise<{number: number}>}
 */
async function createPullRequest({branch, base, title, body}) {
  // `gs pr create` creates a draft by default; `--publish` opens it ready for review.
  const args = ['pr', 'create', '--head', branch, '--base', base, '--title', title, '--publish', '--json']

  return JSON.parse(await runGs([...args, '--body-file', '-'], {input: body}))
}

/**
 * Creates a branch in shop/world with the given file contents and opens a pull request for it.
 *
 * When the branch already exists the changes are committed on top of it, which updates the
 * pull request that's already open for it rather than opening a second one.
 *
 * @param {{branch: string, base: string, title: string, body: string, commitMessage: string, files: Record<string, string>}} options
 * @returns {Promise<{number: number, url: string} | undefined>} Undefined when no file changed.
 */
export async function createWorldPullRequest({branch, base, title, body, commitMessage, files}) {
  const existingBranchSha = await branchHeadSha(branch)
  const parentSha = existingBranchSha ?? (await branchHeadSha(base))
  if (parentSha === undefined) {
    throw new Error(`Neither ${branch} nor the base branch ${base} exists in ${WORLD_REPO}.`)
  }

  const changedFiles = await filesDifferingFrom(files, parentSha)
  if (Object.keys(changedFiles).length === 0) return undefined

  const commitSha = await createCommit({message: commitMessage, files: changedFiles, parentSha})

  if (existingBranchSha === undefined) {
    await gsApi(`repos/${WORLD_REPO}/git/refs`, {
      method: 'POST',
      body: {ref: `refs/heads/${branch}`, sha: commitSha},
    })
  } else {
    // A fast-forward, since the commit was built on top of the branch's current head.
    await gsApi(`repos/${WORLD_REPO}/git/refs/heads/${branch}`, {method: 'PATCH', body: {sha: commitSha}})
  }

  const pullRequest =
    (await openPullRequestForBranch(branch)) ?? (await createPullRequest({branch, base, title, body}))

  return {number: pullRequest.number, url: await pullRequestUrl(pullRequest.number)}
}

/**
 * @param {number} number
 * @returns {Promise<string>} The pull request's browser URL.
 */
async function pullRequestUrl(number) {
  const {htmlUrl} = JSON.parse(await runGs(['pr', 'view', String(number), '--json']))
  return htmlUrl
}
