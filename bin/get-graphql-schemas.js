#! /usr/bin/env node
import {Octokit} from '@octokit/rest'
import * as fs from 'fs'
import * as path from 'path'
import {withOctokit} from './github-utils.js'
import {runCommand} from './run-command.js'
import {execSync} from "node:child_process";

const BRANCH = 'main'

// Retry config for GitHub API rate limiting (gitmon).
// Uses longer delays than cli-kit's DEFAULT_RETRY_DELAY_MS (1s) because gitmon
// blocks by subnet/network pattern, requiring more patience than typical API throttling.
// Exponential backoff: 5s → 10s → 20s (35s total) is acceptable for CI scripts.
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY_MS = 5000

/**
 * Sleep for the specified number of milliseconds
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * @typedef {Object} Schema
 * @property {string} owner
 * @property {string} repo
 * @property {string} pathToFile
 * @property {string[]} localPaths
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
    localPaths: ['./packages/app/src/cli/api/graphql/partners/cli_schema.graphql'],
  },
  {
    owner: 'shop',
    repo: 'world',
    pathToFile: 'areas/platforms/organizations/db/graphql/destinations_schema.graphql',
    localPaths: [
      './packages/app/src/cli/api/graphql/business-platform-destinations/destinations_schema.graphql',
      './packages/organizations/src/cli/api/graphql/business-platform-destinations/destinations_schema.graphql',
    ],
  },
  {
    owner: 'shop',
    repo: 'world',
    pathToFile: 'areas/platforms/organizations/db/graphql/organizations_schema.graphql',
    localPaths: [
      './packages/app/src/cli/api/graphql/business-platform-organizations/organizations_schema.graphql',
      './packages/store/src/cli/api/graphql/business-platform-organizations/organizations_schema.graphql',
    ],
  },
  {
    owner: 'shop',
    repo: 'world',
    pathToFile: 'areas/core/shopify/db/graphql/app_dev_schema_unstable_public.graphql',
    localPaths: ['./packages/app/src/cli/api/graphql/app-dev/app_dev_schema.graphql'],
  },
  {
    owner: 'shop',
    repo: 'world',
    pathToFile: 'areas/core/shopify/db/graphql/app_management_schema_unstable_public.graphql',
    localPaths: ['./packages/app/src/cli/api/graphql/app-management/app_management_schema.graphql'],
  },
  {
    owner: 'shop',
    repo: 'world',
    pathToFile: 'areas/core/shopify/db/graphql/admin_schema_unstable_public.graphql',
    localPaths: [
      './packages/cli-kit/src/cli/api/graphql/admin/admin_schema.graphql',
      './packages/app/src/cli/api/graphql/bulk-operations/admin_schema.graphql',
      './packages/app/src/cli/api/graphql/admin/admin_schema.graphql',
    ],
    usesLfs: true,
  },
  {
    owner: 'shop',
    repo: 'world',
    pathToFile: 'areas/core/shopify/db/graphql/webhooks_schema_unstable_public.graphql',
    localPaths: ['./packages/app/src/cli/api/graphql/webhooks/webhooks_schema.graphql'],
  },
  {
    owner: 'shop',
    repo: 'world',
    pathToFile: 'areas/core/shopify/db/graphql/functions_cli_api_schema_unstable_public.graphql',
    localPaths: ['./packages/app/src/cli/api/graphql/functions/functions_cli_schema.graphql'],
  },
]


/**
 * @param {Schema} schema
 * @param {import('@octokit/rest').Octokit} octokit
 * @returns {Promise<boolean>}
 */
async function fetchFileForSchema(schema, octokit) {
  const branch = schema.branch ?? BRANCH
  const owner = schema.owner
  const repoName = schema.repo
  const fileDescription = schema.usesLfs
    ? `LFS file ${owner}/${repoName}#${branch}: ${schema.pathToFile}`
    : `${owner}/${repoName}#${branch}: ${schema.pathToFile}`

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      let content = ''
      if (schema.usesLfs) {
        console.log(`\nFetching ${fileDescription} ...`)
        const {data: {download_url}} = await octokit.repos.getContent({
          mediaType: { format: "json" },
          owner: owner,
          repo: repoName,
          path: schema.pathToFile,
          ref: branch,
        })
        console.log(`LFS download via ${download_url}...`)
        content = await fetch(download_url).then(res => {
          if (!res.ok) {
            const error = new Error(`HTTP ${res.status}: ${res.statusText}`)
            error.status = res.status
            error.response = {headers: res.headers}
            throw error
          }
          return res.text()
        })
      } else {
        console.log(`\nFetching ${fileDescription} ...`)
        const {data} = await octokit.repos.getContent({
          mediaType: { format: "raw" },
          owner: owner,
          repo: repoName,
          path: schema.pathToFile,
          ref: branch,
        })

        content = Buffer.from(data).toString('utf-8')
      }

      // Write the content to all local paths
      for (const localFilePath of schema.localPaths) {
        const dir = path.dirname(localFilePath)
        fs.mkdirSync(dir, {recursive: true})
        fs.writeFileSync(localFilePath, content)
        console.log(`File saved to ${localFilePath}`)
      }
      return true
    } catch (error) {
      const isRateLimited = error.status === 429
      const isTransientNetworkError = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN']
        .includes(error.code)
      const isRetryable = isRateLimited || isTransientNetworkError
      const hasRetriesLeft = attempt < MAX_RETRIES

      if (isRetryable && hasRetriesLeft) {
        const retryAfterHeader = error.response?.headers?.['retry-after']
        const parsedRetryAfter = parseInt(retryAfterHeader, 10)
        const retryAfterSeconds = (!isNaN(parsedRetryAfter) && parsedRetryAfter > 0) ? Math.min(parsedRetryAfter, 120) : null
        const delayMs = retryAfterSeconds ? retryAfterSeconds * 1000 : INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt)
        const delaySeconds = Math.round(delayMs / 1000)

        const reason = isRateLimited ? 'Rate limited' : `Network error (${error.code})`
        console.warn(`${reason} fetching ${fileDescription}. Retrying in ${delaySeconds}s (retry ${attempt + 1} of ${MAX_RETRIES}). Error: ${error.message}`)
        await sleep(delayMs)
        continue
      }

      console.error(`Error fetching ${fileDescription}: ${error.message}`)
      return false
    }
  }

  // All retries exhausted without success
  return false
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
async function fetchFilesFromLocal() {
  for (const schema of schemas) {
    // "dev cd world" is deprecated in favor of "dev cd //"
    const localDir = schema.repo === 'world' ? '//' : schema.repo
    const localRepoDirectory = execSync(`/opt/dev/bin/dev cd --no-chdir ${localDir}`).toString().split('/areas')[0].trim()
    const sourcePath = path.join(localRepoDirectory, schema.pathToFile)
    for (const localPath of schema.localPaths) {
      console.log('Copying', sourcePath, 'to', localPath)
      fs.copyFileSync(sourcePath, localPath)
    }
  }
  console.log('Done!')
}

if (process.env.SHOPIFY_SERVICE_ENV === 'local') {
  fetchFilesFromLocal()
} else {
  fetchFiles()
}
