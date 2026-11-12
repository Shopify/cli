#! /usr/bin/env node
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'

import {runCommand} from './run-command.js'

const WORLD_REPO = 'shop/world'

/**
 * @param {{environment?: NodeJS.ProcessEnv, executeCommand?: typeof runCommand}} [options]
 * @returns {Promise<string>}
 */
export async function getWorldHost({environment = process.env, executeCommand = runCommand} = {}) {
  const host =
    environment.WGH_HOST?.trim() ||
    (await executeCommand('git', ['config', '--get', '--default', '', 'wgh.host'], {printOutput: false})).trim()

  if (!host) {
    throw new Error('Set WGH_HOST or run `git config wgh.host <host>` to configure the World host.')
  }

  return new URL(host.includes('://') ? host : `https://${host}`).origin
}

/**
 * @param {string[]} args
 * @param {string} host
 * @param {typeof runCommand} executeCommand
 * @returns {Promise<any>}
 */
async function runDelta(args, host, executeCommand) {
  const output = await executeCommand('dt', ['--host', host, '--repo', WORLD_REPO, ...args], {
    printOutput: false,
  })
  return JSON.parse(output)
}

/**
 * @param {string} branch
 * @param {string} host
 * @param {typeof runCommand} executeCommand
 * @returns {Promise<boolean>}
 */
async function branchExists(branch, host, executeCommand) {
  try {
    await runDelta(['api', `repos/${WORLD_REPO}/branches/${encodeURIComponent(branch)}`], host, executeCommand)
    return true
  } catch (error) {
    if (/(?:^|\n)Error: 404:/.test(error.message)) return false
    throw error
  }
}

/**
 * Creates a branch in shop/world with the given file contents and opens a pull request for it.
 *
 * When the branch already exists the changes are committed on top of it, which updates the
 * pull request that's already open for it rather than opening a second one.
 *
 * @param {{branch: string, base: string, title: string, body: string, commitMessage: string, files: Record<string, string>}} options
 * @param {{executeCommand?: typeof runCommand, repositoryUrl?: string, environment?: NodeJS.ProcessEnv}} [dependencies]
 * @returns {Promise<{number: number, url: string} | undefined>} Undefined when no file changed.
 */
export async function createWorldPullRequest(
  {branch, base, title, body, commitMessage, files},
  {executeCommand = runCommand, repositoryUrl, environment = process.env} = {},
) {
  const host = await getWorldHost({environment, executeCommand})
  const parentBranch = (await branchExists(branch, host, executeCommand)) ? branch : base
  const directory = await mkdtemp(join(tmpdir(), 'shopify-cli-docs-'))
  const filePaths = Object.keys(files)
  const runGit = (args, options = {}) =>
    executeCommand('git', ['-C', directory, ...args], {printOutput: false, ...options})

  try {
    await executeCommand(
      'git',
      [
        'clone',
        '--depth=1',
        '--filter=blob:none',
        '--no-checkout',
        '--single-branch',
        '--no-tags',
        '--branch',
        parentBranch,
        repositoryUrl ?? `${host}/${WORLD_REPO}.git`,
        directory,
      ],
      {printOutput: false},
    )
    await runGit(['sparse-checkout', 'set', '--no-cone', '--stdin'], {
      input: filePaths.map((filePath) => `/${filePath}\n`).join(''),
    })
    await runGit(['checkout', '--detach'])

    for (const [filePath, content] of Object.entries(files)) {
      const destination = join(directory, filePath)
      await mkdir(dirname(destination), {recursive: true})
      await writeFile(destination, content)
    }

    await runGit(['add', '--', ...filePaths])
    if (!(await runGit(['diff', '--cached', '--name-only'])).trim()) return undefined

    await runGit(['commit', '-m', commitMessage])
    await runGit(['push', 'origin', `HEAD:refs/heads/${branch}`])
  } finally {
    await rm(directory, {recursive: true, force: true})
  }

  const [existingPullRequest] = await runDelta(
    ['pr', 'list', '--head', branch, '--state', 'open', '--json'],
    host,
    executeCommand,
  )
  const pullRequest =
    existingPullRequest ??
    (await runDelta(
      ['pr', 'create', '--head', branch, '--base', base, '--title', title, '--body', body, '--publish', '--json'],
      host,
      executeCommand,
    ))

  return {number: pullRequest.number, url: pullRequest.html_url}
}
