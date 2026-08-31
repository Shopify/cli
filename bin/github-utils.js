#! /usr/bin/env node
import {Octokit} from '@octokit/rest'
import {runCommand} from './run-command.js'
import {createPullRequest} from 'octokit-plugin-create-pull-request'

/**
 * @param {typeof runCommand} executeCommand
 * @returns {Promise<string>}
 */
async function getGithubTokenFromDev(executeCommand) {
  try {
    // Uses token from `dev`
    const token = (
      await executeCommand('/opt/dev/bin/dev', ['github', 'print-auth', '--password'], {printOutput: false})
    ).trim()
    if (!token) throw new Error('The GitHub token returned by dev is empty.')
    return token
  } catch {
    throw new Error('Failed to fetch a GitHub token from dev. Try running `dev github auth`.')
  }
}

/**
 * @param {string} owner
 * @param {{environment?: NodeJS.ProcessEnv, executeCommand?: typeof runCommand, log?: (message: string) => void}} [options]
 * @returns {Promise<string>}
 */
export async function getGithubToken(
  owner,
  {environment = process.env, executeCommand = runCommand, log = console.log} = {},
) {
  const tokenEnvSources = [
    `GITHUB_TOKEN_${owner.toUpperCase()}`,
    `GH_TOKEN_${owner.toUpperCase()}`,
    'GITHUB_TOKEN',
    'GH_TOKEN',
  ]

  for (const source of tokenEnvSources) {
    const token = environment[source]
    if (token) {
      log(`Using GitHub token from ${source}`)
      return token
    }
  }

  const token = await getGithubTokenFromDev(executeCommand)
  log('Using GitHub token from dev')
  return token
}

/**
 * @param {string} owner
 * @param {function(import('@octokit/rest').Octokit): Promise<boolean>} func
 * @returns {Promise<boolean>}
 */
export async function withOctokit(owner, func) {
  const authToken = await getGithubToken(owner)

  const OctokitWithPlugin = Octokit.plugin(createPullRequest)
  const octokit = new OctokitWithPlugin({
    auth: authToken,
  })
  return func(octokit)
}
