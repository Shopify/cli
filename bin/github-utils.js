#! /usr/bin/env node
import {Octokit} from '@octokit/rest'
import {runCommand} from './run-command.js'
import {createPullRequest} from 'octokit-plugin-create-pull-request'

/**
 * @returns {Promise<string>}
 */
async function getGithubPasswordFromDev() {
  try {
    // Uses token from `dev`
    return (await runCommand('/opt/dev/bin/dev', ['github', 'print-auth', '--password'])).trim()
  } catch (error) {
    console.warn(`Soft-error fetching password from dev: ${error.message}. Try running \`dev github print-auth\` manually.`)
    process.exit(0)
  }
}

/**
 * @param {string} owner
 * @param {function(import('@octokit/rest').Octokit): Promise<boolean>} func
 * @returns {Promise<boolean>}
 */
export async function withOctokit(owner, func) {
  let password = undefined

  const tokenEnvSources = [
    `GITHUB_TOKEN_${owner.toUpperCase()}`,
    `GH_TOKEN_${owner.toUpperCase()}`,
    'GITHUB_TOKEN',
    'GH_TOKEN',
  ]
  let tokenFromEnv = undefined
  for (const source of tokenEnvSources) {
    if (process.env[source]) {
      tokenFromEnv = process.env[source]
      console.log(`Using token from ${source}: ${tokenFromEnv}`)
      break
    }
  }
  if (!tokenFromEnv) {
    password = await getGithubPasswordFromDev()
    console.log(`Using password from dev: ${password}`)
  }
  const authToken = password || tokenFromEnv

  const OctokitWithPlugin = Octokit.plugin(createPullRequest)
  const octokit = new OctokitWithPlugin({
    auth: authToken,
  })
  return func(octokit)
}
