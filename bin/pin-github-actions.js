#! /usr/bin/env node

import glob from 'fast-glob'
import {fileURLToPath} from 'url'
import path from 'node:path'
import utils from 'util'
import {execFile} from 'child_process'

export const execute = utils.promisify(execFile)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const args = process.argv
if (args.length !== 3) {
  console.log(
    [
      `Usage: bin/${path.basename(__filename)} <GITHUB_ACCESS_TOKEN>\n`,
      'This script needs a Github access token to avoid hitting rate limits.',
      'You can grab your existing one by running `dev github print-auth`.',
    ].join('\n'),
  )
  process.exit(1)
}
const githubAccessToken = args[2]

async function doIt() {
  const githubYmls = glob.sync(`${__dirname}/../.github/{actions,workflows}/**/*.yml`)
  const pinGithubAction = `${__dirname}/../node_modules/.bin/pin-github-action`
  for (const githubYml of githubYmls) {
    await execute(
      pinGithubAction,
      [
        githubYml,
        '--allow=actions/*',
        '--allow-empty',
      ],
      {
        env: {
          ...process.env,
          GH_ADMIN_TOKEN: githubAccessToken,
        },
      }
    )
    process.stdout.write('.')
  }
  console.log(' Done!')
}

doIt()
