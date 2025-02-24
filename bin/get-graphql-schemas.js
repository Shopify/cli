#! /usr/bin/env node
import {Octokit} from '@octokit/rest'
import * as fs from 'fs'
import * as path from 'path'
import {spawn} from 'child_process'

const BRANCH = 'main'

/**
 * @typedef {Object} Schema
 * @property {string} owner
 * @property {string} repo
 * @property {string} pathToFile
 * @property {string} localPath
 * @property {string | undefined} [branch]
 * @property {boolean} [usesLfs]
 */

/**
 * @type {Schema[]}
 */
const schemas = [
  {
    owner: 'Shopify',
    repo: 'partners',
    pathToFile: 'db/graphql/cli_schema.graphql',
    localPath: './packages/app/src/cli/api/graphql/partners/cli_schema.graphql',
  },
  {
    owner: 'Shopify',
    repo: 'business-platform',
    pathToFile: 'db/graphql/destinations_schema.graphql',
    localPath: './packages/app/src/cli/api/graphql/business-platform-destinations/destinations_schema.graphql',
  },
  {
    owner: 'Shopify',
    repo: 'business-platform',
    pathToFile: 'db/graphql/organizations_schema.graphql',
    localPath: './packages/app/src/cli/api/graphql/business-platform-organizations/organizations_schema.graphql',
  },
  {
    owner: 'shop',
    repo: 'world',
    pathToFile: 'areas/core/shopify/db/graphql/app_dev_schema_unstable_public.graphql',
    localPath: './packages/app/src/cli/api/graphql/app-dev/app_dev_schema.graphql',
  },
  {
    owner: 'shop',
    repo: 'world',
    pathToFile: 'areas/core/shopify/db/graphql/app_management_schema_unstable_public.graphql',
    localPath: './packages/app/src/cli/api/graphql/app-management/app_management_schema.graphql',
  },
  {
    owner: 'shop',
    repo: 'world',
    pathToFile: 'areas/core/shopify/db/graphql/admin_schema_unstable_public.graphql',
    localPath: './packages/cli-kit/src/cli/api/graphql/admin/admin_schema.graphql',
    usesLfs: true,
  },
  {
    owner: 'shop',
    repo: 'world',
    pathToFile: 'areas/core/shopify/db/graphql/webhooks_schema_unstable_public.graphql',
    localPath: './packages/app/src/cli/api/graphql/webhooks/webhooks_schema.graphql',
  },
  {
    owner: 'shop',
    repo: 'world',
    pathToFile: 'areas/core/shopify/db/graphql/functions_cli_api_schema_unstable_public.graphql',
    localPath: './packages/app/src/cli/api/graphql/functions/functions_cli_schema.graphql',
  },
]

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {stdio: ['inherit', 'pipe', 'pipe']})

    let output = ''
    let errorOutput = ''

    child.stdout.on('data', (data) => {
      console.log(data.toString())
      output += data.toString()
    })

    child.stderr.on('data', (data) => {
      console.log(data.toString())
      errorOutput += data.toString()
    })

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}\n${errorOutput}`))
      } else {
        resolve(output)
      }
    })
  })
}

/**
 * @param {string} output
 * @returns {string}
 */
function extractPassword(output) {
  const passwordRegex = /Password: (\w+)/
  const match = output.match(passwordRegex)
  if (match && match[1]) {
    return match[1]
  }
  throw new Error('Password not found in output')
}

/**
 * @param {Schema} schema
 * @param {import('@octokit/rest').Octokit} octokit
 * @returns {Promise<boolean>}
 */
async function fetchFileForSchema(schema, octokit) {
  try {
    // Fetch the file content from the repository
    const branch = schema.branch ?? BRANCH
    const owner = schema.owner
    const repoName = schema.repo

    let content = ''
    if (schema.usesLfs) {
      console.log(`\nFetching LFS file ${owner}/${repoName}#${branch}: ${schema.pathToFile} ...`)
      const {data: {download_url}} = await octokit.repos.getContent({
        mediaType: { format: "json" },
        owner: owner,
        repo: repoName,
        path: schema.pathToFile,
        ref: branch,
      })
      console.log(`LFS download via ${download_url}...`)
      content = await fetch(download_url).then(res => res.text())
    } else {
      console.log(`\nFetching ${owner}/${repoName}#${branch}: ${schema.pathToFile} ...`)
      const {data} = await octokit.repos.getContent({
        mediaType: { format: "raw" },
        owner: owner,
        repo: repoName,
        path: schema.pathToFile,
        ref: branch,
      })

      content = Buffer.from(data).toString('utf-8')
    }

    // Define the local path where the file will be saved
    const localFilePath = schema.localPath

    const dir = path.dirname(localFilePath)
    fs.mkdirSync(dir, {recursive: true})

    // Write the content to a local file
    fs.writeFileSync(localFilePath, content)

    console.log(`File downloaded successfully to ${localFilePath}`)
    return true
  } catch (error) {
    console.error(`Error fetching file: ${error.message}`)
    return false
  }
}

/**
 * @returns {Promise<string>}
 */
async function getGithubPasswordFromDev() {
  try {
    // Uses token from `dev`
    const output = await runCommand('/opt/dev/bin/dev', ['github', 'print-auth'])
    const password = extractPassword(output)
    return password
  } catch (error) {
    console.warn(`Soft-error fetching password from dev: ${error.message}`)
    process.exit(0)
  }
}

/**
 * @param {string} owner
 * @param {function(import('@octokit/rest').Octokit): Promise<boolean>} func
 * @returns {Promise<boolean>}
 */
async function withOctokit(owner, func) {
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

  const octokit = new Octokit({
    auth: authToken,
  })
  return func(octokit)
}

/**
 * @returns {Promise<void>}
 */
async function fetchFiles() {
  let allSuccess = true
  for (const schema of schemas) {
    allSuccess = allSuccess && await withOctokit(schema.owner, async (octokit) => {
      return fetchFileForSchema(schema, octokit)
    })
  }

  if (!allSuccess) {
    console.error('Failed to fetch all files')
    process.exit(1)
  }
}

/**
 * @returns {Promise<void>}
 */
async function fetchFilesFromSpin() {
  for (const schema of schemas) {
    const owner = schema.owner
    const repoName = schema.repo

    const remotePath = `~/src/github.com/${owner}/${repoName}/${schema.pathToFile}`
    const localPath = schema.localPath
    try {
      await runCommand('spin', ['copy', `${process.env.SPIN_INSTANCE}:${remotePath}`, localPath])
    } catch(e) {
      if (e.message.match(/scp.*No such file or directory/)) {
        // Assume we need to just fetch the file from GitHub
        console.log(`Cannot find file for ${schema.repo} in Spin, fetching from GitHub instead...`)
        await withOctokit(schema.owner, async (octokit) => {
          await fetchFileForSchema(schema, octokit)
        })
      } else {
        throw e
      }
    }
  }
}

if (process.env.SPIN_INSTANCE) {
  fetchFilesFromSpin()
} else {
  fetchFiles()
}
